import Link from "next/link";
import type { FlagType, FlaggedPlayer, GameCard, TeamInfo } from "@/lib/types";

export interface Query {
  week?: number;
  pos: string[];
  flag: string[];
}

export function href(q: Query, patch: Partial<Query>): string {
  const n = { ...q, ...patch };
  const sp = new URLSearchParams();
  if (n.week) sp.set("week", String(n.week));
  if (n.pos.length) sp.set("pos", n.pos.join(","));
  if (n.flag.length) sp.set("flag", n.flag.join(","));
  const s = sp.toString();
  return s ? `/?${s}` : "/";
}

export const FLAG_STYLE: Record<FlagType, string> = {
  birthday: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  hometown: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  revenge: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  college: "bg-sky-400/15 text-sky-300 border-sky-400/30",
};

export const FLAG_NAMES: Record<FlagType, string> = {
  birthday: "🎂 Birthday",
  hometown: "🏠 Hometown",
  revenge: "😤 Revenge",
  college: "🎓 College",
};

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Chip({ href: to, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-white/80 bg-white text-black"
          : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function WeekPicker({ q, current }: { q: Query; current: number }) {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  return (
    <nav aria-label="Week" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {weeks.map((w) => (
        <Link
          key={w}
          href={href(q, { week: w })}
          scroll={false}
          className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors ${
            w === current
              ? "border-white/80 bg-white text-black"
              : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-white"
          }`}
        >
          {w}
        </Link>
      ))}
    </nav>
  );
}

export function Filters({ q }: { q: Query }) {
  const positions = ["QB", "RB", "WR", "TE"];
  const flags: FlagType[] = ["birthday", "hometown", "revenge", "college"];
  return (
    <div className="space-y-2">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip href={href(q, { pos: [] })} active={q.pos.length === 0}>
          All positions
        </Chip>
        {positions.map((p) => (
          <Chip key={p} href={href(q, { pos: toggle(q.pos, p) })} active={q.pos.includes(p)}>
            {p}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip href={href(q, { flag: [] })} active={q.flag.length === 0}>
          All narratives
        </Chip>
        {flags.map((f) => (
          <Chip key={f} href={href(q, { flag: toggle(q.flag, f) })} active={q.flag.includes(f)}>
            {FLAG_NAMES[f]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Headshot({ p }: { p: FlaggedPlayer }) {
  return p.headshot ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.headshot} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 shrink-0 rounded-full bg-[var(--panel-2)] object-cover object-top" />
  ) : (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--panel-2)] text-sm font-semibold text-[var(--muted)]">
      {p.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </div>
  );
}

function TeamDot({ t, size = 20 }: { t: TeamInfo; size?: number }) {
  return t.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={t.logo} alt={t.abbr} width={size} height={size} loading="lazy" className="shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="text-xs font-bold">{t.abbr}</span>
  );
}

export function PlayerRow({ p, showMatchup, game }: { p: FlaggedPlayer; showMatchup?: boolean; game?: GameCard }) {
  const away = game ? game.away.abbr === p.team.abbr : false;
  return (
    <li className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <Headshot p={p} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold">{p.name}</span>
          <span className="text-xs text-[var(--muted)]">
            {p.position} · {p.team.abbr}
            {p.jersey ? ` · #${p.jersey}` : ""}
          </span>
          {p.injury && (
            <span className="rounded border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[11px] font-medium text-red-300">
              {p.injury}
            </span>
          )}
        </div>
        {showMatchup && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <TeamDot t={p.team} size={14} />
            {away ? "@" : "vs"}
            <TeamDot t={p.opponent} size={14} />
            {p.opponent.abbr}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.flags.map((f) => (
            <span key={f.type} className={`rounded-md border px-2 py-0.5 text-xs font-medium ${FLAG_STYLE[f.type]}`}>
              {f.label}
            </span>
          ))}
        </div>
        <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--muted)]">
          {p.flags.map((f) => (
            <li key={f.type}>{f.detail}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

export function GameBlock({ g }: { g: GameCard }) {
  const sep = g.neutral ? "v" : "@";
  const status = g.state === "pre" ? timeFmt.format(new Date(g.date)) : g.statusText;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamDot t={g.away} size={26} />
          <span className="font-semibold">{g.away.abbr}</span>
          <span className="text-sm text-[var(--muted)]">{sep}</span>
          <TeamDot t={g.home} size={26} />
          <span className="font-semibold">{g.home.abbr}</span>
        </div>
        <div className="shrink-0 text-right text-xs text-[var(--muted)]">
          <div className="font-medium text-[var(--text)]">{status}</div>
          <div className="max-w-[11rem] truncate">
            {g.venue}
            {g.place ? ` · ${g.place}` : ""}
          </div>
        </div>
      </header>
      {g.players.length ? (
        <ul className="space-y-2">
          {g.players.map((p) => (
            <PlayerRow key={p.id} p={p} />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-1 text-sm text-[var(--muted)]">No narratives in this one.</p>
      )}
    </section>
  );
}
