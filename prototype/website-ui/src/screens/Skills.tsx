// PROTOTYPE skill tree and perks screen, with two layouts behind a prototype-only toggle.
import { useState } from "react";
import { me, perks } from "../data/mock";
import { Bubble, Hog, Stat } from "../ui";
import { CardsView } from "./skills/CardsView";
import { PerkDrawer, TreeView } from "./skills/TreeView";

type Layout = "tree" | "cards";

export function Skills({ param }: { param?: string }) {
  const [layout, setLayout] = useState<Layout>("tree");
  const [selected, setSelected] = useState<string | undefined>(() => perks.find((p) => p.id === param)?.id);
  return (
    <div className="space-y-6">
      <LayoutToggle layout={layout} onChange={setLayout} />
      <Header />
      {layout === "tree" ? (
        <>
          <TreeView selected={selected} onSelect={setSelected} />
          <PerkDrawer perk={perks.find((p) => p.id === selected)} onClose={() => setSelected(undefined)} />
        </>
      ) : (
        <CardsView />
      )}
    </div>
  );
}

function LayoutToggle({ layout, onChange }: { layout: Layout; onChange: (l: Layout) => void }) {
  const options: Array<[Layout, string]> = [
    ["tree", "Tree"],
    ["cards", "Cards"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-xs font-semibold text-faint">
      Prototype layout:
      <div role="radiogroup" className="inline-flex rounded-md border border-line-strong bg-surface-2 p-0.5">
        {options.map(([id, label]) => (
          <button
            key={id}
            role="radio"
            aria-checked={layout === id}
            onClick={() => onChange(id)}
            className={`rounded px-3 py-1 text-xs font-bold ${layout === id ? "bg-surface text-ink shadow-ph ring-1 ring-line-strong" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <section className="grid gap-5 rounded-lg border border-line bg-surface p-5 shadow-ph md:grid-cols-[1fr_auto] md:items-center">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">
            Your <span className="marker">skill tree</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Perks make every thank-you count for a little more. They're permanent: a spent skill point never comes back and there's no respec, so pick the ones you'll
            love.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          <Stat label="Skill points" value={<span className="text-orange">{me.skillPointsUnspent}</span>} hint="to spend" />
          <Stat label="Coins" value={`${me.coins} 🪙`} hint="in your pocket" />
          <Stat label="Level" value={me.level} hint={me.loadout.title} />
        </div>
      </div>
      <div className="flex items-end gap-2 md:flex-col md:items-center">
        <Bubble side="left" className="max-w-[220px]">
          Spend it now or save it for something shiny.
        </Bubble>
        <Hog size={84} mood="wave" />
      </div>
    </section>
  );
}
