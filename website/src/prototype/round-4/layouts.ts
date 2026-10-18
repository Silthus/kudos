// PROTOTYPE (#625, round 4): the three layouts every deep page offers, picked by ?variant=4a|4b|4c. Never merge to main.
import type { ReactNode } from "react";

export const layouts = ["A", "B", "C"] as const;

export type Layout = (typeof layouts)[number];

export type PageLayouts<Props extends object = object> = Record<Layout, { name: string; Page: (props: Props) => ReactNode }>;
