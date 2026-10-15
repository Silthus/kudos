import type { MyLeaderboard, Period } from "./shell";

export type BoardAnswer = MyLeaderboard | { kind: "connecting" } | { kind: "broken" };

export type BoardRead = (period: Period | undefined, withGroupBoards: boolean) => BoardAnswer | undefined;
