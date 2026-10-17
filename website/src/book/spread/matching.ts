import { settingsSections } from "../../../../convex/website/routes";
import type { CollectionShown } from "../../collectionRead";
import type { Route } from "../../route";
import type { SettingsShown } from "../../settingsRead";

const matchingSection = "company-profile";

export function matchingSettingsHrefOf(settings: SettingsShown | undefined, sections: readonly string[] = settingsSections): string | null {
  if (settings?.kind !== "settings" || settings.admin === undefined) return null;
  return sections.includes(matchingSection) ? `/settings?section=${matchingSection}` : null;
}

export function onATeamSpread(route: Route, collection: CollectionShown | undefined) {
  return route.page === "book" && route.spread?.kind === "team" && collection?.kind === "collection" && collection.teams !== undefined;
}
