// Variant E quests: three weekly personal quests, one group quest shared with Team Bramble and a quest for a freshly unlocked feature; a finished quest is claimed by opening its reward crate in place, and the only primary is the next Claim.
import { useEffect, useState, type ReactNode } from "react";
import { IconArrowRight, IconCheck, IconClock, IconRefresh } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { me } from "../../data/mock";
import { Avatar } from "./avatars";
import { Panel, Tag, useHud } from "./hud";
import { ClaimCrate, crateRewards } from "./quests-claim";
import { QuestHog, QuestProgress, RewardLine } from "./quests-parts";
import { claimQuest, groupMembers, kindLabel, rerollQuest, resetText, useQuests, type Quest } from "./quests-data";
import { featureLook } from "./unlock-features";
import { unlockOf, usePreviewLevel, useUnlocked, type Feature } from "./unlocks";

export function Quests({ param }: { param?: string }) {
  useHud();
  const level = usePreviewLevel();
  const { personal, group, fresh, rerollUsed } = useQuests(level);
  const [claiming, setClaiming] = useState<string | null>(null);
  const primaryId = claiming ? null : [...personal, ...(fresh ? [fresh] : []), group].find((q) => q.state === "claimable")?.def.id;
  useScrollTo(param);

  const card = (quest: Quest, extra?: ReactNode, footer?: ReactNode) => (
    <QuestCardRow key={quest.def.id} quest={quest} primary={quest.def.id === primaryId} claiming={claiming === quest.def.id} onClaim={() => setClaiming(quest.def.id)} onClaimed={() => (claimQuest(quest.def.id), setClaiming(null))} extra={extra} footer={footer} />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="hud-rise flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="hud-label">Quests</div>
          <h1 className="hud-display mt-1 text-4xl font-bold leading-none">This week</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <IconClock className="size-4" />
            {resetText}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconRefresh className="size-4" />
            {rerollUsed ? "Reroll used this week" : "1 reroll left this week"}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3" aria-label="Your quests">
            {personal.map((quest) => card(quest, quest.rerollable && <RerollButton id={quest.def.id} />))}
          </section>
          {fresh && <FreshQuest>{card(fresh, <FeatureLink feature={fresh.def.feature} />)}</FreshQuest>}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3" aria-label={`Group quest with ${me.primaryGroup.name}`}>
            <span className="hud-label">Group quest · {me.primaryGroup.name}</span>
            {card(group, null, group.state !== "claimed" && <Helpers contributed={group.contributed} />)}
          </section>
          <HowQuestsWork />
        </div>
      </div>
    </div>
  );
}

function QuestCardRow({ quest, primary, claiming, onClaim, onClaimed, extra, footer }: { quest: Quest; primary: boolean; claiming: boolean; onClaim: () => void; onClaimed: () => void; extra?: ReactNode; footer?: ReactNode }) {
  const coinsOpen = useUnlocked("coins");
  const { def, state } = quest;
  const claimed = state === "claimed";
  return (
    <article id={`quest-${def.id}`} className={`hud-panel relative scroll-mt-28 rounded-xl border bg-card p-4 text-card-foreground ${claimed ? "opacity-75" : ""}`} aria-label={def.goal}>
      {claiming ? (
        <ClaimCrate goal={def.goal} rewards={crateRewards(def.reward, coinsOpen)} onClaimed={onClaimed} />
      ) : (
        <div className="flex items-start gap-3 sm:gap-4">
          <QuestHog quest={quest} size={64} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="hud-label">{kindLabel[def.kind]}</span>
              {quest.rerolled && <Tag>Rerolled</Tag>}
            </div>
            <h2 className="text-base font-semibold leading-snug">{def.goal}</h2>
            <QuestProgress quest={quest} />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <RewardLine reward={def.reward} coinsOpen={coinsOpen} />
              <div className="flex items-center gap-2">
                {extra}
                <QuestAction state={state} primary={primary} onClaim={onClaim} />
              </div>
            </div>
          </div>
        </div>
      )}
      {!claiming && footer}
    </article>
  );
}

function QuestAction({ state, primary, onClaim }: { state: Quest["state"]; primary: boolean; onClaim: () => void }) {
  if (state === "claimed")
    return (
      <Tag variant="success">
        <IconCheck className="size-3" />
        Claimed
      </Tag>
    );
  if (state === "claimable")
    return (
      <Button variant={primary ? "primary" : "outline"} size="sm" onClick={onClaim}>
        Claim
      </Button>
    );
  return null;
}

function RerollButton({ id }: { id: string }) {
  return (
    <Button variant="link-muted" size="sm" onClick={() => rerollQuest(id)} title="Swap this quest for another. One reroll a week.">
      <IconRefresh className="size-3.5" />
      Reroll
    </Button>
  );
}

function FeatureLink({ feature }: { feature: Feature }) {
  const { screen, param } = featureLook[feature];
  return (
    <Button variant="link-muted" size="sm" onClick={() => (location.hash = `/${screen}${param ? `/${param}` : ""}`)}>
      Open {unlockOf(feature).name}
      <IconArrowRight className="size-3.5" />
    </Button>
  );
}

function FreshQuest({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label="New feature quest">
      <div className="flex items-center gap-2">
        <Tag variant="info">New</Tag>
        <span className="text-sm text-muted-foreground">A bonus quest to try what you just unlocked. It stays until you finish it.</span>
      </div>
      {children}
    </section>
  );
}

function Helpers({ contributed }: { contributed: string[] }) {
  const helped = new Set(contributed);
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3">
      <ul className="flex flex-wrap gap-1.5" aria-label="Who has helped">
        {groupMembers.map((name) => (
          <li key={name} className="relative" title={`${name === me.name ? "You" : name}${helped.has(name) ? " helped" : " hasn't helped yet"}`}>
            <Avatar name={name} size={30} className={`ring-2 ${name === me.name ? "ring-foreground/50" : "ring-card"} ${helped.has(name) ? "" : "opacity-35 grayscale"}`} />
            {helped.has(name) && (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
                <IconCheck className="size-2.5" />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {helped.size} of {groupMembers.length} have helped, and everyone shares the reward. It shows who joined in, never how many kudos anyone gave.
      </p>
    </div>
  );
}

function HowQuestsWork() {
  return (
    <Panel label="How quests work">
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        <li>Quests reward reaching new people and other groups, kudos that say why in 5+ words, and chiming in.</li>
        <li>They never ask for a number of kudos, and never tell you who to thank.</li>
        <li>New quests arrive every Monday. You can reroll one personal quest a week.</li>
        <li>Each new feature you unlock adds a bonus quest that shows you around it.</li>
      </ul>
    </Panel>
  );
}

function useScrollTo(param?: string) {
  useEffect(() => {
    if (param) document.getElementById(`quest-${param}`)?.scrollIntoView({ block: "center" });
  }, [param]);
}
