import type { Flag } from "../analytics/flags";

export const customKudosEmojiFlag = { key: "custom-kudos-emoji", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;
