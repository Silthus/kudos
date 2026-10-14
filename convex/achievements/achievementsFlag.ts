import type { Flag } from "../analytics/flags";

export const achievementsFlag = { key: "achievements", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;
