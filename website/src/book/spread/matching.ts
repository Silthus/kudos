import { settingsSections } from "../../../../convex/website/routes";
import type { CollectionShown } from "../../collectionRead";
import type { Route } from "../../route";
import type { SettingsShown } from "../../settingsRead";
import type { MemberProfile } from "../../shell";
import { showsTheBookSpread } from "./bookSpread";

const matchingSection = "company-profile";

export function matchingSettingsHrefOf(settings: SettingsShown | undefined, sections: readonly string[] = settingsSections): string | null {
  if (settings?.kind !== "settings" || settings.admin === undefined) return null;
  return sections.includes(matchingSection) ? `/settings?section=${matchingSection}` : null;
}

export function matchingAskedOn(member: MemberProfile | undefined, route: Route, collection: CollectionShown | undefined, sections: readonly string[] = settingsSections) {
  if (member === undefined || !showsTheBookSpread(member) || route.page === "not-found" || route.page !== "book" || route.spread?.kind !== "team") return false;
  if (collection?.kind !== "collection" || collection.teams === undefined || !sections.includes(matchingSection)) return false;
  const team = route.spread.team;
  return collection.teams.some((page) => page.team === team && page.unmatched > 0);
}
