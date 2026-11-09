import history from "@/data/history.json";
import collegeData from "@/data/colleges.json";
import overrideData from "@/data/overrides.json";
import { getRoster, getWeek, type RawGame, type RosterPlayer } from "./espn";
import { INTL_VENUES, STADIUMS, isUSA, lookupCity, miles, norm, sameCountry, type LatLon } from "./geo";
import type { Flag, FlaggedPlayer, GameCard, Position, TeamInfo, WeekData } from "./types";

const HISTORY = history as Record<string, Record<string, number[]>>;
const COLLEGES = collegeData as Record<string, { name: string; city: string; state: string; lat: number; lon: number }>;
const OVERRIDES = (overrideData as any).players as Record<
  string,
  { birthPlace?: { city?: string; state?: string; country?: string }; formerTeams?: Record<string, number[]> }
>;

/** How close counts as "same city". Suburbs count. Override with HOMETOWN_RADIUS_MILES. */
const RADIUS = Number(process.env.HOMETOWN_RADIUS_MILES ?? 40);
/** Birthday flag window, in days either side of kickoff. */
const BIRTHDAY_WINDOW = 3;

// ---------- venue ----------
function venueCoords(g: RawGame): LatLon | null {
  if (!g.neutral && STADIUMS[g.home.abbr]) return STADIUMS[g.home.abbr];
  const intl = INTL_VENUES[norm(g.city)];
  if (intl) return intl;
  return lookupCity(g.city, g.state) ?? STADIUMS[g.home.abbr] ?? null;
}

// ---------- birthday ----------
function etDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function birthdayFlag(dob: string | undefined, kickoff: string): Flag | null {
  if (!dob) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  if (!by || !bm || !bd) return null;
  const k = etDate(kickoff);
  const kickDay = Date.UTC(k.y, k.m - 1, k.d);
  let bestDiff = Infinity;
  let bestYear = k.y;
  for (const yr of [k.y - 1, k.y, k.y + 1]) {
    const diff = Math.round((Date.UTC(yr, bm - 1, bd) - kickDay) / 86400000);
    if (Math.abs(diff) < Math.abs(bestDiff)) {
      bestDiff = diff;
      bestYear = yr;
    }
  }
  if (Math.abs(bestDiff) > BIRTHDAY_WINDOW) return null;
  const age = bestYear - by;
  const when = new Date(kickDay + bestDiff * 86400000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (bestDiff === 0) return { type: "birthday", label: "🎂 Birthday game", detail: `Turns ${age} on game day`, weight: 3 };
  return {
    type: "birthday",
    label: "🎂 Birthday week",
    detail: bestDiff < 0 ? `Turned ${age} on ${when}` : `Turns ${age} on ${when}`,
    weight: 2,
  };
}

// ---------- hometown ----------
function hometownFlag(p: RosterPlayer, g: RawGame, venue: LatLon | null): Flag | null {
  const o = OVERRIDES[p.id]?.birthPlace;
  const city = o?.city ?? p.birthCity;
  const state = o?.state ?? p.birthState;
  const country = o?.country ?? p.birthCountry;
  if (!city && !country) return null;

  // International game: match on country
  if (!isUSA(g.country)) {
    if (sameCountry(country, g.country))
      return { type: "hometown", label: "🏠 Hometown game", detail: `Born in ${city ? city + ", " : ""}${country}`, weight: 4 };
    return null;
  }
  if (!isUSA(country)) return null;

  if (city && state && norm(city) === norm(g.city) && state === g.state)
    return { type: "hometown", label: "🏠 Hometown game", detail: `Born in ${city}, ${state}`, weight: 4 };

  const c = lookupCity(city, state);
  if (!c || !venue) return null;
  const dist = miles(c, venue);
  if (dist > RADIUS) return null;
  return {
    type: "hometown",
    label: dist <= 15 ? "🏠 Hometown game" : "🏠 Home metro",
    detail: `Born in ${city}, ${state} · ${Math.round(dist)} mi from the stadium`,
    weight: dist <= 15 ? 4 : 3,
  };
}

// ---------- revenge ----------
function revengeFlag(p: RosterPlayer, current: TeamInfo, opp: TeamInfo): Flag | null {
  const hist = { ...(HISTORY[p.id] ?? {}), ...(OVERRIDES[p.id]?.formerTeams ?? {}) };
  const years = hist[opp.abbr];
  if (!years?.length || opp.abbr === current.abbr) return null;
  const span = years.length === 1 ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`;
  return { type: "revenge", label: "😤 Revenge game", detail: `Former ${opp.abbr} player (${span})`, weight: 2 };
}

// ---------- college ----------
function collegeFlag(p: RosterPlayer, g: RawGame, venue: LatLon | null): Flag | null {
  if (!isUSA(g.country) || !p.collegeId || !venue) return null;
  const col = COLLEGES[p.collegeId];
  if (!col) return null;
  const dist = miles([col.lat, col.lon], venue);
  if (dist > RADIUS) return null;
  return {
    type: "college",
    label: "🎓 College return",
    detail: `Played at ${col.name} (${col.city}, ${col.state}) · ${Math.round(dist)} mi from the stadium`,
    weight: 1,
  };
}

// ---------- assemble ----------
function flagTeam(g: RawGame, venue: LatLon | null, roster: RosterPlayer[], team: TeamInfo, opp: TeamInfo): FlaggedPlayer[] {
  const out: FlaggedPlayer[] = [];
  for (const p of roster) {
    const flags = [
      birthdayFlag(p.dob, g.date),
      hometownFlag(p, g, venue),
      revengeFlag(p, team, opp),
      collegeFlag(p, g, venue),
    ].filter((f): f is Flag => !!f);
    if (!flags.length) continue;
    let score = flags.reduce((s, f) => s + f.weight, 0);
    // The one you actually care about: birthday AND hometown
    if (flags.some((f) => f.type === "birthday") && flags.some((f) => f.type === "hometown")) score += 4;
    out.push({
      id: p.id,
      name: p.name,
      position: p.position as Position,
      jersey: p.jersey,
      headshot: p.headshot,
      team,
      opponent: opp,
      injury: p.injury,
      unavailable: !!p.injury && /\bout\b|injured reserve|suspen|physically unable|non-football/i.test(p.injury),
      flags,
      score,
    });
  }
  return out;
}

export async function buildWeek(week?: number): Promise<WeekData> {
  const w = await getWeek(week);
  const teamIds = [...new Set(w.games.flatMap((g) => [g.away.id, g.home.id]))];
  const rosters = new Map<string, RosterPlayer[]>();
  await Promise.all(
    teamIds.map(async (id) => {
      try {
        rosters.set(id, await getRoster(id));
      } catch {
        rosters.set(id, []); // one bad roster shouldn't take down the page
      }
    })
  );

  const games: GameCard[] = w.games.map((g) => {
    const venue = venueCoords(g);
    const players = [
      ...flagTeam(g, venue, rosters.get(g.away.id) ?? [], g.away, g.home),
      ...flagTeam(g, venue, rosters.get(g.home.id) ?? [], g.home, g.away),
    ].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return {
      id: g.id,
      date: g.date,
      away: g.away,
      home: g.home,
      venue: g.venue,
      place: [g.city, g.state ?? g.country].filter(Boolean).join(", "),
      neutral: g.neutral,
      statusText: g.statusText,
      state: g.gameState,
      players,
    };
  });
  return { week: w.week, games, byes: w.byes };
}
