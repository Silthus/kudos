import type { Drop } from "../crates/drops";

export type Found = { kind: "found"; at: number; key: string; drop: Drop };
