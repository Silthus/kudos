import { useEffect, useRef } from "react";
import type { Route, SettingsSection } from "./route";

export function panelTargetAttributes(section: SettingsSection) {
  return { "data-panel-target": section };
}

export function useSectionOnceLanded(route: Route, landed: boolean) {
  const handled = useRef<Route | undefined>(undefined);
  useEffect(() => {
    if (route.page !== "settings" || route.section === undefined || !landed || handled.current === route) return;
    handled.current = route;
    const target = document.querySelector<HTMLElement>(`main [data-panel-target="${route.section}"]`);
    if (target === null) return;
    target.scrollIntoView({ block: "center" });
    target.querySelector<HTMLElement>("h2")?.focus();
  });
}
