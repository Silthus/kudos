// PROTOTYPE layout B: full perk cards grouped by branch, with filter chips.
import { Fragment, useState } from "react";
import { branches, perks } from "../../data/mock";
import type { Branch, Perk } from "../../data/types";
import { Hand, Hog } from "../../ui";
import { BuyBox, PerkFacts, PerkNotes, StatePill, chainsIn, matchesFilter, perkName, type PerkFilter } from "./perk";

const filters: Array<{ id: PerkFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "can-buy", label: "Can buy" },
  { id: "owned", label: "Owned" },
  { id: "locked", label: "Locked" },
];

export function CardsView() {
  const [filter, setFilter] = useState<PerkFilter>("all");
  const visible = branches.filter((b) => chainsIn(b.id).flat().some((p) => matchesFilter(p, filter)));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${filter === f.id ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-muted hover:text-ink"}`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">{perks.filter((p) => matchesFilter(p, f.id)).length}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Hog mood="sleepy" size={80} />
          <p className="text-sm text-muted">Nothing here yet.</p>
        </div>
      ) : (
        visible.map((b) => <BranchSection key={b.id} branch={b} filter={filter} />)
      )}
    </div>
  );
}

function BranchSection({ branch, filter }: { branch: Branch; filter: PerkFilter }) {
  const chains = chainsIn(branch.id);
  const shown = chains.flat().filter((p) => matchesFilter(p, filter));
  return (
    <section>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="font-display text-lg font-extrabold">
            <span aria-hidden>{branch.icon}</span> {branch.name}
          </h3>
          <p className="text-sm text-muted">{branch.blurb}</p>
        </div>
        <ChainLine chains={chains} />
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <PerkCard key={p.id} perk={p} />
        ))}
      </div>
    </section>
  );
}

function ChainLine({ chains }: { chains: Perk[][] }) {
  const upgradeChains = chains.filter((c) => c.length > 1);
  if (upgradeChains.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
      {upgradeChains.map((chain) => (
        <span key={chain[0].id} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5">
          {chain.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && (
                <span className="text-orange" aria-label="upgrades to">
                  ⟶
                </span>
              )}
              <span className={p.state.kind === "owned" ? "text-ink" : ""}>{p.name}</span>
            </Fragment>
          ))}
        </span>
      ))}
    </div>
  );
}

function PerkCard({ perk }: { perk: Perk }) {
  const { kind } = perk.state;
  const frame = kind === "owned" ? "border-ink/60" : kind === "available" ? "border-orange border-2" : "border-line";
  return (
    <article className={`flex flex-col gap-3 rounded-lg border p-4 shadow-ph ${frame} ${kind === "owned" || kind === "available" ? "bg-surface" : "bg-surface-2"}`}>
      {perk.requires && <Hand className="-mb-2 text-base">↳ upgrades {perkName(perk.requires)}</Hand>}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-lg font-black leading-tight">{perk.name}</h4>
        <StatePill state={perk.state} />
      </div>
      <p className="text-sm font-medium">{perk.effect}</p>
      <PerkFacts perk={perk} />
      <PerkNotes perk={perk} />
      <div className="mt-auto border-t border-line pt-3">
        <BuyBox perk={perk} />
      </div>
    </article>
  );
}
