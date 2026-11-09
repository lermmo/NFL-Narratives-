import type { TeamInfo } from "./types";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

async function getJson<T = any>(url: string, revalidate: number): Promise<T> {
  const r = await fetch(url, { next: { revalidate } });
  if (!r.ok) throw new Error(`ESPN ${r.status}: ${url}`);
  return r.json() as Promise<T>;
}

export interface RawGame {
  id: string;
  date: string;
  away: TeamInfo;
  home: TeamInfo;
  venue: string;
  city?: string;
  state?: string;
  country?: string;
  neutral: boolean;
  statusText: string;
  gameState: "pre" | "in" | "post";
}

const toTeam = (t: any): TeamInfo => ({
  id: String(t.id),
  abbr: t.abbreviation,
  name: t.displayName ?? t.name,
  logo: t.logo ?? "",
});

/** Scoreboard for a regular-season week. Omit `week` to get ESPN's current week. */
export async function getWeek(week?: number): Promise<{ week: number; games: RawGame[]; byes: TeamInfo[] }> {
  const q = week ? `?seasontype=2&week=${week}&limit=50` : "?limit=50";
  const d = await getJson(`${BASE}/scoreboard${q}`, 600);
  const games: RawGame[] = (d.events ?? []).map((e: any) => {
    const c = e.competitions[0];
    const home = c.competitors.find((x: any) => x.homeAway === "home");
    const away = c.competitors.find((x: any) => x.homeAway === "away");
    return {
      id: String(e.id),
      date: e.date,
      away: toTeam(away.team),
      home: toTeam(home.team),
      venue: c.venue?.fullName ?? "",
      city: c.venue?.address?.city,
      state: c.venue?.address?.state,
      country: c.venue?.address?.country,
      neutral: !!c.neutralSite,
      statusText: e.status?.type?.shortDetail ?? "",
      gameState: e.status?.type?.state ?? "pre",
    };
  });
  games.sort((a, b) => a.date.localeCompare(b.date));
  return {
    week: d.week?.number ?? week ?? 1,
    games,
    byes: (d.week?.teamsOnBye ?? []).map(toTeam),
  };
}

export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  jersey?: string;
  headshot?: string;
  dob?: string; // YYYY-MM-DD
  birthCity?: string;
  birthState?: string;
  birthCountry?: string;
  collegeId?: string;
  collegeName?: string;
  injury?: string;
}

const SKILL = new Set(["QB", "RB", "WR", "TE"]);

export async function getRoster(teamId: string): Promise<RosterPlayer[]> {
  const d = await getJson(`${BASE}/teams/${teamId}/roster`, 6 * 3600);
  const out: RosterPlayer[] = [];
  for (const g of d.athletes ?? []) {
    for (const a of g.items ?? []) {
      const pos = a.position?.abbreviation;
      if (!SKILL.has(pos)) continue;
      const inj = a.injuries?.[0]?.status as string | undefined;
      out.push({
        id: String(a.id),
        name: a.fullName ?? a.displayName,
        position: pos,
        jersey: a.jersey,
        headshot: a.headshot?.href,
        // ESPN stores local midnight as UTC (e.g. 2002-08-19T07:00Z) so the date part is the real birthday
        dob: typeof a.dateOfBirth === "string" ? a.dateOfBirth.slice(0, 10) : undefined,
        birthCity: a.birthPlace?.city,
        birthState: a.birthPlace?.state,
        birthCountry: a.birthPlace?.country,
        collegeId: a.college?.id ? String(a.college.id) : undefined,
        collegeName: a.college?.name,
        injury: inj && inj.toLowerCase() !== "active" ? inj : undefined,
      });
    }
  }
  return out;
}
