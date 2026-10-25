// PROTOTYPE: shared reads for the milestones page variants. Throwaway.
import type { MilestoneId } from "../../../../convex/album/milestoneCatalogue";
import type { Album, AlbumMilestone } from "../answer";
import { hrefOf } from "../place";
import { emblemOf, milestoneNameOf, stepOf, tierEmojiOf, tierWordOf, unitOf, type MedalStep, type TierEmoji } from "../milestones";

export type Tier = AlbumMilestone["tiers"][number];

export type Medal = {
  key: string;
  milestone: AlbumMilestone;
  tier: Tier;
  step: MedalStep;
  milestoneName: string;
  metal: string;
  ladder: ReturnType<typeof emblemOf>;
  emoji: TierEmoji;
  reached: number;
  share: number;
  toGo: number;
};

export function medalsOf(album: Album): Medal[] {
  return album.milestones.flatMap((milestone) => milestone.tiers.map((tier) => medalOf(album, milestone, tier)));
}

function medalOf(album: Album, milestone: AlbumMilestone, tier: Tier): Medal {
  const reached = Math.min(milestone.count, tier.at);
  return {
    key: `${milestone.id}:${tier.tier}`,
    milestone,
    tier,
    step: stepOf(milestone, tier),
    milestoneName: milestoneNameOf(milestone.id),
    metal: tierWordOf(tier.tier),
    ladder: emblemOf(milestone.id),
    emoji: tierEmojiOf(album, milestone, tier),
    reached,
    share: tier.at === 0 ? 1 : reached / tier.at,
    toGo: Math.max(0, tier.at - milestone.count),
  };
}

export function earnedOf(album: Album) {
  return medalsOf(album)
    .filter(({ step }) => step === "earned")
    .toSorted((first, second) => (second.tier.earnedAt ?? 0) - (first.tier.earnedAt ?? 0));
}

export function nextUpOf(album: Album) {
  return medalsOf(album)
    .filter(({ step }) => step === "next")
    .toSorted((first, second) => second.share - first.share);
}

export function lockedOf(album: Album) {
  return medalsOf(album).filter(({ step }) => step === "later");
}

export function closestOf(album: Album) {
  return nextUpOf(album)[0] ?? null;
}

export function countWordsOf(medal: Medal) {
  return `${medal.reached} of ${medal.tier.at} ${unitOf(medal.milestone.id, medal.tier.at)}`;
}

export const hintOf: Record<MilestoneId, string> = {
  people: "Open thoughtful packs and put the stickers in",
  teams: "Fill a team's page, then unlock its sticker",
  reach: "Get someone from a team you haven't met yet",
  hoggies: "Hoggies drop from packs: put them in",
  thoughtful: "Thank someone in Slack and say why",
};

export type NextAction = { key: string; title: string; detail: string; href: string | null; feeds: MilestoneId[] };

export function actionsOf(album: Album): NextAction[] {
  const ready = album.teams.filter(({ state }) => state === "ready");
  const actions: NextAction[] = ready.map((team) => ({ key: `unlock:${team.team}`, title: `Unlock ${team.name}`, detail: "Everyone is in. One more full page.", href: hrefOf({ kind: "team", team: team.team }), feeds: ["teams"] }));
  if (album.packs.length > 0)
    actions.push({ key: "packs", title: `Open ${album.packs.length === 1 ? "your pack" : `${album.packs.length} packs`}`, detail: "New faces and hoggies for your album.", href: hrefOf({ kind: "packs" }), feeds: ["people", "reach", "hoggies"] });
  if (album.tray.length > 0) actions.push({ key: "tray", title: `Put in ${album.tray.length} from your tray`, detail: "They count once they're in the album.", href: null, feeds: ["people", "hoggies"] });
  actions.push({ key: "thank", title: "Thank someone and say why", detail: "Counts for Kind words and earns a pack.", href: null, feeds: ["thoughtful"] });
  return actions;
}

export function slackWordsOf({ step, emoji }: Medal) {
  if (step !== "earned") return null;
  return emoji.answered?.inSlack ? "In Slack" : "Add to Slack";
}

