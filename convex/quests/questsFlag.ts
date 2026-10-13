import type { Flag } from "../analytics/flags";

export const questsFlag = { key: "quests", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;
