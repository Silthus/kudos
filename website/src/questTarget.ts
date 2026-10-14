import { useEffect, useRef } from "react";
import type { QuestTarget, Route } from "./route";

export function questTargetAttributes(quest: QuestTarget) {
  return { "data-quest-target": quest };
}

export function useQuestTargetOnceLanded(route: Route, landed: boolean) {
  const handled = useRef<Route | undefined>(undefined);
  useEffect(() => {
    if (route.page !== "quests" || route.quest === undefined || !landed || handled.current === route) return;
    handled.current = route;
    const card = document.querySelector<HTMLElement>(`main [data-quest-target="${route.quest}"]`);
    if (card === null) return;
    card.scrollIntoView({ block: "center" });
    card.querySelector<HTMLElement>("h2, h3")?.focus();
  });
}
