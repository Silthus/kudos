import type { ActivityFilter } from "./route";
import type { MyActivity } from "./shell";

export type ActivityShown = MyActivity | { kind: "broken" };

export type ActivityWatch = (filter: ActivityFilter | undefined) => ActivityShown | undefined;

export type ActivityRead = (args: { filter: ActivityFilter; cursor: string | null }) => Promise<MyActivity>;
