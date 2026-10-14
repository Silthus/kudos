import type { Flag } from "../analytics/flags";

export const groupsFlag = { key: "groups", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
