// PROTOTYPE (#625, round 3) the yearbook's album address: which section and page the hash names. Never merge to main.
import { useCallback, useEffect, useState } from "react";
import type { Rarity } from "../../../../../convex/hoggies/catalogue";
import { keepingTheVariant } from "../../variants";

export type Spot = { kind: "team"; team: string | null } | { kind: "person"; key: string } | { kind: "hoggies"; rarity: Rarity | null } | { kind: "packs" };

const rarityNames: ReadonlySet<string> = new Set(["common", "uncommon", "rare", "epic", "legendary"]);

export function spotOf(hash: string): Spot {
  const [section = "", ...rest] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  const page = rest.join("/");
  if (section === "people" && page !== "") return { kind: "person", key: page };
  if (section === "hoggies") return { kind: "hoggies", rarity: rarityNames.has(page) ? (page as Rarity) : null };
  if (section === "packs") return { kind: "packs" };
  return { kind: "team", team: section === "teams" && page !== "" ? page : null };
}

export function hrefOfSpot(spot: Spot) {
  if (spot.kind === "person") return `/book#people/${spot.key}`;
  if (spot.kind === "hoggies") return spot.rarity === null ? "/book#hoggies" : `/book#hoggies/${spot.rarity}`;
  if (spot.kind === "packs") return "/book#packs";
  return spot.team === null ? "/book" : `/book#teams/${spot.team}`;
}

export function useHash() {
  const [, setSeen] = useState(0);
  useEffect(() => {
    const rerender = () => setSeen((seen) => seen + 1);
    window.addEventListener("hashchange", rerender);
    window.addEventListener("popstate", rerender);
    return () => {
      window.removeEventListener("hashchange", rerender);
      window.removeEventListener("popstate", rerender);
    };
  }, []);
  const flipTo = useCallback((href: string) => {
    window.history.replaceState(window.history.state, "", keepingTheVariant(href));
    setSeen((seen) => seen + 1);
  }, []);
  return { hash: window.location.hash, flipTo };
}
