import { tree } from "./tree";

export const catalogue = {
  version: "1",
  baseXp: { giver: 10, recipient: 5 },
  tree,
} as const;

export type Catalogue = typeof catalogue;
