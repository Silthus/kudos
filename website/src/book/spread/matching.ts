import { settingsSections } from "../../../../convex/website/routes";
import type { SettingsShown } from "../../settingsRead";

const matchingSection = "company-profile";

export function matchingSettingsHrefOf(settings: SettingsShown | undefined, sections: readonly string[] = settingsSections): string | null {
  if (settings?.kind !== "settings" || settings.admin === undefined) return null;
  return sections.includes(matchingSection) ? `/settings?section=${matchingSection}` : null;
}
