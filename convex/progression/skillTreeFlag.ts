import type { Flag } from "../analytics/flags";

export const skillTreeFlag = { key: "skill-tree", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
