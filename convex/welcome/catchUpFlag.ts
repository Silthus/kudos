import type { Flag } from "../analytics/flags";

export const catchUpWelcomeFlag = { key: "catch-up-welcome", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
