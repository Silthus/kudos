import { useEffect, useRef } from "react";
import type { CrateTarget, QuestTarget, Route } from "./route";
import type { PerkNode } from "./shell";

export function questTargetAttributes(quest: QuestTarget) {
  return { "data-quest-target": quest };
}

export function crateTargetAttributes(crate: CrateTarget) {
  return { "data-crate-target": crate };
}

export function perkTargetAttributes(perk: PerkNode["perk"]) {
  return { "data-perk-target": perk };
}

type Landing = { selector: string; arrive: (target: HTMLElement) => void };

function landingOf(route: Route): Landing | undefined {
  if (route.page === "quests" && route.quest !== undefined) return { selector: `[data-quest-target="${route.quest}"]`, arrive: (card) => card.querySelector<HTMLElement>("h2, h3")?.focus() };
  if (route.page === "skills" && route.perk !== undefined) return { selector: `[data-perk-target="${route.perk}"]`, arrive: pressThePerk };
  if ("crate" in route && route.crate !== undefined) return { selector: `[data-crate-target="${route.crate}"]`, arrive: (crate) => crate.querySelector<HTMLElement>("button")?.focus() };
  return undefined;
}

function pressThePerk(node: HTMLElement) {
  node.focus();
  node.click();
}

export function useLinkTargetOnceLanded(route: Route, landed: boolean) {
  const handled = useRef<Route | undefined>(undefined);
  useEffect(() => {
    const landing = landingOf(route);
    if (landing === undefined || !landed || handled.current === route) return;
    handled.current = route;
    const target = document.querySelector<HTMLElement>(`main ${landing.selector}`);
    if (target === null) return;
    target.scrollIntoView({ block: "center" });
    landing.arrive(target);
  });
}
