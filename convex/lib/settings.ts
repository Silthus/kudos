/** Settings every newly installed workspace starts with. */
export const DEFAULT_SETTINGS = {
  // Kudos are seeds of appreciation (#168): Slack's standard seedling. It was taco before.
  emojiName: "seedling",
  emojiGlyph: "🌱",
  unitSingular: "kudos",
  unitPlural: "kudos",
  dailyLimit: 5,
  timezone: "Europe/Berlin",
  receivedVisibility: "self" as const,
  // Reacting with the kudos emoji gives a bare kudos: off for new workspaces (spec #55 §G6).
  reactionsEnabled: false,
  notifyGiver: true,
  notifyReceiver: true,
  questsEnabled: true,
  // The game is opt-in: an admin switches it on (the kill switch is the same setting).
  gameEnabled: false,
  // Kudos sprees (§G6) have their own switch, with or without the game.
  spreesEnabled: false,
};

/** The demo workspace plays the game, sprees included, and its playground shows reaction-giving (spec #55 §G1, §G16). */
export const DEMO_SETTINGS = {
  ...DEFAULT_SETTINGS,
  gameEnabled: true,
  spreesEnabled: true,
  reactionsEnabled: true,
  // Boosts are "announced" in #general: the demo has no Slack, so the admin page shows the post as a preview.
  announceChannel: { id: "C_DEMO_GENERAL", name: "general" },
};
