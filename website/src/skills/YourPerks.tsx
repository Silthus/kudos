import type { PerkNode, TreeRow } from "../shell";
import { PerkIcon } from "./glyphs";
import { chainOf, upgradedFrom, upgradedTo } from "./upgrades";

type ActivePerk = { perk: PerkNode; base: PerkNode | undefined };

export function YourPerks({ rows }: { rows: TreeRow[] }) {
  const active = activeInPurchaseOrder(rows);
  return (
    <section aria-labelledby="your-perks-title" className="hud-panel relative flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="your-perks-title" className="hud-label">
          {`Your perks · ${active.length} active`}
        </h2>
        <p className="text-xs text-muted-foreground">Permanent · always on.</p>
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Perks you buy show here, and they're yours for good.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {active.map((entry) => (
            <OwnedPerk key={entry.perk.perk} {...entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OwnedPerk({ perk, base }: ActivePerk) {
  return (
    <li className="flex items-start gap-2.5 rounded-md border px-2 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <PerkIcon perk={perk.perk} className="size-4" />
      </span>
      <span className="min-w-0">
        <h3 className="text-sm font-medium leading-tight">{perk.name}</h3>
        {perk.copy !== "" && <p className="text-xs leading-snug text-muted-foreground">{perk.copy}</p>}
        {base !== undefined && (
          <p className="mt-1 flex items-center gap-1 text-[11px] leading-4 text-muted-foreground">
            <PerkIcon perk={base.perk} className="size-3" />
            {`Upgraded from ${base.name}`}
          </p>
        )}
      </span>
    </li>
  );
}

function activeInPurchaseOrder(rows: TreeRow[]): ActivePerk[] {
  return rows
    .flatMap(({ perks }) => perks)
    .filter((perk) => perk.state === "owned" && upgradedTo(perk, chainOf(perk, rows)) === undefined)
    .sort((a, b) => a.ownedAt! - b.ownedAt!)
    .map((perk) => ({ perk, base: upgradedFrom(perk, chainOf(perk, rows)) }));
}
