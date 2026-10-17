// PROTOTYPE (#625): five radically different HedgeHug websites on today's routes, switched by ?variant=1..5. Never merge to main.
export const prototypeVariants = [
  { key: "1", name: "Game HUD" },
  { key: "2", name: "The Book" },
  { key: "3", name: "Radical polish" },
  { key: "4", name: "Character sheet" },
  { key: "5", name: "Corkboard desk" },
] as const;

export type VariantKey = (typeof prototypeVariants)[number]["key"];

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
