import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@posthog/quill";
import type { PerkNode } from "../shell";
import { SlackLink } from "../SlackLink";
import { SkillPointGlyph } from "./glyphs";
import { ownedSince, reasonOf, skillPointsText } from "./perkWords";

export type SelectedPerk = { perk: PerkNode; level: number };

type DetailsProps = SelectedPerk & { chatUrl: string };

export function PerkDetailsPanel({ perk, level, chatUrl }: DetailsProps) {
  return (
    <section aria-labelledby="perk-details-label" className="hud-panel relative flex flex-col gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-24">
      <span id="perk-details-label" className="hud-label">
        Perk details
      </span>
      <h2 id="perk-details-title" tabIndex={-1} className="hud-display text-2xl font-bold leading-none outline-none">
        {perk.name}
      </h2>
      <Facts perk={perk} level={level} />
      <Outcome perk={perk} level={level} chatUrl={chatUrl} />
    </section>
  );
}

type DrawerProps = DetailsProps & { open: boolean; onClose: () => void };

export function PerkDetailsDrawer({ perk, level, chatUrl, open, onClose }: DrawerProps) {
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="hud-display text-2xl">{perk.name}</DrawerTitle>
          <DrawerDescription>{perk.copy}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <FactList perk={perk} level={level} />
        </div>
        <DrawerFooter>
          <Outcome perk={perk} level={level} chatUrl={chatUrl} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Facts({ perk, level }: SelectedPerk) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{perk.copy}</p>
      <FactList perk={perk} level={level} />
    </div>
  );
}

function FactList({ perk, level }: SelectedPerk) {
  return (
    <dl className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Level</dt>
      <dd>{`Level ${level} or higher`}</dd>
      <dt className="text-muted-foreground">Cost</dt>
      <dd className="inline-flex items-center gap-1.5">
        <SkillPointGlyph />
        {skillPointsText(perk.cost.skillPoints)}
      </dd>
    </dl>
  );
}

function Outcome({ perk, level, chatUrl }: DetailsProps) {
  if (perk.state === "owned") return <p className="text-sm font-medium">{ownedSince(perk.ownedAt!)}</p>;
  if (perk.state === "unavailable") return <p className="text-sm text-muted-foreground">{reasonOf(perk, level)}</p>;
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-muted-foreground">A spent skill point never comes back.</p>
      <p className="text-sm">Buy it in Slack's App Home.</p>
      <SlackLink chatUrl={chatUrl} variant="outline">
        Open Slack
      </SlackLink>
    </div>
  );
}
