export type Position = "QB" | "RB" | "WR" | "TE";
export type FlagType = "birthday" | "hometown" | "revenge" | "college";

export interface Flag {
  type: FlagType;
  label: string; // short badge text
  detail: string; // one-line explanation
  weight: number;
}

export interface TeamInfo {
  id: string;
  abbr: string;
  name: string;
  logo: string;
}

export interface FlaggedPlayer {
  id: string;
  name: string;
  position: Position;
  jersey?: string;
  headshot?: string;
  team: TeamInfo;
  opponent: TeamInfo;
  injury?: string;
  /** Out / IR / suspended: shown in the game list but kept out of Top spots */
  unavailable: boolean;
  flags: Flag[];
  score: number;
}

export interface GameCard {
  id: string;
  date: string; // ISO kickoff
  away: TeamInfo;
  home: TeamInfo;
  venue: string;
  place: string; // "Chicago, IL"
  neutral: boolean;
  statusText: string;
  state: "pre" | "in" | "post";
  players: FlaggedPlayer[];
}

export interface WeekData {
  week: number;
  games: GameCard[];
  byes: TeamInfo[];
}
