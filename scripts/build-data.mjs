// Builds the three static lookup files the site needs:
//   data/cities.json   "city|ST" -> [lat, lon]          (US places, for hometown + college distance)
//   data/history.json  espnId -> { TEAM: [years...] }   (former teams, for revenge games)
//   data/colleges.json espnCollegeId -> { name, city, state, lat, lon }
//
// Run with `npm run data`. Re-run whenever you want fresher history (e.g. once per season).
// The live site only calls ESPN at request time; everything here is the slow-changing stuff.

import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const require = createRequire(import.meta.url);
const OUT = new URL("../data/", import.meta.url);
await mkdir(OUT, { recursive: true });

const SKILL = new Set(["QB", "RB", "WR", "TE"]);
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const FIRST_SEASON = 2016;
const THIS_SEASON = new Date().getFullYear();

// Must stay identical to norm() in lib/geo.ts
function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/\bmt\.?\s/g, "mount ")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function pool(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// ---------- 1. cities ----------
console.log("cities…");
const all = require("all-the-cities");
const best = new Map(); // key -> {pop, coords}
for (const c of all) {
  if (c.country !== "US") continue;
  const key = `${norm(c.name)}|${c.adminCode}`;
  const prev = best.get(key);
  if (!prev || c.population > prev.pop) {
    best.set(key, { pop: c.population, coords: [round(c.loc.coordinates[1]), round(c.loc.coordinates[0])] });
  }
}
const cities = Object.fromEntries([...best].map(([k, v]) => [k, v.coords]));
function round(n) {
  return Math.round(n * 1000) / 1000;
}
await writeFile(new URL("cities.json", OUT), JSON.stringify(cities));
console.log(`  ${Object.keys(cities).length} US places`);

// ---------- 2. former-team history ----------
console.log("history…");
const TEAM_FIX = { LA: "LAR", STL: "LAR", SL: "LAR", SD: "LAC", OAK: "LV", WAS: "WSH", JAC: "JAX", ARZ: "ARI", BLT: "BAL", CLV: "CLE", HST: "HOU" };
const fixTeam = (t) => TEAM_FIX[t] ?? t;
const espnIdOf = (v) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? String(n) : "";
};

const playersCsv = parse(
  await getText("https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"),
  { columns: true, skip_empty_lines: true, relax_quotes: true }
);
const gsisToEspn = new Map();
for (const p of playersCsv) if (p.gsis_id && espnIdOf(p.espn_id)) gsisToEspn.set(p.gsis_id, espnIdOf(p.espn_id));

const seasons = [];
for (let y = FIRST_SEASON; y <= THIS_SEASON; y++) seasons.push(y);
const rosterFiles = await pool(seasons, 4, async (y) => {
  try {
    const txt = await getText(`https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_${y}.csv`);
    return { y, rows: parse(txt, { columns: true, skip_empty_lines: true, relax_quotes: true }) };
  } catch (e) {
    console.log(`  skip ${y}: ${e.message}`);
    return { y, rows: [] };
  }
});

const hist = {}; // espnId -> team -> Set(years)
for (const { y, rows } of rosterFiles) {
  for (const r of rows) {
    if (!SKILL.has(r.position)) continue;
    const id = espnIdOf(r.espn_id) || gsisToEspn.get(r.gsis_id) || "";
    if (!id || !r.team) continue;
    ((hist[id] ??= {})[fixTeam(r.team)] ??= new Set()).add(y);
  }
}
const history = {};
for (const [id, teams] of Object.entries(hist)) {
  if (Object.keys(teams).length < 2) continue; // revenge needs at least two teams
  history[id] = Object.fromEntries(Object.entries(teams).map(([t, ys]) => [t, [...ys].sort()]));
}
await writeFile(new URL("history.json", OUT), JSON.stringify(history));
console.log(`  ${Object.keys(history).length} skill players with 2+ teams`);

// ---------- 3. colleges ----------
console.log("colleges…");
const teamList = (await getJson(`${ESPN}/teams`)).sports[0].leagues[0].teams.map((t) => t.team.id);
const collegeIds = new Set();
await pool(teamList, 8, async (id) => {
  const d = await getJson(`${ESPN}/teams/${id}/roster`);
  for (const g of d.athletes ?? [])
    for (const a of g.items ?? [])
      if (SKILL.has(a.position?.abbreviation) && a.college?.id) collegeIds.add(a.college.id);
});
console.log(`  ${collegeIds.size} distinct colleges on current rosters`);

const colleges = {};
const missing = [];
await pool([...collegeIds], 8, async (cid) => {
  try {
    const t = await getJson(`https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/${THIS_SEASON}/teams/${cid}?lang=en`);
    const a = t.venue?.address;
    if (!a?.city || !a?.state) return missing.push(`${t.location ?? cid} (no venue)`);
    const coords = cities[`${norm(a.city)}|${a.state}`];
    if (!coords) return missing.push(`${t.location} (${a.city}, ${a.state})`);
    colleges[cid] = { name: t.location ?? t.displayName, city: a.city, state: a.state, lat: coords[0], lon: coords[1] };
  } catch (e) {
    // FCS / smaller schools aren't in the FBS endpoint - fine, they just can't trigger the college flag
    missing.push(`${cid} (${e.message.slice(0, 20)})`);
  }
});
await writeFile(new URL("colleges.json", OUT), JSON.stringify(colleges, null, 0));
console.log(`  ${Object.keys(colleges).length} colleges located; ${missing.length} unresolved (smaller schools)`);
console.log("done.");
