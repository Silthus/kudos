import type { Message } from "../../../convex/activity/entries";
import type { ActivityWeek, NextStep } from "../../../convex/website/activity";
import type { MemberId } from "../../../convex/workspace/directory";
import type { ActivityWeekRead, ActivityWeekShown } from "../album/answer";

export const slackOfTheWorkspace = "https://app.slack.com/client/T1";

export const fensKudos = "https://kudos-test.slack.com/archives/C1/p1792058400000100";

const wednesday = Date.parse("2026-10-14T09:12:00Z");

const fensWords: Message = { kind: "text", segments: [{ kind: "text", text: "The demo today was brilliant, the way you explained the data model clicked for everyone." }], edited: false };

function weekWith(next: NextStep): ActivityWeek {
  return { kind: "week", next, kudos: { kudosEmoji: "hedgehug", kudosEmojiImage: null }, slack: slackOfTheWorkspace };
}

export const activityWeekFixtures = {
  empty: weekWith({ kind: "empty" }),
  quiet: weekWith({ kind: "quiet", firstHugPaysExtra: true }),
  quietWithoutRewards: weekWith({ kind: "quiet", firstHugPaysExtra: false }),
  thanked: weekWith({ kind: "thanked", giver: { person: "fen-marlowe" as MemberId, name: "Fen Marlowe", face: { kind: "initials", initials: "FM" } }, words: fensWords, permalink: fensKudos, at: wednesday }),
} satisfies Record<string, ActivityWeek>;

export function fixedActivityWeek(answer: ActivityWeekShown): ActivityWeekRead {
  return (asking) => (asking ? answer : undefined);
}

export const theWeeklyEdition: ActivityWeekRead = fixedActivityWeek({ kind: "edition" });
