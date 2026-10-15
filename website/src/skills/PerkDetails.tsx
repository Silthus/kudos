import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@posthog/quill";
import type { PerkNode } from "../shell";
import { CoinGlyph, SkillPointGlyph } from "./glyphs";
import { coinsText, costText, ownedSince, reasonOf, skillPointsText, tookOverText } from "./perkWords";
import type { Notice, Purchasing } from "./purchase";
import { upgradedTo, type Chain } from "./upgrades";

export type SelectedPerk = { perk: PerkNode; level: number; chain: Chain };

type DetailsProps = SelectedPerk & { purchasing: Purchasing };

export const detailsHeadingId = "perk-details-title";

export function PerkDetailsPanel({ purchasing, ...selected }: DetailsProps) {
  const { perk } = selected;
  return (
    <section aria-labelledby="perk-details-label" className="hud-panel relative flex flex-col gap-4 rounded-lg border bg-card p-4 lg:sticky lg:top-24">
      <span id="perk-details-label" className="hud-label">
        Perk details
      </span>
      <h2 id={detailsHeadingId} tabIndex={-1} className="hud-display text-2xl font-bold leading-none outline-none">
        {perk.name}
      </h2>
      <Facts {...selected} />
      <Outcome {...selected} purchasing={purchasing} />
      <PurchaseNotice perk={perk} purchasing={purchasing} />
      <PurchaseAnnouncement purchasing={purchasing} />
    </section>
  );
}

type DrawerProps = DetailsProps & { open: boolean; headingFirst: boolean; onClose: () => void; returnFocusTo: () => HTMLElement | null };

export function PerkDetailsDrawer({ purchasing, open, headingFirst, onClose, returnFocusTo, ...selected }: DrawerProps) {
  const { perk } = selected;
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent initialFocus={headingFirst ? () => document.getElementById(detailsHeadingId) : undefined} finalFocus={returnFocusTo}>
        <DrawerHeader>
          <DrawerTitle id={detailsHeadingId} tabIndex={-1} className="hud-display text-2xl outline-none">
            {perk.name}
          </DrawerTitle>
          {perk.copy !== "" && <DrawerDescription>{perk.copy}</DrawerDescription>}
        </DrawerHeader>
        <div className="px-4">
          <FactList {...selected} />
        </div>
        <DrawerFooter>
          <Outcome {...selected} purchasing={purchasing} />
          <PurchaseNotice perk={perk} purchasing={purchasing} />
          <PurchaseAnnouncement purchasing={purchasing} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Facts(selected: SelectedPerk) {
  return (
    <div className="flex flex-col gap-3">
      {selected.perk.copy !== "" && <p className="text-sm">{selected.perk.copy}</p>}
      <FactList {...selected} />
    </div>
  );
}

function FactList({ perk, level, chain }: SelectedPerk) {
  return (
    <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Level</dt>
      <dd>{`Level ${level} or higher`}</dd>
      <dt className="text-muted-foreground">Cost</dt>
      <dd className="flex flex-wrap items-center gap-x-1.5">
        <Cost cost={perk.cost} />
      </dd>
      {chain.base !== undefined && (
        <>
          <dt className="text-muted-foreground">Upgrades</dt>
          <dd>{chain.base.name}</dd>
        </>
      )}
    </dl>
  );
}

function Cost({ cost }: { cost: PerkNode["cost"] }) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <SkillPointGlyph />
        {skillPointsText(cost.skillPoints)}
      </span>
      {cost.coins > 0 && (
        <span className="inline-flex items-center gap-1.5">
          {" and "}
          <CoinGlyph />
          {coinsText(cost.coins)}
        </span>
      )}
    </>
  );
}

function Outcome({ perk, level, chain, purchasing }: DetailsProps) {
  const upgrade = upgradedTo(perk, chain);
  if (upgrade !== undefined) return <p className="text-sm text-muted-foreground">{tookOverText(upgrade)}</p>;
  if (perk.state === "owned") return <p className="text-sm font-medium">{ownedSince(perk.ownedAt!)}</p>;
  if (perk.state === "unavailable") return <p className="text-sm text-muted-foreground">{reasonOf(perk, level)}</p>;
  return <BuyAction perk={perk} level={level} chain={chain} purchasing={purchasing} />;
}

function BuyAction({ purchasing, ...selected }: DetailsProps) {
  const { perk } = selected;
  const { buying } = purchasing;
  const busy = buying !== undefined;
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-muted-foreground">{perk.cost.coins > 0 ? "Spent skill points and coins never come back." : "A spent skill point never comes back."}</p>
      <Button
        variant="primary"
        aria-disabled={busy || undefined}
        onClick={() => purchasing.buy(selected)}
      >
        {buying === perk.perk ? "Buying…" : `Buy for ${costText(perk.cost)}`}
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

export function PurchaseAnnouncement({ purchasing, shown = false }: { purchasing: Purchasing; shown?: boolean }) {
  return (
    <p role="status" className={shown ? "text-sm font-medium" : "sr-only"}>
      {purchasing.notice?.text}
    </p>
  );
}
