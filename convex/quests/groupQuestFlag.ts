import type { Flag } from "../analytics/flags";

export const groupQuestFlag = { key: "group-quest", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
