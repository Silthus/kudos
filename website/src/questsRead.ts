import type { MyQuests } from "./shell";

export type QuestsShown = MyQuests | { kind: "connecting" } | { kind: "broken" };

export type QuestsRead = (asking: boolean) => QuestsShown | undefined;
