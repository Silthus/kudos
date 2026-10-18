// PROTOTYPE (#625): radically different HedgeHug websites on today's routes, switched by ?variant=. Round 3 is 1..3 plus slack, round 2 is r2-1..r2-4, round 1 is r1-1..r1-5. Never merge to main.
export const prototypeRounds = [
  {
    round: "Round 3",
    variants: [
      { key: "1", name: "Sticker album" },
      { key: "2", name: "Team yearbook" },
      { key: "3", name: "Pocket binder" },
      { key: "slack", name: "Slack moments" },
    ],
  },
  {
    round: "Round 2",
    variants: [
      { key: "r2-1", name: "Meadow realm" },
      { key: "r2-2", name: "World map" },
      { key: "r2-3", name: "Sky island" },
      { key: "r2-4", name: "Guild hall" },
    ],
  },
  {
    round: "Round 1",
    variants: [
      { key: "r1-1", name: "Game HUD" },
      { key: "r1-2", name: "The Book" },
      { key: "r1-3", name: "Radical polish" },
      { key: "r1-4", name: "Character sheet" },
      { key: "r1-5", name: "Corkboard desk" },
    ],
  },
] as const;

type Variant = (typeof prototypeRounds)[number]["variants"][number];

export const prototypeVariants: readonly Variant[] = prototypeRounds.flatMap(({ variants }): readonly Variant[] => variants);

export type VariantKey = Variant["key"];

export const prototypeOn = Boolean(import.meta.env.VITE_SHELL_FIXTURE);

export function variantIn(search: string): VariantKey | null {
  if (!prototypeOn) return null;
  const asked = new URLSearchParams(search).get("variant");
  return prototypeVariants.find(({ key }) => key === asked)?.key ?? null;
}

export function keepingTheVariant(href: string) {
  const variant = variantIn(window.location.search);
  if (variant === null) return href;
  const address = new URL(href, window.location.origin);
  if (!address.searchParams.has("variant")) address.searchParams.set("variant", variant);
  return address.pathname + address.search + address.hash;
}
