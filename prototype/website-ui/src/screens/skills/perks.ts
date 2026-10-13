// PROTOTYPE perk helpers: names, branch chains, filters and plain-text labels from the mock facts.
import { branches, perks } from "../../data/mock";
import type { Branch, Perk, PerkState } from "../../data/types";

export type PerkFilter = "all" | "can-buy" | "owned";

export const perkName = (id: string) => perks.find((p) => p.id === id)?.name ?? id;

export const branchName = (perk: Perk) => branches.find((b) => b.id === perk.branch)?.name ?? perk.branch;

export function matchesFilter(perk: Perk, filter: PerkFilter) {
  if (filter === "can-buy") return perk.state.kind === "available";
  if (filter === "owned") return perk.state.kind === "owned";
  return true;
}

export type PerkRow = { perk: Perk; indented: boolean };

export function rowsFor(branch: Branch, filter: PerkFilter): PerkRow[] {
  const inBranch = perks.filter((p) => p.branch === branch.id);
  const ordered = inBranch.filter((p) => !p.requires).flatMap((root) => [root, ...inBranch.filter((p) => p.requires === root.id)]);
  const visible = ordered.filter((p) => matchesFilter(p, filter));
  return visible.map((perk) => ({ perk, indented: perk.requires !== undefined && visible.some((p) => p.id === perk.requires) }));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function costText(perk: Perk) {
  const parts = [perk.skillPoints ? plural(perk.skillPoints, "skill point") : undefined, perk.coins ? `${perk.coins} coins` : undefined];
  return parts.filter(Boolean).join(" + ");
}

export function shortState(state: PerkState) {
  switch (state.kind) {
    case "owned":
      return "Owned";
    case "available":
      return "Can buy";
    case "needs-level":
      return `Level ${state.level}`;
    case "needs-perk":
      return `Needs ${state.perk}`;
    case "cant-afford":
      return `${state.missing} short`;
    case "needs-group":
      return "Needs a group";
  }
}

export function blockedReason(state: PerkState, myLevel: number) {
  switch (state.kind) {
    case "needs-level":
      return `Unlocks at level ${state.level}. You're level ${myLevel}.`;
    case "needs-perk":
      return `Get ${state.perk} first.`;
    case "cant-afford":
      return `You're ${state.missing} short.`;
    case "needs-group":
      return "Group perks need a primary group. Join one first.";
    default:
      return undefined;
  }
}
