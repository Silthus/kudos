import type { ReactNode } from "react";
import { IconLock } from "@posthog/icons";
import type { BoardAnswer } from "../boardRead";
import { Crate } from "../crates/Crate";
import { hogOf, pageOf, plainNameOf, sentenceOf, type PagedFeature } from "../features";
import { readyInSlack } from "../pages/FeatureWaitsPage";
import type { ProfileCardShown } from "../profileCardRead";
import type { QuestsShown } from "../questsRead";
import type { Feature, FeatureCard, MemberProfile } from "../shell";
import { pointsToSpend } from "../skills/perkWords";
import { PageLink, Panel } from "./Panel";
import { QuestsPanel } from "./QuestsPanel";
import { StandingPanel } from "./StandingPanel";

type Slot = PagedFeature;

type MainSlot = "book" | "skillTree";

type RailSlot = "quests" | "leaderboard";

export type RailReads = { quests: QuestsShown | undefined; board: BoardAnswer | undefined; card: ProfileCardShown | undefined };

const mainColumn: MainSlot[] = ["book", "skillTree"];

const rightRail: RailSlot[] = ["quests", "leaderboard"];

export function MainColumnPanels({ member }: { member: MemberProfile }) {
  return mainColumn.map((slot) => <SlotPanel key={slot} slot={slot} member={member} open={<OpenPanel slot={slot} member={member} />} />);
}

export function RightRailPanels({ member, reads }: { member: MemberProfile; reads: RailReads }) {
  return rightRail.map((slot) => <SlotPanel key={slot} slot={slot} member={member} open={<RailPanel slot={slot} member={member} reads={reads} />} />);
}

type SlotPanelProps = { slot: Slot; member: MemberProfile; open: ReactNode };

function SlotPanel({ slot, member, open }: SlotPanelProps) {
  if (member.features === null) return slot === "leaderboard" && member.leaderboard.kind === "open" ? open : <LockedPanel card={{ feature: slot, name: plainNameOf(slot) }} member={member} status="Locked" />;
  const card = cardOf(member, slot);
  if (card === undefined) return null;
  if (card.state === "locked") return <LockedPanel card={card} member={member} />;
  if (card.state === "ready") return <ReadyPanel card={card} />;
  return open;
}

function cardOf(member: MemberProfile, slot: Slot) {
  return member.features?.find(({ feature }) => feature === slot);
}

function RailPanel({ slot, member, reads }: { slot: RailSlot; member: MemberProfile; reads: RailReads }) {
  const card = cardOf(member, slot);
  const answer = slot === "quests" ? reads.quests : reads.board;
  if (answer?.kind === "locked") return <LockedPanel card={{ feature: slot, name: card?.name ?? plainNameOf(slot), level: answer.level }} member={member} />;
  if (answer?.kind === "ready") return card === undefined ? <ReadyInSlackPanel slot={slot} /> : <ReadyPanel card={{ ...card, state: "ready", openedAt: null }} />;
  return slot === "quests" ? <QuestsPanel quests={reads.quests} /> : <StandingPanel board={reads.board} />;
}

type LockedPanelProps = { card: Pick<FeatureCard, "feature" | "name"> & { level?: number }; member: MemberProfile; status?: string };

function LockedPanel({ card: { feature, name, level }, member, status = `Unlocks at level ${level}` }: LockedPanelProps) {
  return (
    <Panel id={feature} label={name}>
      <div className="flex items-center gap-3">
        <LockedHog feature={feature} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{status}</span>
          <p className="text-xs text-muted-foreground">{sentenceOf(feature, member)}</p>
        </div>
      </div>
    </Panel>
  );
}

function LockedHog({ feature }: { feature: Feature }) {
  const Hog = hogOf(feature);
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
    <Panel id={card.feature} label={card.name} gameObject>
      <Crate card={card} heading="h3" open="outline" artWidth={72} framed={false} />
    </Panel>
  );
}

function ReadyInSlackPanel({ slot }: { slot: RailSlot }) {
  return (
    <Panel id={slot} label={plainNameOf(slot)}>
      <p className="text-sm text-muted-foreground">{readyInSlack(slot)}</p>
    </Panel>
  );
}

function OpenPanel({ slot, member }: { slot: MainSlot; member: MemberProfile }) {
  const line = slot === "skillTree" && member.skillPoints !== null ? pointsToSpend(member.skillPoints) : pageOf(slot).sentence;
  return (
    <Panel id={slot} label={cardOf(member, slot)?.name ?? plainNameOf(slot)}>
      <p className="text-sm text-muted-foreground">{line}</p>
      <PageLink feature={slot} />
    </Panel>
  );
}
