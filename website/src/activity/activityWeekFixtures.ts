import type { Message } from "../../../convex/activity/entries";
import type { ActivityWeek, LastWeek, NextStep, Thanks } from "../../../convex/website/activity";
import type { MemberId } from "../../../convex/workspace/directory";
import type { ActivityWeekRead, ActivityWeekShown } from "../album/answer";

export const slackOfTheWorkspace = "https://app.slack.com/client/T1";

export const fensKudos = "https://kudos-test.slack.com/archives/C1/p1792058400000100";

export const junosMessage = "https://kudos-test.slack.com/archives/C1/p1791964800000200";

const wednesday = Date.parse("2026-10-14T09:12:00Z");

const tuesday = Date.parse("2026-10-13T15:40:00Z");

const fensWords: Message = { kind: "text", segments: [{ kind: "text", text: "The demo today was brilliant, the way you explained the data model clicked for everyone." }], edited: false };

const fen = teammate("fen-marlowe", "Fen Marlowe");

const ines = teammate("ines-duarte", "Ines Duarte");

const juno = teammate("juno-park", "Juno Park");

const lastWeek: LastWeek = { week: "2026-10-05", hugsGiven: 2, kudosGiven: 1, hugsReceived: 1 };

function teammate(person: string, name: string) {
  return { person: person as MemberId, name, face: { kind: "initials" as const, initials: name.split(" ").map((word) => word.charAt(0)).join("") } };
}

function words(text: string): Message {
  return { kind: "text", segments: [{ kind: "text", text }], edited: false };
}

function weekWith(next: NextStep, thanked: Thanks[] = [], last: LastWeek | null = null): ActivityWeek {
  return { kind: "week", next, thanked, lastWeek: last, kudos: { kudosEmoji: "hedgehug", kudosEmojiImage: null }, slack: slackOfTheWorkspace };
}

const thankedThisWeek: Thanks[] = [
  { way: "gave-you-a-kudos", from: fen, at: wednesday, words: fensWords },
  { way: "hugged-your-kudos-back", from: ines, at: tuesday + 60_000, words: words("Thanks for pairing on the webhook queue.") },
  { way: "hugged-a-kudos-you-got", from: juno, at: tuesday + 30_000, words: words("Great write-up on the retry fix.") },
  { way: "hugged-your-message", from: juno, at: tuesday, permalink: junosMessage },
];

export const activityWeekFixtures = {
  empty: weekWith({ kind: "empty" }),
  quiet: weekWith({ kind: "quiet", firstHugPaysExtra: true }),
  quietWithoutRewards: weekWith({ kind: "quiet", firstHugPaysExtra: false }),
  thanked: weekWith({ kind: "thanked", giver: fen, words: fensWords, permalink: fensKudos, at: wednesday }, thankedThisWeek, lastWeek),
  hugUnlinked: weekWith({ kind: "quiet", firstHugPaysExtra: true }, [{ way: "hugged-your-message", from: juno, at: tuesday, permalink: null }], lastWeek),
} satisfies Record<string, ActivityWeek>;

export function fixedActivityWeek(answer: ActivityWeekShown): ActivityWeekRead {
  return (asking) => (asking ? answer : undefined);
}

export const theWeeklyEdition: ActivityWeekRead = fixedActivityWeek({ kind: "edition" });
