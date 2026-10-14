import type { ReactNode } from "react";
import { HedgehogExplorer, HedgehogMegaphone, HedgehogReading, HedgehogTownCrier } from "@posthog/brand/hoggies";
import { IconCheck, IconClock } from "@posthog/icons";
import { Button, Card, CardContent } from "@posthog/quill";
import { attemptMessages, questCrateHomeAttributes, useMoments } from "../crates/moments";
import { questCrateOf, type CrateFacts, type QuestCrate } from "../crates/readyCrates";
import { rewardChipAttributes } from "../crates/RewardFlight";
import type { Hoggie } from "../features";
import { PageTitle } from "../PageTitle";
import { questTargetAttributes } from "../questTarget";
import type { QuestsAnswer, QuestSlot, WaitingCrate } from "../shell";
import { SlackLink } from "../SlackLink";

type ThisWeek = Extract<QuestsAnswer, { kind: "quests" }>;

export function QuestsPage({ quests }: { quests: ThisWeek }) {
  const firstCrate = [...quests.slots, ...quests.waiting].find(({ crate }) => crate !== null)?.seen;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <span className="hud-label">Quests</span>
          <PageTitle tab="Quests" size="display">This week</PageTitle>
        </div>
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <IconClock aria-hidden="true" className="size-4" />
          New quests arrive every Monday.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {quests.slots.length === 0 ? <NoQuests chatUrl={quests.chatUrl} firstCrate={firstCrate} /> : <QuestCards slots={quests.slots} firstCrate={firstCrate} />}
          <WaitingToOpen waiting={quests.waiting} firstCrate={firstCrate} />
        </div>
        <HowQuestsWork />
      </div>
    </div>
  );
}

type FirstCrate = { firstCrate: string | null | undefined };

function openVariantOf(seen: string | null, { firstCrate }: FirstCrate) {
  return seen === firstCrate ? "primary" : "outline";
}

function QuestCards({ slots, firstCrate }: { slots: QuestSlot[] } & FirstCrate) {
  return (
    <section aria-label="Your quests" className="flex flex-col gap-3">
      {slots.map((slot) => (
        <QuestCard key={slot.slot} slot={slot} firstCrate={firstCrate} />
      ))}
    </section>
  );
}

function QuestCard({ slot, firstCrate }: { slot: QuestSlot } & FirstCrate) {
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
        <QuestArt kind={kind} claimed={claimed} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="hud-label">{kind}</span>
            {swapped && <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Swapped</span>}
          </div>
          <h2 tabIndex={-1} className="text-base font-semibold leading-snug">
            {goal}
          </h2>
          <QuestProgress {...progress} />
          <RewardRow xp={reward.xp} seen={seen}>
            {claimed ? <Claimed /> : <ClaimOf facts={slot} firstCrate={firstCrate} />}
          </RewardRow>
        </div>
      </div>
    </article>
  );
}

const artOf: Record<QuestSlot["kind"], Hoggie> = { "Say why": HedgehogReading, "Reach out": HedgehogExplorer, "Join in": HedgehogMegaphone };

function QuestArt({ kind, claimed }: { kind: QuestSlot["kind"]; claimed: boolean }) {
  const Hog = artOf[kind];
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

function RewardRow({ xp, seen, children }: { xp: number; seen: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <span className="text-xs font-medium tabular-nums text-muted-foreground" {...rewardChipAttributes(seen)}>{`+${xp} XP`}</span>
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
          if (!claiming) moments?.claim(crate);
        }}
      >
        {claiming ? "Claiming…" : "Claim"}
      </Button>
    </div>
  );
}

function Claimed() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-medium leading-4 text-success-foreground">
      <IconCheck aria-hidden="true" className="size-3" />
      Claimed
    </span>
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
      <RewardRow xp={entry.reward.xp} seen={entry.seen}>
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
            Quests reward thanking someone new, someone you haven't thanked in a while, and thanks that say why. A thanks says why when your message has 5 or more words besides mentions and emoji. New quests arrive every Monday. You can swap one quest a week in Slack's App Home.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
