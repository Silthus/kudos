import type { LadderFacts } from "../achievements/achievements";
import { countsOf, ladderOf, tierOf, type TierId, type TierRef } from "../achievements/ladders";
import type { TierRewardsTold } from "../achievements/tierRewards";
import type { Command } from "../commands/commands";
import type { HomeFacts, KudosHome } from "../engine/home";
import type { GroupChoice } from "../groups/pick";
import type { GroupId, GroupRef } from "../groups/groups";
import type { AvatarChoice } from "../hoggies/avatar";
import { rarityLabel } from "../hoggies/catalogue";
import type { GroupModeFacts } from "../groups/groupMode";
import type { MondayPostSwitch } from "../leaderboard/mondayPost";
import { timeZonesOffered } from "../leaderboard/timeZones";
import type { Period } from "../leaderboard/periods";
import { skillTreeLevel } from "../progression/levels";
import { ownsEveryPerk, type MemberPerks } from "../progression/perks";
import type { PurchaseOutcome, Refusal } from "../progression/purchases";
import { hasCoinPrice, perkOf, type Perk } from "../progression/tree";
import type { MessageKind, MessagePlace } from "../messageSettings/kinds";
import type { MessageSetting, NotificationSwitches } from "../messageSettings/messageSettings";
import { journeyGoalOf } from "../quests/journeyCopy";
import { rewardKeyOf } from "../quests/crates";
import { questOf } from "../quests/pool";
import type { WeekKey } from "../quests/week";
import type { GroupQuest, WaitingGroupCrate } from "../quests/groupQuest";
import type { UnopenedCrate, WeeklyQuests, WeeklySlot } from "../quests/weekly";
import type { JourneyQuest, Quest, WeeklyQuest } from "../quests/step";
import type { Feature } from "../unlocks/feature";
import { itemOf, priceOf, type CatalogueItem } from "../store/catalogue";
import type { CustomKudosEmojiPicker } from "../store/customKudosEmoji";
import type { InventoryHome, StoreItem } from "../store/inventory";
import type { ItemRefusal } from "../store/rows";
import { scheduled, type ScheduledFeature } from "../unlocks/schedule";
import type { UnlocksHome } from "../unlocks/unlocks";
import type { FrontDoorLinks } from "../website/link";
import { boughtCratePageOf, crateOfferPageOf, earlierWeekCratePageOf, questCratePageOf, readyCratePageOf, urlOf, weeklyCratePageOf, type Page, type SettingsSection } from "../website/routes";
import { coinsPartOf, inCoins } from "./coins";
import type { CrateStoreShown, HoggiesShown, HomeTab, JourneyStepShown, ShownHome, ShownTab, ToldProgression } from "./homes";
import { countsFor, pickQuestion } from "./groupCopy";
import { renderBoards } from "./leaderboard";
import { openTheWebsite, productName, skillPointsOf, slashCommand } from "./naming";
import { medals } from "./medals";
import type { Line } from "./segments";
import { avatarText, hoggieLabel } from "./avatar";
import { unopenedTextOf } from "./unlockFilter";

export type HomeView = { tabBar?: Choice[]; title: string; groups: HomeLine[][] };

export type Choice = { label: string; command: Command; selected: boolean };

export type Confirmation = { title: string; text: string; confirm: string; deny: string };

export type HomeAction = CommandAction | LinkAction;

export type CommandAction = { label: string; command: Command; accessibilityLabel?: string; confirm?: Confirmation };

export type LinkAction = { label: string; url: string; accessibilityLabel: string; id: string };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string }
  | { kind: "choices"; choices: Choice[] }
  | { kind: "lines"; lines: Line[] }
  | { kind: "action"; text: string; action: HomeAction }
  | { kind: "pick-channel"; text: string; picked: string | null; picks: Extract<Command, { channel: unknown }>["type"] }
  | { kind: "pick-group"; text: string; groups: GroupRef[]; picked: GroupId }
  | { kind: "pick-groups"; text: string; groups: GroupModeFacts["groups"]; picked: GroupModeFacts["allowlist"] }
  | { kind: "pick-custom-emoji"; text: string; picked: string[] }
  | { kind: "pick"; id: string; text: string; placeholder: string; options: Choice[] }
  | { kind: "link"; label: string; url: string }
  | { kind: "links"; links: Array<{ label: string; url: string }> };

type MemberHome = Extract<HomeFacts, { kind: "member" }>;

const tabLabels: Record<HomeTab, string> = { profile: "Profile", leaderboard: "Leaderboard", book: "Book", skillTree: "Skill tree", inventory: "Inventory", settings: "Settings", admin: "Admin" };

const periods: Array<{ period: Period; label: string }> = [
  { period: "week", label: "This week" },
  { period: "month", label: "This month" },
  { period: "all", label: "All time" },
];

const earlierCratesShown = 5;

const pageNames: Record<Page["page"], string> = { home: "home", leaderboard: "Leaderboard", quests: "Quests", skillTree: "Skill tree", book: "Book", bookEarned: "Book", bookCollection: "Collection", settings: "Settings" };

type HomeSection = Exclude<SettingsSection, "company-profile" | "admin">;

const sectionLinks: Record<HomeSection, { label: string; spoken: string }> = {
  visibility: { label: "Leaderboards", spoken: "Change whether you show on the leaderboards" },
  messages: { label: "Messages", spoken: "Change what I send you" },
  group: { label: "Your group", spoken: "Change the group you count for" },
};

type SectionLinks = (section: HomeSection) => HomeLine[];

const noSectionLinks: SectionLinks = () => [];

const noProfileFacts: ProfileFacts = { progression: null, unlocks: null, quests: null, groupQuest: null, earlierCrates: null, earlierGroupCrates: null, journey: null, hoggies: null, boughtCrates: null };

export function renderHome(facts: HomeFacts, home: ShownHome | null, frontDoor: FrontDoorLinks | null): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: productName, groups: [[{ kind: "text", text: `${productName} is for active members of this workspace.` }]] };
  }
  return frontDoor === null ? memberViewOf(facts, home) : frontDoorOf(facts, home, frontDoor);
}

function memberViewOf(facts: MemberHome, home: ShownHome | null): HomeView {
  if (home === null) return profileOf(facts, noProfileFacts);
  return { tabBar: tabBar(home.tabs, home.shown.tab), ...tabOf(facts, home.shown, noSectionLinks) };
}

function frontDoorOf(facts: MemberHome, home: ShownHome | null, links: FrontDoorLinks): HomeView {
  if (home === null) return summaryOf(facts, noProfileFacts, links);
  const { shown } = home;
  const view = shown.tab === "profile" ? summaryOf(facts, shown, links) : withWebsiteLink(frontDoorTabOf(facts, shown, links), urlOf(links.origin, { page: "home" }));
  return { tabBar: tabBar(home.tabs, shown.tab), ...view };
}

function frontDoorTabOf(facts: MemberHome, shown: ShownTab, links: FrontDoorLinks): HomeView {
  const view = tabOf(facts, shown, sectionLinksOf(links));
  return shown.tab === "inventory" ? { ...view, groups: [[inventoryOnTheWeb(links.origin)], ...view.groups] } : view;
}

function sectionLinksOf({ origin, sections }: FrontDoorLinks): SectionLinks {
  return (section) => (sections.includes(section) ? [sectionOnTheWeb(section, origin)] : []);
}

function sectionOnTheWeb(section: HomeSection, website: string): HomeLine {
  const action = linkOnTheWeb({ ...sectionLinks[section], id: `settings:${section}` }, { page: "settings", section }, website);
  return { kind: "action", text: "You can change this on the web, too.", action };
}

function inventoryOnTheWeb(website: string): HomeLine {
  const action = linkOnTheWeb({ label: "Inventory", spoken: "Open your inventory", id: "inventory" }, { page: "home", panel: "inventory" }, website);
  return { kind: "action", text: "Your inventory is on the web, too.", action };
}

function withWebsiteLink(view: HomeView, website: string): HomeView {
  return { ...view, groups: [...view.groups, [{ kind: "link", label: openTheWebsite, url: website }]] };
}

function tabBar(tabs: HomeTab[], selected: HomeTab): Choice[] {
  return tabs.map((tab) => ({ label: tabLabels[tab], command: { type: "showHomeTab", tab }, selected: tab === selected }));
}

function tabOf(facts: MemberHome, shown: ShownTab, sectionLinksTo: SectionLinks): HomeView {
  switch (shown.tab) {
    case "profile":
      return profileOf(facts, shown);
    case "leaderboard":
      return { title: "Leaderboard", groups: leaderboardGroups(shown) };
    case "book":
      return { title: "Book", groups: bookGroups(shown) };
    case "skillTree":
      return { title: "Skill tree", groups: skillTreeGroups(shown) };
    case "inventory":
      return { title: "Inventory", groups: inventoryGroups(shown) };
    case "settings":
      return { title: "Settings", groups: settingsGroups(shown, sectionLinksTo) };
    case "admin":
      return { title: "Admin", groups: adminGroups(shown) };
  }
}

function leaderboardGroups({ period, board, groups, myGroup }: Extract<ShownTab, { tab: "leaderboard" }>): HomeLine[][] {
  const [first = [], ...rest] = renderBoards(groups, myGroup, board, period).map(({ lines }) => lines);
  return [[periodChoices(period), { kind: "lines", lines: first }], ...rest.map((lines): HomeLine[] => [{ kind: "lines", lines }])];
}

type ProfileFacts = Omit<Extract<ShownTab, { tab: "profile" }>, "tab">;

function profileOf(kudos: KudosHome, { progression, unlocks, quests, groupQuest, earlierCrates, earlierGroupCrates, journey, hoggies, boughtCrates }: ProfileFacts): HomeView {
  const progress = progression === null ? [] : [[...progressOf(progression), ...(unlocks === null ? [] : unlockLinesOf(unlocks))]];
  const weekly = questsThisWeek(quests, groupQuest, { cratesShownApart: false, website: null });
  const waitingToOpen = waitingToOpenLines(earlierCrates ?? [], earlierGroupCrates ?? [], boughtCrates ?? []);
  const earlier = waitingToOpen.length === 0 ? [] : [waitingToOpen];
  const steps = journey === null || journey.length === 0 ? [] : [journey.flatMap(journeyStepLines)];
  return { title: "Your kudos", groups: [[allowanceOf(kudos)], ...progress, ...weekly, ...earlier, ...steps, ...hoggiesLinesOf(hoggies, null), [totalsOf(kudos)], howToGive(kudos.kudosEmoji)] };
}

function summaryOf(kudos: KudosHome, { progression, unlocks, quests, groupQuest, earlierCrates, earlierGroupCrates, journey, hoggies, boughtCrates }: ProfileFacts, links: FrontDoorLinks): HomeView {
  const status = [allowanceOf(kudos), ...(progression === null ? [] : [levelLineOf(progression)])];
  const { origin } = links;
  const earlier = cappedEarlierCrates(earlierCratesOf(earlierCrates, origin), earlierGroupCrates, origin);
  const collectionPage = hoggies === null ? null : origin;
  const waiting = [...readyCratesOf(unlocks, origin), ...earlier.shown, ...weeklyCratesOf(quests, origin), ...journeyCratesOf(journey, origin), ...earlier.more, ...boughtCratesLines(boughtCrates ?? [], collectionPage)];
  const weekly = questsThisWeek(quests, groupQuest, { cratesShownApart: true, website: origin });
  return { title: "Your kudos", groups: [status, ...(waiting.length === 0 ? [] : [waiting]), ...hoggiesLinesOf(hoggies, origin), ...weekly, [websiteButtonsOf(links)], howToGive(kudos.kudosEmoji)] };
}

function levelLineOf({ level, xpToNextLevel, skillPoints, coins }: ToldProgression): HomeLine {
  const skillTree = skillPoints === null || level < skillTreeLevel ? "" : ` · ${skillPointsOf(skillPoints)} to spend`;
  const wallet = coins === null ? "" : ` · ${inCoins(coins)}`;
  return { kind: "text", text: `Level ${level} · ${xpToNextLevel} XP to level ${level + 1}${skillTree}${wallet}` };
}

function readyCratesOf(unlocks: UnlocksHome | null, website: string): HomeLine[] {
  return (unlocks?.ready ?? []).map(({ feature, name }) => ({ kind: "action", text: `${bold(name)} is ready.`, action: openUnlock(feature, website) }));
}

function earlierCratesOf(crates: UnopenedCrate[] | null, website: string): HomeLine[] {
  return (crates ?? []).map(({ crate, week, goal, reward, waiting }) => ({ kind: "action", text: `${weekLabelOf(week)} ✅ ${goal}${waitingPartOf(reward.xp, waiting)}`, action: openCrate(crate, website, earlierWeekCratePageOf(crate)) }));
}

function cappedEarlierCrates(weekly: HomeLine[], groupCrates: WaitingGroupCrate[] | null, website: string | null): { shown: HomeLine[]; more: HomeLine[] } {
  const lines = [...weekly, ...(groupCrates ?? []).map((crate) => earlierGroupCrateLine(crate, website))];
  return { shown: lines.slice(0, earlierCratesShown), more: moreEarlierCrates(lines.length - earlierCratesShown) };
}

function weekLabelOf(week: WeekKey) {
  const monday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(Date.parse(week));
  return bold(`Week of ${monday}:`);
}

function moreEarlierCrates(more: number): HomeLine[] {
  if (more <= 0) return [];
  return [{ kind: "hint", text: more === 1 ? "1 more crate from earlier weeks waits to open." : `${more} more crates from earlier weeks wait to open.` }];
}

function weeklyCratesOf(quests: WeeklyQuests | null, website: string): HomeLine[] {
  if (quests === null) return [];
  const unopened = quests.slots.filter(({ finishedAt, openedAt }) => finishedAt !== null && openedAt === null);
  return unopened.map(({ slot, goal, reward, waiting }) => ({ kind: "action", text: `✅ ${goal}${waitingPartOf(reward.xp, waiting)}`, action: openCrate({ kind: "weekly", week: quests.week, slot }, website) }));
}

function journeyCratesOf(journey: JourneyStepShown[] | null, website: string): HomeLine[] {
  const unopened = (journey ?? []).filter(({ finishedAt, openedAt }) => finishedAt !== null && openedAt === null);
  return unopened.map(({ step, reward, waiting }) => ({ kind: "action", text: `✅ ${journeyGoalOf(step)}${waitingPartOf(reward.xp, waiting)}`, action: openCrate({ kind: "journey", step }, website) }));
}

function waitingPartOf(xp: number, waiting: boolean) {
  return waiting ? ` · ${xp} XP waits in your crate` : "";
}

function hoggiesLinesOf(hoggies: HoggiesShown | null, website: string | null): HomeLine[][] {
  if (hoggies === null) return [];
  const text = `Hoggies: ${hoggies.owned} of ${hoggies.total}${crestsPartOf(hoggies)} · ${lastFoundPartOf(hoggies)}`;
  const line: HomeLine = website === null ? { kind: "text", text } : { kind: "action", text, action: linkOnTheWeb({ label: "View", spoken: "View your hoggies", id: "hoggies" }, { page: "bookCollection" }, website) };
  return [[line, ...avatarLinesOf(hoggies.avatar), ...crateOfferLines(hoggies.crateStore, website)]];
}

function avatarLinesOf(choice: AvatarChoice | null): HomeLine[] {
  if (choice === null || choice.held.length === 0) return [];
  const { avatar, held } = choice;
  const none: Choice[] = avatar === null ? [] : [{ label: "No avatar", command: { type: "setAvatar", hoggie: null }, selected: false }];
  const options = held.map((hoggie): Choice => ({ label: hoggieLabel(hoggie), command: { type: "setAvatar", hoggie: hoggie.hoggie }, selected: hoggie.hoggie === avatar?.hoggie }));
  const text = avatar === null ? "Pick a hoggie you hold as your avatar." : avatarText(avatar);
  return [{ kind: "pick", id: "setAvatar", text, placeholder: "Use as avatar", options: [...none, ...options] }];
}

function crateOfferLines(store: CrateStoreShown | null, website: string | null): HomeLine[] {
  if (store === null) return [];
  const action = buyACrate(store, website);
  const short: HomeLine[] = store.short !== null && store.short > 0 ? [{ kind: "hint", text: `You need ${store.short} more 🪙.` }] : [];
  return [{ kind: "action", text: "A crate drops one hoggie when you open it.", action }, ...short];
}

function buyACrate({ price, next }: CrateStoreShown, website: string | null): HomeAction {
  const label = `Buy a crate · ${coinsOf(price)}`;
  const spoken = `Buy a crate for ${price} coins`;
  if (website !== null) return linkOnTheWeb({ label, spoken, id: "crate-store" }, crateOfferPageOf(), website);
  const confirm = { title: `Buy a crate for ${coinsOf(price)}?`, text: "Coins are never refunded.", confirm: "Buy", deny: "Cancel" };
  return { label, command: { type: "buyCrate", next }, accessibilityLabel: spoken, confirm };
}

function boughtCratesLines([oldest, ...others]: string[], website: string | null): HomeLine[] {
  if (oldest === undefined) return [];
  const text = others.length === 0 ? "A crate you bought" : `${others.length + 1} crates you bought`;
  return [{ kind: "action", text, action: openBoughtCrate(oldest, website) }];
}

function openBoughtCrate(crate: string, website: string | null): HomeAction {
  const spoken = "Open a crate you bought";
  if (website === null) return { label: "Open", command: { type: "openCrate", crate }, accessibilityLabel: spoken };
  return linkOnTheWeb({ label: "Open", spoken, id: crate }, boughtCratePageOf(crate), website);
}

function crestsPartOf({ crests }: HoggiesShown) {
  return crests === null ? "" : ` · ${crests} ${crests === 1 ? "crest" : "crests"}`;
}

function lastFoundPartOf({ lastFound }: HoggiesShown) {
  return lastFound === null ? "every crate you open drops one." : `last found: ${lastFound.name} (${rarityLabel(lastFound.rarity)})`;
}

function websiteButtonsOf({ origin, pages }: FrontDoorLinks): HomeLine {
  return { kind: "links", links: [{ label: `Open ${productName}`, url: urlOf(origin, { page: "home" }) }, ...pages] };
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

export function tiersEarnedLines(told: TierRef[], everyTierEarned: TierRef[], rewardsOf: (ref: TierRef) => TierRewardsTold): string[] {
  const earnedLines = told.map((ref) => `🏅 You earned ${tierOf(ref).name} (${ladderOf(ref.ladder).name}, ${ref.tier}).${tierRewardsPartOf(rewardsOf(ref))}`);
  const ladders = [...new Set(told.map(({ ladder }) => ladder))];
  return [...earnedLines, ...ladders.flatMap((ladder) => nextTierLine(ladder, [...told, ...everyTierEarned]))];
}

function tierRewardsPartOf({ coins, items }: TierRewardsTold) {
  const coinsPart = coins === 0 ? [] : [coinsPartOf(coins)];
  const itemParts = items.flatMap((item) => itemOf(item) ?? []).map(({ emoji, name }) => `+ :${emoji}: ${name} for your kudos emoji`);
  return [...coinsPart, ...itemParts].map((part) => ` ${part}`).join("");
}

function nextTierLine(ladder: TierRef["ladder"], earned: TierRef[]): string[] {
  const next = ladderOf(ladder).tiers.find(({ tier }) => !earned.some((ref) => ref.ladder === ladder && ref.tier === tier));
  return next === undefined ? [] : [`Next: ${next.name} at ${next.count} ${countsOf(ladder, next.count)}.`];
}

function dateOf(at: number, timeZone: string | undefined) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timeZone ?? "UTC", month: "short", day: "numeric", year: "numeric" }).format(at);
}

function skillTreeGroups({ perks: tree, coinsName }: Extract<ShownTab, { tab: "skillTree" }>): HomeLine[][] {
  const condition: HomeLine = { kind: "hint", text: "Bonuses count when your message has 5 or more words besides mentions and emoji." };
  const toSpend: HomeLine[][] = ownsEveryPerk(tree) ? [] : [[{ kind: "text", text: `You have ${bold(skillPointsOf(tree.skillPoints))} to spend.` }]];
  return [...toSpend, [...tree.perks.flatMap((perk) => perkLines(perk, coinsName)), condition]];
}

function perkLines(perk: TreePerk, coinsName: string): HomeLine[] {
  const { name, copy, state } = perk;
  if (state === "owned") return [{ kind: "text", text: [`✅ ${bold(name)} · Owned`, copy].filter(Boolean).join("\n") }];
  if (state === "buyable") return [{ kind: "action", ...perkOfferOf(perk, null) }];
  return [{ kind: "text", text: perkTextOf(perk) }, { kind: "hint", text: whyNotOf({ ...perk, state }, coinsName) }];
}

type RefusalLines = { after: (item: CatalogueItem) => HomeLine[]; unplaced: HomeLine[] };

function inventoryGroups({ balance, inventory, kudosEmoji, refused }: Extract<ShownTab, { tab: "inventory" }>): HomeLine[][] {
  const told = refusalLinesOf(inventory, refused, balance);
  return [[{ kind: "text", text: inCoins(balance) }], ...yourKudosEmojiGroupsOf(inventory, told, kudosEmoji), ...storeLinesOf(inventory, told), ...notYoursYetLinesOf(inventory)];
}

function yourKudosEmojiGroupsOf({ owned }: InventoryHome, told: RefusalLines, kudosEmoji: string): HomeLine[][] {
  const heading: HomeLine = { kind: "text", text: bold("Your kudos emoji") };
  const ownedLines = owned.flatMap((item): HomeLine[] => [{ kind: "text", text: itemLabelOf(item) }, ...told.after(item)]);
  return [[heading, ...ownedLines, { kind: "hint", text: `Each of your kudos emoji counts as a kudos, like :${kudosEmoji}:.` }]];
}

function storeLinesOf({ store }: InventoryHome, { after, unplaced }: RefusalLines): HomeLine[][] {
  const heading: HomeLine = { kind: "text", text: bold("Store") };
  const lines = [...store.flatMap((item): HomeLine[] => [{ kind: "action", ...itemOfferOf(item) }, ...after(item)]), ...unplaced];
  return [[heading, ...(lines.length > 0 ? lines : [{ kind: "hint", text: "Nothing for sale right now." } satisfies HomeLine])]];
}

function notYoursYetLinesOf({ notYoursYet }: InventoryHome): HomeLine[][] {
  if (notYoursYet.length === 0) return [];
  return [[{ kind: "text", text: bold("Not yours yet") }, ...notYoursYet.map((item): HomeLine => ({ kind: "text", text: `${itemLabelOf(item)} · Silver in ${ladderOf(item.source.ladder).name}` }))]];
}

function itemOfferOf(item: StoreItem): { text: string; action: HomeAction } {
  const [label, price] = [itemLabelOf(item), coinsOf(item.source.price)];
  const confirm = { title: `Buy ${label} for ${price}?`, text: "Coins are never refunded.", confirm: "Buy", deny: "Cancel" };
  return { text: `${label} · ${price}`, action: { label: "Buy", command: { type: "buyItem", item: item.item }, accessibilityLabel: `Buy ${item.name}`, confirm } };
}

function refusalLinesOf(inventory: InventoryHome, refused: ItemRefusal | null, balance: number): RefusalLines {
  const lines: HomeLine[] = refused === null ? [] : refusalTextOf(refused, balance).map((text) => ({ kind: "hint", text }));
  const isRefused = (item: CatalogueItem) => item.item === refused?.item;
  const placed = [...inventory.owned, ...inventory.store].some(isRefused);
  const unplaced = lines.map((line) => namingTheItem(line, refusedItemIn(inventory, refused)));
  return { after: (item) => (isRefused(item) ? lines : []), unplaced: placed ? [] : unplaced };
}

function refusedItemIn({ customShown }: InventoryHome, refused: ItemRefusal | null): CatalogueItem | undefined {
  if (refused === null) return undefined;
  return itemOf(refused.item) ?? customShown.find(({ item }) => item === refused.item);
}

function namingTheItem(line: HomeLine, item: CatalogueItem | undefined): HomeLine {
  return item === undefined || line.kind !== "hint" ? line : { ...line, text: line.text.replace(/^It /, `${itemLabelOf(item)} `) };
}

function refusalTextOf({ item, reason }: ItemRefusal, balance: number): string[] {
  switch (reason) {
    case "no-coins": {
      const short = (priceOf(item) ?? 0) - balance;
      return short > 0 ? [`You need ${short} more 🪙.`] : [];
    }
    case "owned":
      return ["You already own it."];
    case "not-for-sale":
      return ["It isn't for sale."];
    case "coins-not-open":
      return [];
  }
}

function itemLabelOf({ art, name }: CatalogueItem) {
  return art.kind === "unicode" ? `${art.glyph} ${name}` : name;
}

export function perkOfferOf(perk: Perk, website: string | null): { text: string; action: HomeAction } {
  return { text: perkTextOf(perk), action: buyPerk(perk, website) };
}

function buyPerk(perk: Perk, website: string | null): HomeAction {
  const spoken = `Buy ${perk.name}`;
  if (website === null) return { label: "Buy", command: { type: "buyPerk", perk: perk.perk }, accessibilityLabel: spoken, confirm: purchaseConfirmationOf(perk) };
  return linkOnTheWeb({ label: "Buy", spoken, id: `buy:${perk.perk}` }, { page: "skillTree" }, website);
}

function purchaseConfirmationOf({ name, skillPoints, coins }: Perk): Confirmation {
  const text = hasCoinPrice({ coins })
    ? `This spends ${skillPointsOf(skillPoints)} and ${coinsOf(coins)}. Skill points and coins are never refunded.`
    : `This spends ${skillPointsOf(skillPoints)}. Skill points are never refunded.`;
  return { title: `Buy ${name}?`, text, confirm: "Buy", deny: "Cancel" };
}

function perkTextOf({ name, skillPoints, coins, copy }: Perk) {
  const price = hasCoinPrice({ coins }) ? `${skillPointsOf(skillPoints)} · ${coinsOf(coins)}` : skillPointsOf(skillPoints);
  return `${bold(name)} · ${price}\n${copy}`;
}

function coinsOf(coins: number) {
  return `${coins} 🪙`;
}

export function purchaseReplyOf(outcome: PurchaseOutcome, coinsName = scheduled("coins").name) {
  const perk = perkOf(outcome.perk);
  return outcome.kind === "bought" ? `You bought ${perk.name}.` : `I couldn't buy ${perk.name}. ${whyNotOf({ ...perk, state: outcome.reason }, coinsName)}`;
}

type TreePerk = MemberPerks["perks"][number];

export function whyNotOf({ state, row, requires, skillPoints, coins }: Perk & { state: Refusal }, coinsName = scheduled("coins").name) {
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
    case "coins-not-open":
      return `Open ${coinsName} first.`;
    case "no-coins":
      return `You need ${coinsOf(coins)}.`;
  }
}

function settingsGroups({ onTheBoards, progress, messages, achievements, channelPicked, groups }: Extract<ShownTab, { tab: "settings" }>, sectionLinksTo: SectionLinks): HomeLine[][] {
  const leaderboard = onTheBoards === null ? [] : [[...leaderboardSwitch(onTheBoards), ...sectionLinksTo("visibility")]];
  const primaryGroup = groups === null ? [] : [[primaryGroupSetting(groups), ...sectionLinksTo("group")]];
  const copy = settingCopyOf(achievements, channelPicked);
  const progression = progress === null ? [] : [[setting(copy, progress, "muteNotices"), setting(copy, progress, "dms")]];
  const sent = messages === null ? [] : [[...whatISendYouOf(messages), ...sectionLinksTo("messages")]];
  return [...leaderboard, ...primaryGroup, ...progression, ...sent];
}

function primaryGroupSetting({ primary, groups }: GroupChoice): HomeLine {
  if (groups.length === 1) return { kind: "text", text: countsFor(primary) };
  return { kind: "pick-group", text: pickQuestion, groups, picked: primary.group };
}

function whatISendYouOf(messages: MessageSetting[]): HomeLine[] {
  return [{ kind: "text", text: bold("What I send you") }, ...messages.map(messageSettingLineOf)];
}

function messageSettingLineOf({ kind, label, description, on, place, places }: MessageSetting): HomeLine {
  const text = on ? `${bold(label)} — ${description}` : `${bold(label)} · Off — ${description}`;
  const options = places.map((each) => ({ label: placeLabelOf(kind, each), command: { type: "setMessageSetting" as const, kind, place: each }, selected: each === place }));
  return { kind: "pick", id: `message-place:${kind}`, text, placeholder: `Where I get ${label}`, options };
}

function placeLabelOf(kind: MessageKind, place: MessagePlace) {
  if (place === "none") return "None";
  if (place === "dm") return "As a DM";
  return kind === "celebrations" ? "In the announcement channel" : "In the channel";
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

function settingCopyOf(achievements: boolean, channelPicked: boolean): Record<keyof NotificationSwitches, SettingCopy> {
  const what = celebrated(achievements);
  return {
    muteNotices: {
      whenOn: { text: "I don't post public notices about you.", label: "Unmute notices" },
      whenOff: { text: channelPicked ? `I celebrate your ${what} in public.` : `I'll celebrate your ${what} in public once your workspace picks a channel.`, label: "Mute notices" },
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

function setting(copy: Record<keyof NotificationSwitches, SettingCopy>, settings: NotificationSwitches, key: keyof NotificationSwitches): HomeLine {
  const on = settings[key];
  const { text, label } = copy[key][on ? "whenOn" : "whenOff"];
  return { kind: "action", text, action: { label, command: { type: "setProgressSettings", ...changeOf(key, !on) } } };
}

function changeOf(key: keyof NotificationSwitches, value: boolean): Partial<NotificationSwitches> {
  return { [key]: value };
}

function adminGroups({ announcementChannel, achievements, groupMode, mondayPost, customKudosEmoji }: Extract<ShownTab, { tab: "admin" }>): HomeLine[][] {
  const what = celebrated(achievements);
  const channelLines = announcementChannel === null ? noChannelLines(what) : announcementChannelLines(what, announcementChannel);
  const groupModeLines = groupMode === null ? [] : [groupModeLinesOf(groupMode)];
  const mondayPostLines = mondayPost === null ? [] : [mondayPostLinesOf(mondayPost)];
  const customKudosEmojiLines = customKudosEmoji === null ? [] : [customKudosEmojiLinesOf(customKudosEmoji)];
  return [channelLines, ...groupModeLines, ...mondayPostLines, ...customKudosEmojiLines, [{ kind: "hint", text: "Only workspace admins and owners see this tab." }]];
}

function mondayPostLinesOf({ channel, on, timeZone, cantPost }: MondayPostSwitch): HomeLine[] {
  const where = `<#${channel}>`;
  const heading: HomeLine = { kind: "text", text: bold("Monday post") };
  const cantPostNote: HomeLine[] = cantPost ? [{ kind: "text", text: `I can't post in ${where}. Add me to it or pick another channel.` }] : [];
  if (!on) {
    const switchOn: HomeLine = { kind: "action", text: `I can post last week's top groups in ${where} every Monday at 9:00.`, action: { label: "Switch on", command: { type: "setMondayPost", on: true } } };
    return [heading, switchOn, ...cantPostNote];
  }
  const switchOff: HomeLine = { kind: "action", text: `Every Monday I post last week's top groups in ${where}.`, action: { label: "Switch off", command: { type: "setMondayPost", on: false } } };
  return [heading, switchOff, timeZonePickOf(timeZone), ...cantPostNote];
}

function timeZonePickOf(picked: string): HomeLine {
  const options = timeZonesOffered(picked).map((timeZone) => ({ label: timeZone.replaceAll("_", " "), command: { type: "setMondayPost" as const, on: true, timeZone }, selected: timeZone === picked }));
  return { kind: "pick", id: "setMondayPost", text: "I post it at 9:00 in this time zone.", placeholder: "Pick a time zone", options };
}

function customKudosEmojiLinesOf(picker: CustomKudosEmojiPicker): HomeLine[] {
  const pick: HomeLine =
    picker.kind === "reinstall"
      ? { kind: "text", text: "Reinstall the app to pick custom emoji." }
      : { kind: "pick-custom-emoji", text: "Pick custom emoji members can buy as kudos emoji for 100 🪙.", picked: picker.picked };
  return [{ kind: "text", text: bold("Custom kudos emoji") }, pick];
}

function groupModeLinesOf({ mode, groups, allowlist }: GroupModeFacts): HomeLine[] {
  const modes: HomeLine = {
    kind: "choices",
    choices: [
      { label: "Every group", command: { type: "setGroupMode", mode: "all" }, selected: mode === "all" },
      { label: "Only these groups", command: { type: "setGroupMode", mode: "allowlist" }, selected: mode === "allowlist" },
    ],
  };
  const picker: HomeLine[] = mode === "allowlist" ? [{ kind: "pick-groups", text: "Pick the groups that count.", groups, picked: allowlist }] : [];
  return [{ kind: "text", text: bold("Groups that count") }, modes, ...picker];
}

function noChannelLines(what: string): HomeLine[] {
  const text = `I don't celebrate ${what} in public yet. Pick a channel to celebrate them there.`;
  return [{ kind: "pick-channel", text, picked: null, picks: "setAnnouncementChannel" }];
}

function announcementChannelLines(what: string, channel: string): HomeLine[] {
  return [
    { kind: "pick-channel", text: `I celebrate ${what} in this channel.`, picked: channel, picks: "setAnnouncementChannel" },
    { kind: "action", text: "Or stop celebrating them in public.", action: { label: "Stop posting", command: { type: "setAnnouncementChannel", channel: null } } },
  ];
}

function allowanceOf({ left, base }: KudosHome): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function progressOf({ level, xpToNextLevel, skillPoints, skillTreeTab, coins }: ToldProgression): HomeLine[] {
  const wallet = coins === null ? [] : [figure("Coins", inCoins(coins))];
  const levelFigures: HomeLine = { kind: "fields", fields: [figure("Level", level), figure(`XP to level ${level + 1}`, xpToNextLevel), ...wallet] };
  if (skillPoints === null || level < skillTreeLevel) return [levelFigures];
  const spentWhere = skillTreeTab ? `to spend in the ${bold("Skill tree")} tab` : "saved for the skill tree";
  return [levelFigures, { kind: "text", text: `You have ${bold(skillPointsOf(skillPoints))} ${spentWhere}.` }];
}

function unlockLinesOf({ ready, next }: UnlocksHome): HomeLine[] {
  const readyLines = ready.map((feature): HomeLine => ({ kind: "action", ...readyCrateOf(feature, null) }));
  const nextLine: HomeLine[] = next === null ? [] : [{ kind: "text", text: `Next: ${next.name} at level ${next.level}.` }];
  return [...readyLines, ...nextLine];
}

type QuestRows = { cratesShownApart: boolean; website: string | null };

function questsThisWeek(quests: WeeklyQuests | null, groupQuest: GroupQuest | null, rows: QuestRows): HomeLine[][] {
  const slots = quests === null ? [] : quests.slots.map((slot) => weeklyQuestLine(quests.week, slot, { swapAvailable: quests.swapAvailable, ...rows }));
  const together = groupQuest === null ? [] : [groupQuestLine(groupQuest, rows.website)];
  if (slots.length + together.length === 0) return [];
  const condition: HomeLine[] = asksToSayWhy(quests, groupQuest) ? [{ kind: "hint", text: "Saying why counts when your message has 5 or more words besides mentions and emoji." }] : [];
  return [[{ kind: "text", text: bold("Quests this week") }, ...slots, ...together, ...condition]];
}

function asksToSayWhy(quests: WeeklyQuests | null, groupQuest: GroupQuest | null): boolean {
  const personal = (quests?.slots ?? []).some(({ quest, finishedAt }) => finishedAt === null && questOf(quest).progress.given.saysWhy);
  return personal || (groupQuest !== null && !groupQuest.done && groupQuest.quest === "together-say-why");
}

function groupQuestLine({ group, week, goal, tookPart, target, done, crate }: GroupQuest, website: string | null): HomeLine {
  const text = `${group.name} quest: ${goal} · ${tookPart} of ${target} took part${done ? " · ✅" : ""}`;
  if (crate === null || crate.opened) return { kind: "text", text };
  return { kind: "action", text, action: openCrate({ kind: "group", group: group.group, week }, website) };
}

function weeklyQuestLine(week: string, { slot, goal, reward, progress, target, finishedAt, openedAt, waiting }: WeeklySlot, { swapAvailable, cratesShownApart, website }: QuestRows & { swapAvailable: boolean }): HomeLine {
  if (finishedAt === null) {
    const text = `${goal} ${bold(`${progress}/${target}`)} · ${bold(`${reward.xp} XP`)}`;
    return swapAvailable ? { kind: "action", text, action: swapQuest({ kind: "weekly", week, slot }, website) } : { kind: "text", text };
  }
  const text = `✅ ${goal} ${rewardTold(reward.xp, waiting)}`;
  return openedAt === null && !cratesShownApart ? { kind: "action", text, action: openCrate({ kind: "weekly", week, slot }, null) } : { kind: "text", text };
}

function waitingToOpenLines(crates: UnopenedCrate[], groupCrates: WaitingGroupCrate[], bought: string[]): HomeLine[] {
  if (crates.length + groupCrates.length + bought.length === 0) return [];
  const weekly = crates.map(({ crate, week, goal, reward, waiting }): HomeLine => ({ kind: "action", text: `${weekLabelOf(week)} ✅ ${goal} ${rewardTold(reward.xp, waiting)}`, action: openCrate(crate, null) }));
  const { shown, more } = cappedEarlierCrates(weekly, groupCrates, null);
  return [{ kind: "text", text: bold("Waiting to open") }, ...shown, ...more, ...boughtCratesLines(bought, null)];
}

function earlierGroupCrateLine({ crate, group, goal }: WaitingGroupCrate, website: string | null): HomeLine {
  return { kind: "action", text: `${weekLabelOf(crate.week)} ✅ ${group} quest: ${goal}`, action: openCrate(crate, website, earlierWeekCratePageOf(crate)) };
}

function journeyStepLines({ step, goal, hint, reward, finishedAt, openedAt, waiting }: JourneyStepShown): HomeLine[] {
  if (finishedAt !== null) {
    const text = `${bold("Journey:")} ✅ ${goal} ${rewardTold(reward.xp, waiting)}`;
    return [openedAt === null ? { kind: "action", text, action: openCrate({ kind: "journey", step }, null) } : { kind: "text", text }];
  }
  const active: HomeLine = { kind: "text", text: `${bold("Journey:")} ${goal} It pays ${bold(`${reward.xp} XP`)}.` };
  return hint === null ? [active] : [active, { kind: "hint", text: hint }];
}

export function finishedQuestCrateOf(quest: JourneyQuest, xp: number, waiting: boolean, website: string | null): { text: string; action: HomeAction } {
  return { text: `✅ You finished a Journey step: ${journeyGoalOf(quest.step)} ${rewardTold(xp, waiting)}`, action: openCrate(quest, website) };
}

export function finishedWeeklyQuestCrateOf(quest: WeeklyQuest, goal: string, xp: number, waiting: boolean, website: string | null, thisWeek: WeekKey): { text: string; action: HomeAction } {
  return { text: `✅ You finished a quest: ${goal} ${rewardTold(xp, waiting)}`, action: openCrate(quest, website, weeklyCratePageOf(quest, thisWeek)) };
}

function swapQuest(quest: WeeklyQuest, website: string | null): HomeAction {
  if (website === null) return { label: "Swap", command: { type: "rerollQuest", quest } };
  return linkOnTheWeb({ label: "Swap", spoken: "Swap", id: `swap:${rewardKeyOf(quest)}` }, { page: "quests", quest: quest.slot }, website);
}

function openCrate(quest: Quest, website: string | null, page = questCratePageOf(quest)): HomeAction {
  if (website === null) return { label: "Open", command: { type: "openQuestCrate", quest } };
  return openOnTheWeb(rewardKeyOf(quest), page, website);
}

function rewardTold(xp: number, waiting: boolean) {
  return waiting ? `${bold(`${xp} XP`)} waits in your crate.` : `You earned ${bold(`${xp} XP`)}.`;
}

export function readyCrateOf({ feature, name, opens }: ScheduledFeature, website: string | null): { text: string; action: HomeAction } {
  return { text: `${bold(name)} is ready. It opens ${opens}.`, action: openUnlock(feature, website) };
}

function openUnlock(feature: Feature, website: string | null): HomeAction {
  if (website === null) return { label: "Open", command: { type: "openUnlock", feature } };
  return openOnTheWeb(feature, readyCratePageOf(feature), website);
}

function openOnTheWeb(id: string, page: Page, website: string): LinkAction {
  return linkOnTheWeb({ label: "Open", spoken: "Open", id }, page, website);
}

function linkOnTheWeb({ label, spoken, id }: { label: string; spoken: string; id: string }, page: Page, website: string): LinkAction {
  return { label, url: urlOf(website, page), accessibilityLabel: `${spoken} on ${productName}'s ${pageNames[page.page]} page`, id };
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

function figure(label: string, count: number | string) {
  return `${bold(label)}\n${bold(count)}`;
}

function bold(text: string | number) {
  return `*${text}*`;
}
