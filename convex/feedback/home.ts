import type { LadderFacts } from "../achievements/achievements";
import { countsOf, ladderOf, tierOf, type TierId, type TierRef } from "../achievements/ladders";
import type { Command } from "../commands/commands";
import type { HomeFacts, KudosHome } from "../engine/home";
import type { Period } from "../leaderboard/periods";
import { skillTreeLevel } from "../progression/levels";
import type { MemberPerks } from "../progression/perks";
import type { PurchaseOutcome, Refusal } from "../progression/purchases";
import { perkOf, type Perk } from "../progression/tree";
import type { ProgressSettings } from "../progression/settings";
import type { JourneyStepFacts } from "../quests/journey";
import { journeyCopyOf, journeyGoalOf } from "../quests/journeyCopy";
import { questOf } from "../quests/pool";
import type { UnopenedCrate, WeeklyQuests, WeeklySlot } from "../quests/weekly";
import type { JourneyQuest, Quest, WeeklyQuest } from "../quests/step";
import type { Feature } from "../unlocks/feature";
import { scheduled, type ScheduledFeature } from "../unlocks/schedule";
import type { UnlocksHome } from "../unlocks/unlocks";
import type { FrontDoorLinks } from "../website/link";
import type { HomeTab, ShownHome, ShownTab, ToldProgression } from "./homes";
import { renderEveryoneBoard } from "./leaderboard";
import { openTheWebsite, productName, skillPointsOf, slashCommand } from "./naming";
import type { Line } from "./segments";
import { unopenedTextOf } from "./unlockFilter";

export type HomeView = { tabBar?: Choice[]; title: string; groups: HomeLine[][] };

export type Choice = { label: string; command: Command; selected: boolean };

export type HomeAction = { label: string; command: Command };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string }
  | { kind: "choices"; choices: Choice[] }
  | { kind: "lines"; lines: Line[] }
  | { kind: "action"; text: string; action: HomeAction }
  | { kind: "pick-channel"; text: string; picked: string | null; picks: Extract<Command, { channel: unknown }>["type"] }
  | { kind: "link"; label: string; url: string }
  | { kind: "links"; links: Array<{ label: string; url: string }> };

type MemberHome = Extract<HomeFacts, { kind: "member" }>;

const tabLabels: Record<HomeTab, string> = { profile: "Profile", leaderboard: "Leaderboard", book: "Book", skillTree: "Skill tree", settings: "Settings", admin: "Admin" };

const medals: Record<TierId, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", diamond: "💎" };

const periods: Array<{ period: Period; label: string }> = [
  { period: "week", label: "This week" },
  { period: "month", label: "This month" },
  { period: "all", label: "All time" },
];

const earlierCratesShown = 5;

const noProfileFacts: ProfileFacts = { progression: null, unlocks: null, quests: null, earlierCrates: null, journey: null };

export function renderHome(facts: HomeFacts, home: ShownHome | null, frontDoor: FrontDoorLinks | null): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: productName, groups: [[{ kind: "text", text: `${productName} is for active members of this workspace.` }]] };
  }
  return frontDoor === null ? memberViewOf(facts, home) : frontDoorOf(facts, home, frontDoor);
}

function memberViewOf(facts: MemberHome, home: ShownHome | null): HomeView {
  if (home === null) return profileOf(facts, noProfileFacts);
  return { tabBar: tabBar(home.tabs, home.shown.tab), ...tabOf(facts, home.shown) };
}

function frontDoorOf(facts: MemberHome, home: ShownHome | null, links: FrontDoorLinks): HomeView {
  if (home === null) return summaryOf(facts, noProfileFacts, links);
  const { shown } = home;
  const view = shown.tab === "profile" ? summaryOf(facts, shown, links) : withWebsiteLink(tabOf(facts, shown), links.home);
  return { tabBar: tabBar(home.tabs, shown.tab), ...view };
}

function withWebsiteLink(view: HomeView, website: string): HomeView {
  return { ...view, groups: [...view.groups, [{ kind: "link", label: openTheWebsite, url: website }]] };
}

function tabBar(tabs: HomeTab[], selected: HomeTab): Choice[] {
  return tabs.map((tab) => ({ label: tabLabels[tab], command: { type: "showHomeTab", tab }, selected: tab === selected }));
}

function tabOf(facts: MemberHome, shown: ShownTab): HomeView {
  switch (shown.tab) {
    case "profile":
      return profileOf(facts, shown);
    case "leaderboard":
      return { title: "Leaderboard", groups: [[periodChoices(shown.period), { kind: "lines", lines: renderEveryoneBoard(shown.board, shown.period) }]] };
    case "book":
      return { title: "Book", groups: bookGroups(shown) };
    case "skillTree":
      return { title: "Skill tree", groups: skillTreeGroups(shown.perks) };
    case "settings":
      return { title: "Settings", groups: settingsGroups(shown) };
    case "admin":
      return { title: "Admin", groups: adminGroups(shown) };
  }
}

type ProfileFacts = Omit<Extract<ShownTab, { tab: "profile" }>, "tab">;

function profileOf(kudos: KudosHome, { progression, unlocks, quests, earlierCrates, journey }: ProfileFacts): HomeView {
  const progress = progression === null ? [] : [[...progressOf(progression), ...(unlocks === null ? [] : unlockLinesOf(unlocks))]];
  const weekly = quests === null || quests.slots.length === 0 ? [] : [weeklyQuestLines(quests, { cratesShownApart: false })];
  const earlier = earlierCrates === null || earlierCrates.length === 0 ? [] : [waitingToOpenLines(earlierCrates)];
  const steps = journey === null || journey.length === 0 ? [] : [journey.flatMap(journeyStepLines)];
  return { title: "Your kudos", groups: [[allowanceOf(kudos)], ...progress, ...weekly, ...earlier, ...steps, [totalsOf(kudos)], howToGive(kudos.kudosEmoji)] };
}

function summaryOf(kudos: KudosHome, { progression, unlocks, quests, earlierCrates, journey }: ProfileFacts, links: FrontDoorLinks): HomeView {
  const status = [allowanceOf(kudos), ...(progression === null ? [] : [levelLineOf(progression)])];
  const waiting = [...readyCratesOf(unlocks), ...earlierCratesOf(earlierCrates), ...weeklyCratesOf(quests), ...journeyCratesOf(journey), ...moreEarlierCrates(earlierCrates ?? [])];
  const weekly = quests === null || quests.slots.length === 0 ? [] : [weeklyQuestLines(quests, { cratesShownApart: true })];
  return { title: "Your kudos", groups: [status, ...(waiting.length === 0 ? [] : [waiting]), ...weekly, [websiteButtonsOf(links)], howToGive(kudos.kudosEmoji)] };
}

function levelLineOf({ level, xpToNextLevel, skillPoints }: ToldProgression): HomeLine {
  const skillTree = skillPoints === null || level < skillTreeLevel ? "" : ` · ${skillPointsOf(skillPoints)} to spend`;
  return { kind: "text", text: `Level ${level} · ${xpToNextLevel} XP to level ${level + 1}${skillTree}` };
}

function readyCratesOf(unlocks: UnlocksHome | null): HomeLine[] {
  return (unlocks?.ready ?? []).map(({ feature, name }) => ({ kind: "action", text: `${bold(name)} is ready.`, action: openUnlock(feature) }));
}

function earlierCratesOf(crates: UnopenedCrate[] | null): HomeLine[] {
  return (crates ?? []).slice(0, earlierCratesShown).map(({ crate, goal }) => ({ kind: "action", text: `✅ ${goal}`, action: openCrate(crate) }));
}

function moreEarlierCrates(crates: UnopenedCrate[]): HomeLine[] {
  const more = crates.length - earlierCratesShown;
  if (more <= 0) return [];
  return [{ kind: "hint", text: more === 1 ? "1 more crate from earlier weeks waits to open." : `${more} more crates from earlier weeks wait to open.` }];
}

function weeklyCratesOf(quests: WeeklyQuests | null): HomeLine[] {
  if (quests === null) return [];
  const unopened = quests.slots.filter(({ finishedAt, openedAt }) => finishedAt !== null && openedAt === null);
  return unopened.map(({ slot, goal }) => ({ kind: "action", text: `✅ ${goal}`, action: openCrate({ kind: "weekly", week: quests.week, slot }) }));
}

function journeyCratesOf(journey: JourneyStepFacts[] | null): HomeLine[] {
  const unopened = (journey ?? []).filter(({ finishedAt, openedAt }) => finishedAt !== null && openedAt === null);
  return unopened.map(({ step }) => ({ kind: "action", text: `✅ ${journeyGoalOf(step)}`, action: openCrate({ kind: "journey", step }) }));
}

function websiteButtonsOf({ home, pages }: FrontDoorLinks): HomeLine {
  return { kind: "links", links: [{ label: `Open ${productName}`, url: home }, ...pages] };
}

function periodChoices(selected: Period): HomeLine {
  return { kind: "choices", choices: periods.map(({ period, label }) => ({ label, command: { type: "showLeaderboard", period }, selected: period === selected })) };
}

function bookGroups({ book, timeZone }: Extract<ShownTab, { tab: "book" }>): HomeLine[][] {
  return book.ladders.map((facts) => ladderLines(facts, timeZone));
}

function ladderLines({ ladder, name, count, tiers, next }: LadderFacts, timeZone: string | undefined): HomeLine[] {
  const earnedLines = tiers.flatMap(({ tier, name: tierName, earnedAt }): HomeLine[] =>
    earnedAt === null ? [] : [{ kind: "text", text: `${medals[tier]} ${bold(tierName)} · earned ${dateOf(earnedAt, timeZone)}` }],
  );
  const nextTier = tiers.find(({ tier }) => tier === next);
  const nextLine: HomeLine[] = nextTier === undefined ? [] : [{ kind: "hint", text: `Next: ${bold(nextTier.name)} at ${nextTier.count} ${countsOf(ladder, nextTier.count)}.` }];
  return [{ kind: "text", text: `${bold(name)} · ${bold(count)} ${countsOf(ladder, count)}` }, ...earnedLines, ...nextLine];
}

export function tiersEarnedLines(tiers: TierRef[]): string[] {
  const earned = tiers.map((ref) => `🏅 You earned ${tierOf(ref).name} (${ladderOf(ref.ladder).name}, ${ref.tier}).`);
  const ladders = [...new Set(tiers.map(({ ladder }) => ladder))];
  return [...earned, ...ladders.flatMap((ladder) => nextTierLine(ladder, tiers.filter((ref) => ref.ladder === ladder)))];
}

function nextTierLine(ladder: TierRef["ladder"], told: TierRef[]): string[] {
  const { tiers } = ladderOf(ladder);
  const highest = Math.max(...told.map(({ tier }) => tiers.findIndex((entry) => entry.tier === tier)));
  const next = tiers[highest + 1];
  return next === undefined ? [] : [`Next: ${next.name} at ${next.count} ${countsOf(ladder, next.count)}.`];
}

function dateOf(at: number, timeZone: string | undefined) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timeZone ?? "UTC", month: "short", day: "numeric", year: "numeric" }).format(at);
}

function skillTreeGroups({ skillPoints, perks }: MemberPerks): HomeLine[][] {
  const condition: HomeLine = { kind: "hint", text: "Bonuses count when your message has 5 or more words besides mentions and emoji." };
  return [[{ kind: "text", text: `You have ${bold(skillPointsOf(skillPoints))} to spend.` }], [...perks.flatMap(perkLines), condition]];
}

function perkLines(perk: TreePerk): HomeLine[] {
  const { name, copy, state } = perk;
  if (state === "owned") return [{ kind: "text", text: `✅ ${bold(name)} · Owned\n${copy}` }];
  if (state === "buyable") return [{ kind: "action", ...perkOfferOf(perk) }];
  return [{ kind: "text", text: perkTextOf(perk) }, { kind: "hint", text: whyNotOf({ ...perk, state }) }];
}

export function perkOfferOf(perk: Perk): { text: string; action: HomeAction } {
  return { text: perkTextOf(perk), action: { label: "Buy", command: { type: "buyPerk", perk: perk.perk } } };
}

function perkTextOf({ name, skillPoints, copy }: Perk) {
  return `${bold(name)} · ${skillPointsOf(skillPoints)}\n${copy}`;
}

export function purchaseReplyOf(outcome: PurchaseOutcome) {
  const perk = perkOf(outcome.perk);
  return outcome.kind === "bought" ? `You bought ${perk.name}.` : `I couldn't buy ${perk.name}. ${whyNotOf({ ...perk, state: outcome.reason })}`;
}

type TreePerk = MemberPerks["perks"][number];

export function whyNotOf({ state, row, requires, skillPoints }: Perk & { state: Refusal }) {
  switch (state) {
    case "tree-locked":
      return unopenedTextOf(scheduled("skillTree"), "locked");
    case "tree-ready":
      return unopenedTextOf(scheduled("skillTree"), "ready");
    case "owned":
      return "You own it.";
    case "retired":
      return "It's no longer sold.";
    case "below-row":
      return `It opens at level ${row}.`;
    case "needs-prerequisite":
      return `You need ${perkOf(requires!).name} first.`;
    case "no-skill-points":
      return `You need ${skillPointsOf(skillPoints)}.`;
  }
}

function settingsGroups({ onTheBoards, progress, achievements }: Extract<ShownTab, { tab: "settings" }>): HomeLine[][] {
  const leaderboard = onTheBoards === null ? [] : [leaderboardSwitch(onTheBoards)];
  const copy = settingCopyOf(achievements);
  const progression = progress === null ? [] : [[setting(copy, progress, "muteNotices"), setting(copy, progress, "dms")]];
  return [...leaderboard, ...progression];
}

function leaderboardSwitch(onTheBoards: boolean): HomeLine[] {
  return [
    { kind: "text", text: bold("Show me on the leaderboards") },
    {
      kind: "choices",
      choices: [
        { label: "On", command: { type: "setLeaderboardVisibility", visible: true }, selected: onTheBoards },
        { label: "Off", command: { type: "setLeaderboardVisibility", visible: false }, selected: !onTheBoards },
      ],
    },
    { kind: "hint", text: "When it's off, nobody sees you on the leaderboards, you included." },
  ];
}

type SettingCopy = Record<"whenOn" | "whenOff", { text: string; label: string }>;

function settingCopyOf(achievements: boolean): Record<keyof ProgressSettings, SettingCopy> {
  return {
    muteNotices: {
      whenOn: { text: "I don't post public notices about you.", label: "Unmute notices" },
      whenOff: { text: `I celebrate your ${celebrated(achievements)} in public.`, label: "Mute notices" },
    },
    dms: {
      whenOn: { text: achievements ? "I send you a DM when you reach a level or earn an achievement." : "I send you a DM when you reach a level.", label: "Turn off DMs" },
      whenOff: { text: "I don't send you DMs.", label: "Turn on DMs" },
    },
  };
}

function celebrated(achievements: boolean) {
  return achievements ? "level ups and achievements" : "level ups";
}

function setting(copy: Record<keyof ProgressSettings, SettingCopy>, settings: ProgressSettings, key: keyof ProgressSettings): HomeLine {
  const on = settings[key];
  const { text, label } = copy[key][on ? "whenOn" : "whenOff"];
  return { kind: "action", text, action: { label, command: { type: "setProgressSettings", ...changeOf(key, !on) } } };
}

function changeOf(key: keyof ProgressSettings, value: boolean): Partial<ProgressSettings> {
  return { [key]: value };
}

function adminGroups({ announcementChannel, achievements }: Extract<ShownTab, { tab: "admin" }>): HomeLine[][] {
  const what = celebrated(achievements);
  const channelLines = announcementChannel === null ? threadLines(what) : announcementChannelLines(what, announcementChannel);
  return [channelLines, [{ kind: "hint", text: "Only workspace admins and owners see this tab." }]];
}

function threadLines(what: string): HomeLine[] {
  const text = `I celebrate ${what} in a thread under each kudos message. Pick a channel to post them there instead.`;
  return [{ kind: "pick-channel", text, picked: null, picks: "setAnnouncementChannel" }];
}

function announcementChannelLines(what: string, channel: string): HomeLine[] {
  return [
    { kind: "pick-channel", text: `I celebrate ${what} in this channel.`, picked: channel, picks: "setAnnouncementChannel" },
    {
      kind: "action",
      text: "Or celebrate them in a thread under each kudos message again.",
      action: { label: "Use threads", command: { type: "setAnnouncementChannel", channel: null } },
    },
  ];
}

function allowanceOf({ left, base }: KudosHome): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function progressOf({ level, xpToNextLevel, skillPoints, skillTreeTab }: ToldProgression): HomeLine[] {
  const levelFigures: HomeLine = { kind: "fields", fields: [figure("Level", level), figure(`XP to level ${level + 1}`, xpToNextLevel)] };
  if (skillPoints === null || level < skillTreeLevel) return [levelFigures];
  const spentWhere = skillTreeTab ? `to spend in the ${bold("Skill tree")} tab` : "saved for the skill tree";
  return [levelFigures, { kind: "text", text: `You have ${bold(skillPointsOf(skillPoints))} ${spentWhere}.` }];
}

function unlockLinesOf({ ready, next }: UnlocksHome): HomeLine[] {
  const readyLines = ready.map((feature): HomeLine => ({ kind: "action", ...readyCrateOf(feature) }));
  const nextLine: HomeLine[] = next === null ? [] : [{ kind: "text", text: `Next: ${next.name} at level ${next.level}.` }];
  return [...readyLines, ...nextLine];
}

function weeklyQuestLines({ week, slots, swapAvailable }: WeeklyQuests, { cratesShownApart }: { cratesShownApart: boolean }): HomeLine[] {
  const asksToSayWhy = slots.some(({ quest, finishedAt }) => finishedAt === null && questOf(quest).progress.given.saysWhy);
  const condition: HomeLine[] = asksToSayWhy ? [{ kind: "hint", text: "Saying why counts when your message has 5 or more words besides mentions and emoji." }] : [];
  return [{ kind: "text", text: bold("Quests this week") }, ...slots.map((slot) => weeklyQuestLine(week, slot, swapAvailable, cratesShownApart)), ...condition];
}

function weeklyQuestLine(week: string, { slot, goal, reward, progress, target, finishedAt, openedAt }: WeeklySlot, swapAvailable: boolean, crateShownApart: boolean): HomeLine {
  if (finishedAt === null) {
    const text = `${goal} ${bold(`${progress}/${target}`)} · ${bold(`${reward.xp} XP`)}`;
    return swapAvailable ? { kind: "action", text, action: swapQuest({ kind: "weekly", week, slot }) } : { kind: "text", text };
  }
  const text = `✅ ${goal} ${earned(reward.xp)}`;
  return openedAt === null && !crateShownApart ? { kind: "action", text, action: openCrate({ kind: "weekly", week, slot }) } : { kind: "text", text };
}

function waitingToOpenLines(crates: UnopenedCrate[]): HomeLine[] {
  const shown = crates.slice(0, earlierCratesShown).map(({ crate, goal, reward }): HomeLine => ({ kind: "action", text: `✅ ${goal} ${earned(reward.xp)}`, action: openCrate(crate) }));
  return [{ kind: "text", text: bold("Waiting to open") }, ...shown, ...moreEarlierCrates(crates)];
}

function journeyStepLines({ step, reward, finishedAt, openedAt }: JourneyStepFacts): HomeLine[] {
  const { goal, hint } = journeyCopyOf(step);
  if (finishedAt !== null) {
    const text = `${bold("Journey:")} ✅ ${goal} ${earned(reward.xp)}`;
    return [openedAt === null ? { kind: "action", text, action: openCrate({ kind: "journey", step }) } : { kind: "text", text }];
  }
  const active: HomeLine = { kind: "text", text: `${bold("Journey:")} ${goal} It pays ${bold(`${reward.xp} XP`)}.` };
  return hint === null ? [active] : [active, { kind: "hint", text: hint }];
}

export function finishedQuestCrateOf(quest: JourneyQuest, xp: number): { text: string; action: HomeAction } {
  return { text: `✅ You finished a Journey step: ${journeyGoalOf(quest.step)} ${earned(xp)}`, action: openCrate(quest) };
}

export function finishedWeeklyQuestCrateOf(quest: WeeklyQuest, goal: string, xp: number): { text: string; action: HomeAction } {
  return { text: `✅ You finished a quest: ${goal} ${earned(xp)}`, action: openCrate(quest) };
}

function swapQuest(quest: WeeklyQuest): HomeAction {
  return { label: "Swap", command: { type: "rerollQuest", quest } };
}

function openCrate(quest: Quest): HomeAction {
  return { label: "Open", command: { type: "openQuestCrate", quest } };
}

function earned(xp: number) {
  return `You earned ${bold(`${xp} XP`)}.`;
}

export function readyCrateOf({ feature, name, opens }: ScheduledFeature): { text: string; action: HomeAction } {
  return { text: `${bold(name)} is ready. It opens ${opens}.`, action: openUnlock(feature) };
}

function openUnlock(feature: Feature): HomeAction {
  return { label: "Open", command: { type: "openUnlock", feature } };
}

function totalsOf(kudos: KudosHome): HomeLine {
  return {
    kind: "fields",
    fields: [
      figure("Given this week", kudos.givenWeek),
      figure("Received this week", kudos.receivedWeek),
      figure("Given in total", kudos.given),
      figure("Received in total", kudos.received),
    ],
  };
}

function howToGive(kudosEmoji: string): HomeLine[] {
  const emoji = `:${kudosEmoji}:`;
  return [
    { kind: "hint", text: `To give kudos, mention a teammate and add ${emoji} to your message. Each ${emoji} gives everyone you mention 1 kudos.` },
    { kind: "hint", text: `To add me to a channel, type \`${slashCommand}\` there.` },
  ];
}

function figure(label: string, count: number) {
  return `${bold(label)}\n${bold(count)}`;
}

function bold(text: string | number) {
  return `*${text}*`;
}
