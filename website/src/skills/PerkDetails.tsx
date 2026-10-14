import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@posthog/quill";
import type { PerkNode } from "../shell";
import { SkillPointGlyph } from "./glyphs";
import { ownedSince, reasonOf, skillPointsText } from "./perkWords";
import type { Notice, Purchasing } from "./purchase";

export type SelectedPerk = { perk: PerkNode; level: number };

type DetailsProps = SelectedPerk & { purchasing: Purchasing };

export const detailsHeadingId = "perk-details-title";

export function PerkDetailsPanel({ perk, level, purchasing }: DetailsProps) {
  return (
    <section aria-labelledby="perk-details-label" className="hud-panel relative flex flex-col gap-4 rounded-xl border bg-card p-4 lg:sticky lg:top-24">
      <span id="perk-details-label" className="hud-label">
        Perk details
      </span>
      <h2 id={detailsHeadingId} tabIndex={-1} className="hud-display text-2xl font-bold leading-none outline-none">
        {perk.name}
      </h2>
      <Facts perk={perk} level={level} />
      <Outcome perk={perk} level={level} purchasing={purchasing} />
      <PurchaseNotice perk={perk} purchasing={purchasing} />
      <PurchaseAnnouncement purchasing={purchasing} />
    </section>
  );
}

type DrawerProps = DetailsProps & { open: boolean; headingFirst: boolean; onClose: () => void; returnFocusTo: () => HTMLElement | null };

export function PerkDetailsDrawer({ perk, level, purchasing, open, headingFirst, onClose, returnFocusTo }: DrawerProps) {
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent initialFocus={headingFirst ? () => document.getElementById(detailsHeadingId) : undefined} finalFocus={returnFocusTo}>
        <DrawerHeader>
          <DrawerTitle id={detailsHeadingId} tabIndex={-1} className="hud-display text-2xl outline-none">
            {perk.name}
          </DrawerTitle>
          <DrawerDescription>{perk.copy}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          <FactList perk={perk} level={level} />
        </div>
        <DrawerFooter>
          <Outcome perk={perk} level={level} purchasing={purchasing} />
          <PurchaseNotice perk={perk} purchasing={purchasing} />
          <PurchaseAnnouncement purchasing={purchasing} />
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

function Outcome({ perk, level, purchasing }: DetailsProps) {
  if (perk.state === "owned") return <p className="text-sm font-medium">{ownedSince(perk.ownedAt!)}</p>;
  if (perk.state === "unavailable") return <p className="text-sm text-muted-foreground">{reasonOf(perk, level)}</p>;
  return <BuyAction perk={perk} level={level} purchasing={purchasing} />;
}

function BuyAction({ perk, level, purchasing }: DetailsProps) {
  const { buying } = purchasing;
  const busy = buying !== undefined;
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-muted-foreground">A spent skill point never comes back.</p>
      <Button
        variant="primary"
        aria-disabled={busy || undefined}
        onClick={() => purchasing.buy({ perk, level })}
      >
        {buying === perk.perk ? "Buying…" : `Buy for ${skillPointsText(perk.cost.skillPoints)}`}
      </Button>
    </div>
  );
}

function PurchaseNotice({ perk, purchasing: { notice } }: { perk: PerkNode; purchasing: Purchasing }) {
  if (notice === undefined || !isShownBeside(notice, perk)) return null;
  return <p className="text-xs font-medium">{notice.text}</p>;
}

function isShownBeside(notice: Notice, perk: PerkNode) {
  if (notice.perk !== perk.perk || notice.kind === "bought") return false;
  if (notice.kind === "refused") return perk.state !== "available";
  return perk.state !== "owned";
}

export function PurchaseAnnouncement({ purchasing }: { purchasing: Purchasing }) {
  return (
    <p role="status" className="sr-only">
      {purchasing.notice?.text}
    </p>
  );
}
