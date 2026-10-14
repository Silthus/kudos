import type { MySpotlight, Spotlight } from "./shell";

export type SpotlightAsk = { seed: number } | { after: string };

export type SpotlightDraw = (ask: SpotlightAsk) => Promise<MySpotlight>;

export type SpotlightKudos = Extract<Spotlight, { kind: "kudos" }>;
