import type { ReactNode } from "react";
import { HedgehogExplorer, HedgehogMegaphone, HedgehogReading, HedgehogTownCrier } from "@posthog/brand/hoggies";
import { IconArrowRight, IconCheck, IconClock, IconRefresh } from "@posthog/icons";
import { Button, Card, CardContent } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { attemptMessages, questCrateHomeAttributes, useMoments } from "../crates/moments";
import { questCrateOf, type CrateFacts, type QuestCrate } from "../crates/readyCrates";
import { Claimed } from "../crates/RewardCrate";
import { hogOf, openWebPageOf, plainNameOf, type Hoggie, type WebPage } from "../features";
import { PageTitle } from "../PageTitle";
import { questTargetAttributes } from "../questTarget";
import { Coins } from "../quests/QuestReward";
import { QuestTag } from "../quests/QuestTag";
import { sameQuest, useQuestSwap, type QuestSwap } from "../quests/questSwap";
import type { JourneyStep, MemberProfile, QuestReward, QuestsAnswer, QuestSlot, ShellActions, WaitingCrate, WeekSwap } from "../shell";
import { SlackLink } from "../SlackLink";

type ThisWeek = Extract<QuestsAnswer, { kind: "quests" }>;

type QuestsPageProps = { quests: ThisWeek; member: MemberProfile; swapQuest: ShellActions["swapQuest"] };

export function QuestsPage({ quests, member, swapQuest }: QuestsPageProps) {
  const firstCrate = [...quests.slots, ...(quests.bonus === null ? [] : [quests.bonus]), ...quests.waiting].find(({ crate }) => crate !== null)?.seen;
  const swap = useQuestSwap(swapQuest, quests.slots);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <span className="hud-label">Quests</span>
          <PageTitle tab="Quests" size="display">This week</PageTitle>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <IconClock aria-hidden="true" className="size-4" />
            New quests arrive every Monday.
          </p>
          {quests.slots.length > 0 && <SwapLeft swap={quests.swap} />}
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {quests.slots.length === 0 ? <NoQuests chatUrl={quests.chatUrl} firstCrate={firstCrate} /> : <QuestCards slots={quests.slots} firstCrate={firstCrate} swappable={quests.swap.available} swap={swap} />}
          {quests.bonus !== null && <BonusQuest step={quests.bonus} page={pageElsewhereOf(member, quests.bonus)} firstCrate={firstCrate} />}
          <WaitingToOpen waiting={quests.waiting} firstCrate={firstCrate} />
        </div>
        <HowQuestsWork />
      </div>
      <p role="status" className="sr-only">
        {swap.announcement}
      </p>
    </div>
  );
}

function SwapLeft({ swap }: { swap: WeekSwap }) {
  const text = swap.available ? "1 swap left this week" : swap.used ? "Swap used this week" : undefined;
  if (text === undefined) return null;
  return (
    <p className="inline-flex items-center gap-1.5">
      <IconRefresh aria-hidden="true" className="size-4" />
      {text}
    </p>
  );
}

type FirstCrate = { firstCrate: string | null | undefined };

function openVariantOf(seen: string | null, { firstCrate }: FirstCrate) {
  return seen === firstCrate ? "primary" : "outline";
}

type Swapping = { swappable: boolean; swap: QuestSwap };

function QuestCards({ slots, firstCrate, ...swapping }: { slots: QuestSlot[] } & FirstCrate & Swapping) {
  return (
    <section aria-label="Your quests" className="flex flex-col gap-3">
      {slots.map((slot) => (
        <QuestCard key={slot.slot} slot={slot} firstCrate={firstCrate} {...swapping} />
      ))}
    </section>
  );
}

function QuestCard({ slot, firstCrate, swappable, swap }: { slot: QuestSlot } & FirstCrate & Swapping) {
  const { slot: quest, kind, goal, progress, reward, state, swapped, seen } = slot;
  const claimed = state === "opened";
  return (
    <article
      className={`hud-panel relative scroll-mt-28 rounded-xl border bg-card p-4 text-card-foreground ${claimed ? "opacity-90" : ""}`}
      data-claimed={claimed || undefined}
      {...questTargetAttributes(quest)}
      {...questCrateHomeAttributes(seen)}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <QuestArt Hog={artOf[kind]} claimed={claimed} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="hud-label">{kind}</span>
            {swapped && <QuestTag>Swapped</QuestTag>}
          </div>
          <h2 tabIndex={-1} className={questHeading}>
            {goal}
          </h2>
          <QuestProgress {...progress} />
          <RewardRow reward={reward} seen={seen}>
            {claimed ? <Claimed /> : state === "in-progress" ? <SwapAction slot={slot} swap={swap} swappable={swappable} /> : <ClaimOf facts={slot} firstCrate={firstCrate} />}
          </RewardRow>
        </div>
      </div>
    </article>
  );
}

const questHeading = "w-fit rounded-sm text-base font-semibold leading-snug outline-offset-4";

const artOf: Record<QuestSlot["kind"], Hoggie> = { "Say why": HedgehogReading, "Reach out": HedgehogExplorer, "Join in": HedgehogMegaphone };

function QuestArt({ Hog, claimed }: { Hog: Hoggie; claimed: boolean }) {
  return (
    <span data-quest-art aria-hidden="true" className="relative flex shrink-0 items-center justify-center rounded-xl bg-muted/60" style={{ width: 64, height: 64 }}>
      <Hog size={55} title="" className={claimed ? "grayscale" : undefined} />
      {claimed && (
        <span data-claimed-check className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
          <IconCheck className="size-3" />
        </span>
      )}
    </span>
  );
}

function QuestProgress({ done, target }: QuestSlot["progress"]) {
  const label = `${done} of ${target}`;
  return (
    <div className="flex items-center gap-2.5">
      <div role="progressbar" aria-label={label} aria-valuenow={done} aria-valuemin={0} aria-valuemax={target} className="h-2 flex-1 overflow-hidden rounded-full border border-muted-foreground p-px">
        <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (done / target) * 100)}%` }} />
      </div>
      <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function RewardRow({ reward, seen, children }: { reward: QuestReward; seen: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tabular-nums text-muted-foreground">
        <span>{`+${reward.xp} XP`}</span>
        {reward.coins !== undefined && <Coins coins={reward.coins} />}
      </span>
      {children}
    </div>
  );
}

function ClaimOf({ facts, firstCrate }: { facts: CrateFacts } & FirstCrate) {
  const crate = questCrateOf(facts);
  return crate === undefined ? null : <Claim crate={crate} variant={openVariantOf(crate.seen, { firstCrate })} />;
}

function Claim({ crate, variant }: { crate: QuestCrate; variant: "primary" | "outline" }) {
  const moments = useMoments();
  const attempt = moments?.attemptOf(crate);
  const claiming = attempt === "opening";
  return (
    <div className="flex flex-col items-end gap-1">
      {attempt !== undefined && !claiming && <p className="text-xs font-medium">{attemptMessages[attempt]}</p>}
      <Button
        variant={variant}
        size="sm"
        aria-disabled={claiming || undefined}
        onClick={() => {
          if (!claiming) moments?.open(crate);
        }}
      >
        {claiming ? "Claiming…" : "Claim"}
      </Button>
    </div>
  );
}

function SwapAction({ slot, swap, swappable }: { slot: QuestSlot } & Swapping) {
  const line = swap.lineFor(slot.quest);
  if (line === undefined && !swappable) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {line !== undefined && <p className="text-xs font-medium">{line}</p>}
      {swappable && <SwapButton slot={slot} swap={swap} />}
    </div>
  );
}

function SwapButton({ slot, swap }: { slot: QuestSlot; swap: QuestSwap }) {
  const sending = swap.sending !== undefined;
  return (
    <Button variant="link-muted" size="sm" title="Swap this quest for another. One swap a week." aria-disabled={sending || undefined} onClick={() => swap.swap(slot)}>
      <IconRefresh aria-hidden="true" className="size-3.5" />
      {swap.sending !== undefined && sameQuest(swap.sending, slot.quest) ? "Swapping…" : "Swap"}
    </Button>
  );
}

function pageElsewhereOf(member: MemberProfile, { feature }: JourneyStep) {
  const page = feature === null ? undefined : openWebPageOf(member, feature);
  return page?.screen === "quests" ? undefined : page;
}

type BonusQuestProps = { step: JourneyStep; page: WebPage | undefined } & FirstCrate;

function BonusQuest(props: BonusQuestProps) {
  return (
    <section aria-labelledby="bonus-quest-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="bonus-quest-title" className="hud-label">
          Bonus quest
        </h2>
        <p className="text-sm text-muted-foreground">Your Journey's next step. It stays until you finish it.</p>
      </div>
      <BonusCard {...props} />
    </section>
  );
}

function BonusCard({ step, page, firstCrate }: BonusQuestProps) {
  const { goal, hint, reward, state, seen, feature } = step;
  const active = state === "active";
  return (
    <article className="hud-panel relative scroll-mt-28 rounded-xl border bg-card p-4 text-card-foreground" {...questTargetAttributes("journey")} {...questCrateHomeAttributes(seen)}>
      <div className="flex items-start gap-3 sm:gap-4">
        <QuestArt Hog={feature === null ? HedgehogReading : hogOf(feature)} claimed={false} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="hud-label">Journey</span>
            {active && <QuestTag>New</QuestTag>}
          </div>
          <h3 tabIndex={-1} className={questHeading}>
            {goal}
          </h3>
          {hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>}
          <RewardRow reward={reward} seen={seen}>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
              {page !== undefined && feature !== null && <GoTo page={page} name={plainNameOf(feature)} />}
              <ClaimOf facts={step} firstCrate={firstCrate} />
            </div>
          </RewardRow>
        </div>
      </div>
    </article>
  );
}

function GoTo({ page, name }: { page: WebPage; name: string }) {
  return (
    <AppLink href={page.href} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
      Go to {name}
      <IconArrowRight aria-hidden="true" className="size-3.5" />
    </AppLink>
  );
}

function WaitingToOpen({ waiting, firstCrate }: { waiting: WaitingCrate[] } & FirstCrate) {
  if (waiting.length === 0) return null;
  return (
    <section aria-labelledby="waiting-title" className="flex flex-col gap-3">
      <h2 id="waiting-title" className="hud-label">
        Waiting to open
      </h2>
      {waiting.map((entry) => (
        <WaitingCard key={entry.seen} entry={entry} firstCrate={firstCrate} />
      ))}
    </section>
  );
}

function WaitingCard({ entry, firstCrate }: { entry: WaitingCrate } & FirstCrate) {
  return (
    <article className="hud-panel relative flex flex-col gap-2 rounded-xl border bg-card p-4" {...questCrateHomeAttributes(entry.seen)}>
      <WeekOf week={entry.week} />
      <h3 className="text-sm font-medium">{entry.goal}</h3>
      <RewardRow reward={entry.reward} seen={entry.seen}>
        <ClaimOf facts={entry} firstCrate={firstCrate} />
      </RewardRow>
    </article>
  );
}

function WeekOf({ week }: Pick<WaitingCrate, "week">) {
  const monday = new Intl.DateTimeFormat(navigator.languages, { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.parse(`${week}T00:00:00Z`));
  return (
    <time dateTime={week} className="hud-label">
      Week of {monday}
    </time>
  );
}

function NoQuests({ chatUrl, firstCrate }: { chatUrl: string } & FirstCrate) {
  return (
    <section aria-label="Your quests this week" className="flex flex-col items-center gap-4 rounded-xl border bg-card px-4 py-10 text-center">
      <HedgehogTownCrier size={96} title="" />
      <p className="text-sm text-muted-foreground">You have no quests this week.</p>
      <SlackLink chatUrl={chatUrl} variant={firstCrate === undefined ? "primary" : "outline"}>
        Open Slack
      </SlackLink>
    </section>
  );
}

function HowQuestsWork() {
  return (
    <section aria-labelledby="how-quests-work-title">
      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          <h2 id="how-quests-work-title" className="hud-label">
            How quests work
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Quests reward thanking someone new, someone you haven't thanked in a while, and thanks that say why. A thanks says why when your message has 5 or more words besides mentions and emoji. New quests arrive every Monday. You can swap one quest a week.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
