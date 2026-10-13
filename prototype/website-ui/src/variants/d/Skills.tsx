// PROTOTYPE skill tree as `hedgehug perks --tree` output: a box-drawing tree, upgrade chains nested, details expand inline under the picked perk.
import { Fragment, useState } from "react";
import { Button } from "@posthog/quill";
import { branches, me, perks } from "../../data/mock";
import type { Branch, Perk, PerkState } from "../../data/types";
import { blockedReason, costText, perkName, type PerkFilter } from "../../screens/skills/perks";
import { Comment, Echo, Flag, Marker, MarkerLegend, PROMPT, markerOf, useTerminal } from "./term";

type Entry = { perk: Perk; children: Entry[] };
type Node = { perk: Perk; prefix: string; childPrefix: string };

const filters: Array<[PerkFilter, string]> = [
  ["all", "--all"],
  ["can-buy", "--can-buy"],
  ["owned", "--owned"],
];

const keeps = (filter: PerkFilter) => (perk: Perk) => filter === "all" || (filter === "can-buy" ? perk.state.kind === "available" : perk.state.kind === "owned");

const chainsOf = (inBranch: Perk[], parentId?: string): Entry[] => inBranch.filter((p) => p.requires === parentId).map((p) => ({ perk: p, children: chainsOf(inBranch, p.id) }));

const prune = (entries: Entry[], keep: (p: Perk) => boolean): Entry[] => entries.flatMap((e) => (keep(e.perk) ? [{ perk: e.perk, children: prune(e.children, keep) }] : prune(e.children, keep)));

const flatten = (entries: Entry[], prefix: string): Node[] =>
  entries.flatMap((e, i) => {
    const last = i === entries.length - 1;
    const childPrefix = prefix + (last ? "    " : "│   ");
    return [{ perk: e.perk, prefix: prefix + (last ? "└── " : "├── "), childPrefix }, ...flatten(e.children, childPrefix)];
  });

const treeFor = (filter: PerkFilter) =>
  branches
    .map((branch) => ({ branch, entries: prune(chainsOf(perks.filter((p) => p.branch === branch.id)), keeps(filter)) }))
    .filter((b) => b.entries.length > 0);

const shortState = (state: PerkState) => {
  switch (state.kind) {
    case "owned":
      return "owned";
    case "available":
      return "can buy";
    case "needs-level":
      return `needs lvl ${state.level}`;
    case "needs-perk":
      return `needs ${state.perk}`;
    case "cant-afford":
      return `${state.missing} short`;
    case "needs-group":
      return "needs a group";
  }
};

const shortCost = (perk: Perk) => [perk.skillPoints ? `${perk.skillPoints} sp` : undefined, perk.coins ? `${perk.coins} c` : undefined].filter(Boolean).join(" + ");

export function TerminalSkills({ param }: { param?: string }) {
  useTerminal();
  const [filter, setFilter] = useState<PerkFilter>("all");
  const [selected, setSelected] = useState<string | undefined>(() => perks.find((p) => p.id === param)?.id ?? perks.find((p) => p.state.kind === "available")?.id);
  const sections = treeFor(filter);
  const flag = filters.find(([id]) => id === filter)?.[1];

  return (
    <div className="hh-in flex flex-col gap-4">
      <Echo command={`hedgehug perks --tree${filter === "all" ? "" : ` ${flag}`}`}>
        <span className={me.skillPointsUnspent > 0 ? "text-primary" : ""}>{me.skillPointsUnspent} skill points</span> · {me.coins} coins · level {me.level}
      </Echo>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5">
          {filters.map(([id, label]) => (
            <Flag key={id} on={filter === id} onClick={() => setFilter(id)}>
              {label}
            </Flag>
          ))}
        </div>
        <MarkerLegend />
      </div>

      <ol className="max-w-3xl" aria-label="Skill tree">
        <li className="text-muted-foreground/70">.</li>
        {sections.map(({ branch, entries }, i) => {
          const last = i === sections.length - 1;
          return (
            <Fragment key={branch.id}>
              <BranchLine branch={branch} prefix={last ? "└── " : "├── "} />
              {flatten(entries, last ? "    " : "│   ").map((node) => (
                <PerkLine key={node.perk.id} node={node} selected={node.perk.id === selected} onSelect={() => setSelected((s) => (s === node.perk.id ? undefined : node.perk.id))} />
              ))}
            </Fragment>
          );
        })}
        {sections.length === 0 && <li className="text-muted-foreground">└── nothing matches {flag}. try --all.</li>}
      </ol>

      <Comment className="text-xs">21 perks in 9 branches. upgrades nest under the perk they replace. spent skill points never come back; there is no `respec`.</Comment>
    </div>
  );
}

function BranchLine({ branch, prefix }: { branch: Branch; prefix: string }) {
  return (
    <li className="flex items-baseline gap-x-2 pt-2">
      <span aria-hidden className="whitespace-pre text-muted-foreground/70">
        {prefix}
      </span>
      <span className="font-semibold">{branch.name.toLowerCase()}</span>
      <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">{branch.blurb}</span>
    </li>
  );
}

function PerkLine({ node, selected, onSelect }: { node: Node; selected: boolean; onSelect: () => void }) {
  const { perk, prefix, childPrefix } = node;
  const kind = markerOf(perk.state);
  return (
    <li>
      <button type="button" onClick={onSelect} aria-expanded={selected} className={`flex w-full items-baseline gap-x-2 text-left ${selected ? "bg-fill-selected" : "hover:bg-fill-hover"}`}>
        <span aria-hidden className="whitespace-pre text-muted-foreground/70">
          {prefix}
        </span>
        <Marker kind={kind} />
        <span className={kind === "locked" ? "text-muted-foreground" : kind === "available" ? "font-semibold" : ""}>{perk.name}</span>
        <span className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
          {shortState(perk.state)}
          <span className="hidden sm:inline"> · {shortCost(perk)}</span>
        </span>
      </button>
      {selected && <PerkDetails perk={perk} indent={childPrefix.length} />}
    </li>
  );
}

function PerkDetails({ perk, indent }: { perk: Perk; indent: number }) {
  const facts: Array<[string, string]> = [
    ["level", `${perk.minLevel}+ (you're ${me.level})`],
    ["cost", costText(perk)],
  ];
  if (perk.requires) facts.push(["needs", `${perkName(perk.requires)} (${perks.find((p) => p.id === perk.requires)?.state.kind === "owned" ? "owned" : "not yet"})`]);
  const notes = [
    perk.requires && `an upgrade: it replaces ${perkName(perk.requires)}'s effect rather than adding to it.`,
    perk.group && `a group aura for ${me.primaryGroup.name}, your primary group.`,
    !perk.skillPoints && "coins only, no skill points.",
  ].filter((n): n is string => typeof n === "string");

  return (
    <div className="hh-in my-1" style={{ marginLeft: `min(${indent}ch, 18vw)` }}>
      <div className="flex flex-col gap-2 border-l-2 border-primary/60 py-1 pl-3">
        <div className="text-xs">
          <span className="font-semibold text-primary">{PROMPT}</span> <span className="font-semibold">hedgehug perks show {perk.id}</span>
        </div>
        <p>{perk.effect}</p>
        <dl className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 text-xs">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {notes.length > 0 && (
          <ul className="text-xs text-muted-foreground">
            {notes.map((note) => (
              <li key={note}># {note}</li>
            ))}
          </ul>
        )}
        <PerkAction perk={perk} />
      </div>
    </div>
  );
}

function PerkAction({ perk }: { perk: Perk }) {
  const [done, setDone] = useState(false);
  const { kind } = perk.state;

  if (done)
    return (
      <p role="status" className="text-success-foreground">
        ✓ {perk.name.toLowerCase()} is yours. <span className="text-muted-foreground"># prototype: nothing was spent.</span>
      </p>
    );

  if (kind === "owned") {
    if (perk.branch !== "active") return <Comment className="text-xs">you own this one. perks are permanent.</Comment>;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" className="font-mono" onClick={() => setDone(true)}>
          perks on {perk.id} --today
        </Button>
        <Comment className="text-xs">one day a week. today counts.</Comment>
      </div>
    );
  }

  const reason = blockedReason(perk.state, me.level);
  const warning = perk.skillPoints ? "spent skill points never come back, and there's no respec." : `this spends ${perk.coins} coins for good.`;
  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button variant="primary" size="sm" className="font-mono" disabled={kind !== "available"} onClick={() => setDone(true)}>
          perks buy {perk.id} · {shortCost(perk)}
        </Button>
      </div>
      <Comment className={`text-xs ${reason ? "text-warning-foreground" : ""}`}>{reason ? reason.toLowerCase() : warning}</Comment>
    </div>
  );
}
