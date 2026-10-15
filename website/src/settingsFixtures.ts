import type { SettingsRead, SettingsShown } from "./settingsRead";
import type { MessageSetting, MySettings } from "./shell";

const kudosReply: MessageSetting = { kind: "kudos-reply", label: "After-kudos reply", description: "What a kudos you gave earned you, right after you send it.", applies: true, on: true, place: "channel", places: ["channel", "dm", "none"] };

const levelUps: MessageSetting = { kind: "level-ups", label: "Level ups", description: "When you reach a level, with what it opens for you.", applies: true, on: true, place: "dm", places: ["dm", "channel", "none"] };

const newFeatures: MessageSetting = { kind: "new-features", label: "New features", description: "When a new feature is ready for you to open.", applies: true, on: true, place: "dm", places: ["dm", "none"] };

const celebrations: MessageSetting = { kind: "celebrations", label: "Public celebrations", description: "Your level ups and tiers in the announcement channel.", applies: true, on: true, place: "channel", places: ["channel", "none"] };

const gardeners = { group: "g_gardeners", name: "Gardeners" };

const zebras = { group: "g_zebras", name: "Zebras" };

const everything: MySettings = {
  kind: "settings",
  board: { onTheBoards: true },
  messages: [kudosReply, levelUps, newFeatures, celebrations],
  group: { primary: zebras, groups: [gardeners, zebras] },
} as MySettings;

export const settingsFixtures = { everything } as const;

export function fixedSettings(settings: SettingsShown): SettingsRead {
  return (asking) => (asking ? settings : undefined);
}
