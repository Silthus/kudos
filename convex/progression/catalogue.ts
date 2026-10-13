export const catalogue = {
  version: "1",
  baseXp: { giver: 10, recipient: 5 },
} as const;

export type Catalogue = typeof catalogue;
