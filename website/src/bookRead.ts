import type { MyBook } from "./shell";

export type BookShown = MyBook | { kind: "connecting" } | { kind: "broken" };

export type BookRead = (asking: boolean) => BookShown | undefined;
