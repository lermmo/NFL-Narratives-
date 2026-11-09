import { buildWeek } from "@/lib/flags";
import type { FlaggedPlayer, GameCard } from "@/lib/types";
import { Filters, GameBlock, PlayerRow, WeekPicker, type Query } from "@/components/ui";

type SP = { week?: string; pos?: string; flag?: string };

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/New_York",
});

function split(v?: string) {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const wk = Number(sp.week);
  const q: Query = {
    week: Number.isInteger(wk) && wk >= 1 && wk <= 18 ? wk : undefined,
    pos: split(sp.pos).map((s) => s.toUpperCase()),
    flag: split(sp.flag).map((s) => s.toLowerCase()),
  };

  let data;
  try {
    data = await buildWeek(q.week);
  } catch {
    return (
      <Shell>
        <p className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
          Couldn&apos;t reach ESPN just now. Refresh in a minute.
        </p>
      </Shell>
    );
  }
  const qq: Query = { ...q, week: data.week };

  // apply filters
  const keep = (p: FlaggedPlayer) =>
    (q.pos.length === 0 || q.pos.includes(p.position)) &&
    (q.flag.length === 0 || p.flags.some((f) => q.flag.includes(f.type)));
  const games: GameCard[] = data.games.map((g) => ({ ...g, players: g.players.filter(keep) }));

  const all = games.flatMap((g) => g.players.map((p) => ({ p, g })));
  const top = [...all].sort((a, b) => b.p.score - a.p.score).filter((x) => x.p.score >= 3 && !x.p.unavailable).slice(0, 8);

  // group by ET day
  const days = new Map<string, GameCard[]>();
  for (const g of games) {
    const k = dayFmt.format(new Date(g.date));
    days.set(k, [...(days.get(k) ?? []), g]);
  }

  return (
    <Shell>
      <div className="space-y-3">
        <WeekPicker q={qq} current={data.week} />
        <Filters q={qq} />
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Week {data.week}: <span className="font-semibold text-[var(--text)]">{all.length}</span> flagged player
        {all.length === 1 ? "" : "s"} across {games.length} games
      </p>

      {top.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Top spots</h2>
          <ul className="space-y-2">
            {top.map(({ p, g }) => (
              <PlayerRow key={p.id} p={p} game={g} showMatchup />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 space-y-6">
        {[...days].map(([day, gs]) => (
          <div key={day}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{day}</h2>
            <div className="space-y-3">
              {gs.map((g) => (
                <GameBlock key={g.id} g={g} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {data.byes.length > 0 && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">Bye:</span> {data.byes.map((t) => t.abbr).join(", ")}
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">🏈 Narrative Tracker</h1>
      <p className="mb-5 mt-1 text-sm text-[var(--muted)]">Birthdays · hometowns · revenge · college returns</p>
      {children}
      <footer className="mt-10 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
        For fun with friends. Narratives aren&apos;t edges: check inactives before you bet anything. Data: ESPN, nflverse.
      </footer>
    </main>
  );
}
