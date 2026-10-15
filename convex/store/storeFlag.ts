import type { Flag } from "../analytics/flags";

export const storeFlag = { key: "store", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
