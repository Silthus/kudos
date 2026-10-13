// PROTOTYPE layout A: branches as columns (rows on narrow screens), nodes joined by hand-drawn lines.
import { branches } from "../../data/mock";
import type { Branch, Perk, PerkState } from "../../data/types";
import { Hand, Hog, Panel } from "../../ui";
import { BuyBox, PerkFacts, PerkNotes, StatePill, branchOf, chainsIn, stateLabel } from "./perk";

const nodeFace: Record<PerkState["kind"], string> = {
  owned: "bg-yellow border-ink text-[#151515]",
  available: "bg-surface border-orange ring-4 ring-orange/20",
  "cant-afford": "bg-surface border-line-strong",
  "needs-level": "bg-surface-2 border-dashed border-line-strong opacity-70",
  "needs-perk": "bg-surface-2 border-dashed border-line-strong opacity-70",
  "needs-group": "bg-surface-2 border-dashed border-line-strong opacity-70",
};

const nodeMark: Record<PerkState["kind"], string> = {
  owned: "✓",
  available: "!",
  "cant-afford": "🪙",
  "needs-level": "🔒",
  "needs-perk": "🔒",
  "needs-group": "🔒",
};

export function TreeView({ selected, onSelect }: { selected?: string; onSelect: (id: string) => void }) {
  return (
    <Panel
      title="The tree"
      actions={<Hand className="hidden text-lg sm:inline">orange ring = you can buy it</Hand>}
      bodyClass="dotgrid overflow-x-auto p-4"
    >
      <Legend />
      <div className="mt-4 flex flex-col gap-3 lg:grid lg:min-w-[920px] lg:grid-cols-9 lg:gap-2">
        {branches.map((b) => (
          <Lane key={b.id} branch={b} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    </Panel>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["bg-yellow border-ink", "Owned"],
    ["bg-surface border-orange ring-2 ring-orange/20", "Can buy"],
    ["bg-surface border-line-strong", "Can't afford yet"],
    ["bg-surface-2 border-dashed border-line-strong", "Locked"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-muted">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`inline-block size-3.5 rounded-full border-2 ${cls}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}

function Lane({ branch, selected, onSelect }: { branch: Branch; selected?: string; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-line bg-surface/80 p-3 lg:flex lg:flex-col lg:items-center lg:border-transparent lg:bg-transparent lg:p-1">
      <div className="mb-2 flex items-baseline gap-2 lg:mb-3 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
        <span className="text-lg" aria-hidden>
          {branch.icon}
        </span>
        <span className="font-display text-sm font-extrabold">{branch.name}</span>
        <span className="text-xs text-faint lg:h-[42px] lg:overflow-hidden lg:text-[11px] lg:leading-tight">{branch.blurb}</span>
      </div>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 lg:flex-col lg:flex-nowrap lg:items-center lg:gap-5">
        {chainsIn(branch.id).map((chain) => (
          <div key={chain[0].id} className="flex items-start lg:flex-col lg:items-center">
            {chain.map((perk, i) => (
              <div key={perk.id} className="flex items-start lg:flex-col lg:items-center">
                {i > 0 && <Connector lit={chain[i - 1].state.kind === "owned"} />}
                <Node perk={perk} active={perk.id === selected} onSelect={onSelect} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Node({ perk, active, onSelect }: { perk: Perk; active: boolean; onSelect: (id: string) => void }) {
  const { kind } = perk.state;
  return (
    <button
      onClick={() => onSelect(perk.id)}
      className="group flex w-[84px] cursor-pointer flex-col items-center gap-1 text-center"
      aria-pressed={active}
      title={`${perk.name}: ${stateLabel(perk.state)}`}
    >
      <span
        className={`relative flex size-14 items-center justify-center rounded-full border-2 text-2xl transition group-hover:-translate-y-0.5 ${nodeFace[kind]} ${active ? "outline-2 outline-offset-4 outline-blue" : ""} ${kind === "available" ? "animate-wiggle" : ""}`}
      >
        <span aria-hidden>{branchOf(perk).icon}</span>
        <span
          className={`absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-line-strong text-[10px] font-black ${kind === "owned" ? "bg-green text-white" : kind === "available" ? "bg-orange text-white" : "bg-surface"}`}
          aria-hidden
        >
          {nodeMark[kind]}
        </span>
      </span>
      <span className="text-xs font-bold leading-tight">{perk.name}</span>
      <span className="text-[10px] leading-tight text-faint">{stateLabel(perk.state)}</span>
    </button>
  );
}

function Connector({ lit }: { lit: boolean }) {
  const stroke = lit ? "var(--orange)" : "var(--border-strong)";
  const dash = lit ? undefined : "4 4";
  return (
    <span className="relative flex shrink-0 items-center self-stretch lg:self-auto" aria-label="upgrades to">
      <svg width="34" height="56" viewBox="0 0 34 56" className="lg:hidden" aria-hidden>
        <path d="M2 28 C 9 21, 15 35, 22 27 S 28 25, 31 28" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={dash} />
        <path d="M26 23 L31.5 28 L26 33" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg width="20" height="38" viewBox="0 0 20 38" className="hidden lg:block" aria-hidden>
        <path d="M10 2 C 3 10, 17 16, 9 24 S 11 32, 10 35" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={dash} />
        <path d="M5 30 L10 35.5 L15 30" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Hand className="absolute left-full top-1/2 ml-0.5 hidden -translate-y-1/2 -rotate-6 text-sm lg:inline">upgrade</Hand>
    </span>
  );
}

export function PerkDrawer({ perk, onClose }: { perk?: Perk; onClose: () => void }) {
  if (!perk) return null;
  const branch = branchOf(perk);
  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default bg-ink/20" aria-label="Close perk details" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={`${perk.name} details`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[78vh] overflow-y-auto rounded-t-xl border-t-2 border-ink bg-surface p-5 shadow-ph lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l-2 lg:border-t-0"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-faint">
              {branch.icon} {branch.name} branch
            </div>
            <h3 className="font-display text-2xl font-black">{perk.name}</h3>
          </div>
          <button onClick={onClose} className="rounded-md border border-line px-2 py-1 text-sm font-bold text-muted hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mt-2">
          <StatePill state={perk.state} />
        </div>
        <p className="mt-4 text-base font-medium">
          <span className="marker">{perk.effect}</span>
        </p>
        <div className="mt-4 rounded-md border border-line bg-surface-2 p-3">
          <PerkFacts perk={perk} />
        </div>
        <div className="mt-3">
          <PerkNotes perk={perk} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <BuyBox key={perk.id} perk={perk} />
        </div>
        <div className="mt-6 hidden items-end gap-2 lg:flex">
          <Hog size={56} mood={perk.state.kind === "available" ? "party" : "thinking"} />
          <Hand className="pb-2 text-lg">{perk.state.kind === "available" ? "ooh, this one's in reach" : "patience, little hog"}</Hand>
        </div>
      </aside>
    </>
  );
}
