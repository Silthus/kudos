import type { ReactNode } from "react";
import { IconArrowRight, IconLock } from "@posthog/icons";
import { AppLink } from "../AppLink";
import { Crate } from "../crates/Crate";
import { featureCardAttributes } from "../crates/moments";
import { aboutOf, pageOf, plainNameOf, type PagedFeature } from "../features";
import type { Feature, FeatureCard, MemberProfile } from "../shell";
import { pointsToSpend } from "../skills/perkWords";

type Slot = PagedFeature;

const goTo: Record<Slot, string> = {
  quests: "See all quests",
  leaderboard: "Open the leaderboard",
  book: "Open the Book",
  skillTree: "Open the Skill tree",
};

const mainColumn: Slot[] = ["book", "skillTree"];

const rightRail: Slot[] = ["quests", "leaderboard"];

export function MainColumnPanels({ member }: { member: MemberProfile }) {
  return <SlotPanels slots={mainColumn} member={member} />;
}

export function RightRailPanels({ member }: { member: MemberProfile }) {
  return <SlotPanels slots={rightRail} member={member} />;
}

function SlotPanels({ slots, member }: { slots: Slot[]; member: MemberProfile }) {
  return slots.map((slot) => <SlotPanel key={slot} slot={slot} member={member} />);
}

function SlotPanel({ slot, member }: { slot: Slot; member: MemberProfile }) {
  if (member.features === null) return <PlainPanel slot={slot} member={member} />;
  const card = member.features.find(({ feature }) => feature === slot);
  if (card === undefined) return null;
  if (card.state === "locked") return <LockedPanel card={card} />;
  if (card.state === "ready") return <ReadyPanel card={card} />;
  return <OpenPanel slot={slot} name={card.name} member={member} />;
}

function PlainPanel({ slot, member }: { slot: Slot; member: MemberProfile }) {
  const name = plainNameOf(slot);
  if (slot === "leaderboard" && member.leaderboard.kind === "open") return <OpenPanel slot={slot} name={name} member={member} />;
  return <LockedPanel card={{ feature: slot, name }} status="Locked" />;
}

function LockedPanel({ card: { feature, name, level }, status = `Unlocks at level ${level}` }: { card: Pick<FeatureCard, "feature" | "name"> & { level?: number }; status?: string }) {
  const { sentence } = aboutOf(feature);
  return (
    <Panel feature={feature} label={name}>
      <div className="flex items-center gap-3">
        <LockedHog feature={feature} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{status}</span>
          <p className="text-xs text-muted-foreground">{sentence}</p>
        </div>
      </div>
    </Panel>
  );
}

function LockedHog({ feature }: { feature: Feature }) {
  const { Hog } = aboutOf(feature);
  return (
    <span aria-hidden="true" data-locked-hog className="relative shrink-0">
      <Hog size={48} title="" className="opacity-25 brightness-0 dark:invert" />
      <span data-padlock className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
        <IconLock className="size-3" />
      </span>
    </span>
  );
}

function ReadyPanel({ card }: { card: FeatureCard }) {
  return (
    <Panel feature={card.feature} label={card.name} gameObject>
      <Crate card={card} heading="h3" open="outline" artWidth={72} framed={false} />
    </Panel>
  );
}

function OpenPanel({ slot, name, member }: { slot: Slot; name: string; member: MemberProfile }) {
  const page = pageOf(slot);
  const line = slot === "skillTree" && member.skillPoints !== null ? pointsToSpend(member.skillPoints) : page.sentence;
  return (
    <Panel feature={slot} label={name}>
      <p className="text-sm text-muted-foreground">{line}</p>
      <AppLink href={page.href} className="inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline" {...featureCardAttributes(slot)}>
        {goTo[slot]}
        <IconArrowRight aria-hidden="true" className="size-3.5" />
      </AppLink>
    </Panel>
  );
}

function Panel({ feature, label, gameObject = false, children }: { feature: Feature; label: string; gameObject?: boolean; children: ReactNode }) {
  const titleId = `${feature}-panel-title`;
  return (
    <section aria-labelledby={titleId} className={`relative flex flex-col gap-3 rounded-xl border bg-card p-4 ${gameObject ? "hud-panel" : ""}`}>
      <h2 id={titleId} className="hud-label">
        {label}
      </h2>
      {children}
    </section>
  );
}
