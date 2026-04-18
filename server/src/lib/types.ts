export interface LeaderboardRow {
  rank: string;
  name: string;
  weighStation: string;
  weightRaw: string;
  weightLb: number | null;
}

export interface PeriodSection {
  day: "Saturday" | "Sunday";
  h2: string;
  label: string;
  rows: LeaderboardRow[];
}

export interface ParsedLeaderboard {
  sourceUrl: string;
  fetchedAt: string;
  periods: PeriodSection[];
}

export interface SnapshotPayload {
  leaderboard: ParsedLeaderboard;
  fetchedAt: number;
  expiresAt: number;
}
