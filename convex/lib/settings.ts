/** Settings every newly installed workspace starts with. */
export const DEFAULT_SETTINGS = {
  emojiName: "taco",
  emojiGlyph: "🌮",
  unitSingular: "kudos",
  unitPlural: "kudos",
  dailyLimit: 5,
  timezone: "Europe/Berlin",
  receivedVisibility: "self" as const,
  reactionsEnabled: true,
  notifyGiver: true,
  notifyReceiver: true,
  questsEnabled: true,
  // The game is opt-in: an admin switches it on (the kill switch is the same setting).
  gameEnabled: false,
};

/** The demo workspace plays the game (spec #55 §G1). */
export const DEMO_SETTINGS = { ...DEFAULT_SETTINGS, gameEnabled: true };
