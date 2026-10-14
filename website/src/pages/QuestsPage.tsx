import { HedgehogTownCrier } from "@posthog/brand/hoggies";
import { IconClock } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";
import { questCrateHomeAttributes } from "../crates/moments";
import { questCrateOf } from "../crates/readyCrates";
import { Done, RewardCrate } from "../crates/RewardCrate";
import { PageTitle } from "../PageTitle";
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
          <PageTitle tab="Quests">This week</PageTitle>
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
  const { kind, goal, progress, reward, state, swapped, seen } = slot;
  const crate = questCrateOf(slot);
  return (
    <article className="hud-panel relative flex flex-col gap-2 rounded-xl border bg-card p-4" {...questCrateHomeAttributes(seen)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="hud-label">{kind}</span>
        {swapped && <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Swapped</span>}
      </div>
      <h2 className="text-base font-semibold leading-snug">{goal}</h2>
      <QuestProgress {...progress} />
      {crate !== undefined ? (
        <RewardCrate crate={crate} open={openVariantOf(seen, { firstCrate })} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{`${reward.xp} XP`}</span>
          {state === "opened" && <Done />}
        </div>
      )}
    </article>
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
  const crate = questCrateOf(entry);
  return (
    <article className="hud-panel relative flex flex-col gap-2 rounded-xl border bg-card p-4" {...questCrateHomeAttributes(entry.seen)}>
      <WeekOf week={entry.week} />
      <h3 className="text-sm font-medium">{entry.goal}</h3>
      {crate !== undefined && <RewardCrate crate={crate} open={openVariantOf(entry.seen, { firstCrate })} />}
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
