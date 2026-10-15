import type { MondayPost, PostedGroup } from "../leaderboard/mondayPost";
import { asWritten } from "./groupCopy";
import { medalOf } from "./leaderboard";
import type { Line } from "./segments";

export function renderMondayPost({ groups, mostImproved, givers }: MondayPost): Line[] {
  const mostImprovedLine: Line[] = mostImproved === null ? [] : [[{ text: `📈 Most improved: ${asWritten({ name: mostImproved })}` }]];
  return [[{ text: "🏆 Last week in kudos" }], ...groups.map(groupLine), ...mostImprovedLine, [{ text: `${peopleCount(givers)} gave kudos last week. Thank you!` }]];
}

function groupLine(group: PostedGroup): Line {
  return [{ text: `${medalOf(group.rank)} ${asWritten(group)} · ${group.perMember.toFixed(1)} per person` }];
}

function peopleCount(givers: number) {
  return givers === 1 ? "1 person" : `${givers} people`;
}
