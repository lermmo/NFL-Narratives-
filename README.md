# 🏈 Narrative Tracker

Weekly NFL spots for QB/RB/WR/TE: birthdays, hometown games, revenge games, college returns.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. vercel.com → Add New → Project → import the repo. No settings to change.
3. Done. Every `git push` redeploys.

## How it works

- **Live (every request, cached):** ESPN scoreboard (games, venues, bye teams) and team rosters
  (birthday, birthplace, college, injury status). Scoreboard cached 10 min, rosters 6 h.
- **Static (`data/`, regenerate with `npm run data`):** former teams from nflverse rosters since 2016,
  college towns from ESPN, and a US city to coordinates table. Re-run it once in a while, e.g. after trades.
- **Flags (`lib/flags.ts`):**
  - 🎂 Birthday: within 3 days of kickoff (game day scores higher)
  - 🏠 Hometown: birthplace within 40 miles of the stadium (international games match on country)
  - 😤 Revenge: opponent is a former team
  - 🎓 College: college town within 40 miles of the stadium
  - Birthday + hometown on the same player gets a big score bonus

## Tuning

- `HOMETOWN_RADIUS_MILES` env var (default 40), set in Vercel project settings.
- `BIRTHDAY_WINDOW` constant in `lib/flags.ts`.
- `data/overrides.json`: fix a wrong birthplace or add a missing former team by ESPN player id.

## Known gaps

- Former teams come from end-of-season rosters, so a mid-season trade can be missed. Use overrides.
- Revenge counts any roster stint, including practice squad.
- Birthplace is whatever ESPN lists. Some players have a city that's a bit off or missing.
- No betting lines. Narratives aren't edges: check inactives before you bet anything.
