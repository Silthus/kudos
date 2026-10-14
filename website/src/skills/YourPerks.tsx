import type { PerkNode, TreeRow } from "../shell";
import { PerkIcon } from "./glyphs";

export function YourPerks({ rows }: { rows: TreeRow[] }) {
  const owned = ownedInPurchaseOrder(rows);
  return (
    <section aria-labelledby="your-perks-title" className="hud-panel relative flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="your-perks-title" className="hud-label">
          {`Your perks · ${owned.length} active`}
        </h2>
        <p className="text-xs text-muted-foreground">Permanent · always on.</p>
      </div>
      {owned.length === 0 ? (
        <p className="text-sm text-muted-foreground">Perks you buy show here, and they're yours for good.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {owned.map((perk) => (
            <OwnedPerk key={perk.perk} perk={perk} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OwnedPerk({ perk }: { perk: PerkNode }) {
  return (
    <li className="flex items-start gap-2.5 rounded-md border px-2 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
        <PerkIcon perk={perk.perk} className="size-4" />
      </span>
      <span className="min-w-0">
        <h3 className="text-sm font-medium leading-tight">{perk.name}</h3>
        <p className="text-xs leading-snug text-muted-foreground">{perk.copy}</p>
      </span>
    </li>
  );
}

function ownedInPurchaseOrder(rows: TreeRow[]) {
  return rows
    .flatMap(({ perks }) => perks)
    .filter((perk) => perk.state === "owned")
    .sort((a, b) => a.ownedAt! - b.ownedAt!);
}
