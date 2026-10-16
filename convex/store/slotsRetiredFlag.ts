import type { Flag } from "../analytics/flags";

export const slotsRetiredFlag = { key: "slots-retired", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
