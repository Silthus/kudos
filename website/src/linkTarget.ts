import { useEffect, useRef } from "react";
import { crateParamOf } from "../../convex/website/routes";
import type { CrateTarget, HomePanel, QuestTarget, Route, SettingsSection } from "./route";
import type { PerkNode } from "./shell";

export function questTargetAttributes(quest: QuestTarget) {
  return { "data-quest-target": quest };
}

export function crateTargetAttributes(crate: CrateTarget) {
  return { "data-crate-target": crateParamOf(crate) };
}

export function perkTargetAttributes(perk: PerkNode["perk"]) {
  return { "data-perk-target": perk };
}

export function panelTargetAttributes(panel: HomePanel | SettingsSection) {
  return { "data-panel-target": panel };
}

export type Landed = { quest: boolean; perk: boolean; crate: boolean; panel: boolean; section: boolean };

type Landing = { kind: keyof Landed; selector: string; arrive: (target: HTMLElement) => void };

function landingOf(route: Route): Landing | undefined {
  if (route.page === "quests" && route.quest !== undefined) return { kind: "quest", selector: `[data-quest-target="${route.quest}"]`, arrive: (card) => card.querySelector<HTMLElement>("h2, h3")?.focus() };
  if (route.page === "skills" && route.perk !== undefined) return { kind: "perk", selector: `[data-perk-target="${route.perk}"]`, arrive: pressThePerk };
  if (route.page === "home" && route.panel !== undefined) return { kind: "panel", selector: `[data-panel-target="${route.panel}"]`, arrive: focusTheHeading };
  if (route.page === "settings" && route.section !== undefined) return { kind: "section", selector: `[data-panel-target="${route.section}"]`, arrive: focusTheHeading };
  const crate = "crate" in route && route.crate !== undefined ? crateParamOf(route.crate) : undefined;
  if (crate !== undefined) return { kind: "crate", selector: `[data-crate-target="${crate}"]`, arrive: (target) => target.querySelector<HTMLElement>("button")?.focus() };
  return undefined;
}

function focusTheHeading(panel: HTMLElement) {
  panel.querySelector<HTMLElement>("h2")?.focus();
}

function pressThePerk(node: HTMLElement) {
  node.focus();
  node.click();
}

export function useLinkTargetOnceLanded(route: Route, landed: Landed) {
  const handled = useRef<Route | undefined>(undefined);
  useEffect(() => {
    const landing = landingOf(route);
    if (landing === undefined || !landed[landing.kind] || handled.current === route) return;
    handled.current = route;
    const target = document.querySelector<HTMLElement>(`main ${landing.selector}`);
    if (target === null) return;
    target.scrollIntoView({ block: "center" });
    landing.arrive(target);
  });
}
