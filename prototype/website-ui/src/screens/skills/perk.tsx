// PROTOTYPE perk helpers shared by the Tree and Cards layouts: labels, costs, chains and the buy stub.
import { useState, type ReactNode } from "react";
import { branches, me, perks } from "../../data/mock";
import type { Perk, PerkState } from "../../data/types";
import { Button, Pill } from "../../ui";

export type PerkFilter = "all" | "can-buy" | "owned" | "locked";

export const perkName = (id: string) => perks.find((p) => p.id === id)?.name ?? id;

export const branchOf = (perk: Perk) => branches.find((b) => b.id === perk.branch)!;

export const isUpgrade = (perk: Perk) => perk.requires !== undefined;

export function matchesFilter(perk: Perk, filter: PerkFilter) {
  if (filter === "all") return true;
  if (filter === "can-buy") return perk.state.kind === "available";
  if (filter === "owned") return perk.state.kind === "owned";
  return perk.state.kind !== "available" && perk.state.kind !== "owned";
}

export function chainsIn(branchId: string): Perk[][] {
  const inBranch = perks.filter((p) => p.branch === branchId);
  const roots = inBranch.filter((p) => !p.requires || !inBranch.some((q) => q.id === p.requires));
  return roots.map((root) => {
    const chain = [root];
    let next = inBranch.find((q) => q.requires === root.id);
    while (next) {
      chain.push(next);
      const last: Perk = next;
      next = inBranch.find((q) => q.requires === last.id);
    }
    return chain;
  });
}

export function stateLabel(state: PerkState) {
  switch (state.kind) {
    case "owned":
      return "Owned";
    case "available":
      return "Can buy";
    case "needs-level":
      return `Unlocks at level ${state.level}`;
    case "needs-perk":
      return `Needs ${state.perk} first`;
    case "cant-afford":
      return `Short ${state.missing}`;
    case "needs-group":
      return "Join a group first";
  }
}

export function StatePill({ state }: { state: PerkState }) {
  const tone = state.kind === "owned" ? "green" : state.kind === "available" ? "orange" : "plain";
  const icon = state.kind === "owned" ? "✓" : state.kind === "available" ? "●" : "🔒";
  return (
    <Pill tone={tone}>
      <span aria-hidden>{icon}</span> {stateLabel(state)}
    </Pill>
  );
}

const points = (n: number) => `${n} skill point${n === 1 ? "" : "s"}`;

export function costText(perk: Perk) {
  const parts = [perk.skillPoints ? points(perk.skillPoints) : undefined, perk.coins ? `${perk.coins} 🪙` : undefined].filter(Boolean);
  return parts.join(" + ");
}

export function PerkFacts({ perk }: { perk: Perk }) {
  const rows: Array<[string, string]> = [
    ["Level", `${perk.minLevel}+`],
    ["Cost", costText(perk)],
  ];
  if (perk.requires) rows.push(["Needs", perkName(perk.requires)]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-faint">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PerkNotes({ perk }: { perk: Perk }) {
  const notes: string[] = [];
  if (perk.requires) notes.push(`Upgrade: replaces ${perkName(perk.requires)}'s effect, it doesn't stack on top.`);
  if (perk.branch === "expression") notes.push("Coins only. No skill points needed.");
  if (perk.group) notes.push(`Group aura for ${me.primaryGroup.name}, your primary group.`);
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-muted">
      {notes.map((n) => (
        <li key={n} className="flex gap-1.5">
          <span className="text-orange" aria-hidden>
            ↳
          </span>
          {n}
        </li>
      ))}
    </ul>
  );
}

function blockedReason(perk: Perk) {
  const s = perk.state;
  switch (s.kind) {
    case "needs-level":
      return `Reach level ${s.level} first. You're level ${me.level}.`;
    case "needs-perk":
      return `Get ${s.perk} first, then this one opens up.`;
    case "cant-afford":
      return `You're ${s.missing} short. Save up, it'll keep.`;
    case "needs-group":
      return "Group perks need a primary group. Join one first.";
    default:
      return "";
  }
}

type Step = "idle" | "confirm" | "done" | "switched-on";

export function BuyBox({ perk }: { perk: Perk }) {
  const [step, setStep] = useState<Step>("idle");
  const { kind } = perk.state;
  const spendsPoints = (perk.skillPoints ?? 0) > 0;

  if (kind === "owned") {
    if (perk.branch !== "active") return <p className="text-sm text-muted">It's yours. Perks are permanent, so it stays that way.</p>;
    return step === "switched-on" ? (
      <Toast>{perk.name} is on for today. (Prototype: nothing was switched on.)</Toast>
    ) : (
      <div className="space-y-2">
        <p className="text-sm text-muted">It's yours. Switch it on for one day a week.</p>
        <Button tone="orange" small onClick={() => setStep("switched-on")}>
          ⚡ Switch on for today
        </Button>
      </div>
    );
  }

  if (kind !== "available") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">{blockedReason(perk)}</p>
        <Button tone="plain" small disabled>
          🔒 Not yet
        </Button>
      </div>
    );
  }

  if (step === "done") return <Toast>Nice pick! {perk.name} would be yours for good now. (Prototype: nothing was spent.)</Toast>;

  if (step === "confirm") {
    return (
      <div className="space-y-2 rounded-md border border-orange/40 bg-orange/8 p-3">
        <p className="text-sm font-semibold">
          {spendsPoints ? "Sure? Spent skill points never come back and there's no respec." : `This spends ${perk.coins} 🪙.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button tone="orange" small onClick={() => setStep("done")}>
            Yes, get {perk.name}
          </Button>
          <Button tone="plain" small onClick={() => setStep("idle")}>
            Not yet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button tone="yellow" onClick={() => setStep("confirm")}>
        Get it for {costText(perk)}
      </Button>
      {spendsPoints && <p className="text-xs text-faint">Heads up: skill points are a one-way trip. No refunds, no respec.</p>}
    </div>
  );
}

function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="animate-pop rounded-md border border-green/50 bg-green/15 px-3 py-2 text-sm font-semibold">
      🎉 {children}
    </div>
  );
}
