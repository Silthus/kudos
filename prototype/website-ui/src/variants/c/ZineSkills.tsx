// Zine skill tree: the perk menu, nine numbered courses with upgrades as sub-entries and a chef's note for the chosen perk.
import { useState } from "react";
import { HedgehogChef } from "@posthog/brand/hoggies";
import { IconCheck, IconCornerDownRight, IconLock } from "@posthog/icons";
import { branches, me, perks } from "../../data/mock";
import type { Perk } from "../../data/types";
import { PerkAction } from "../../screens/skills/PerkDetails";
import { branchName, costText, perkName, rowsFor, shortState } from "../../screens/skills/perks";
import { Band, Display, Kicker, SectionHead, pad2 } from "./zine";

const ownedCount = perks.filter((p) => p.state.kind === "owned").length;

export function ZineSkills({ param }: { param?: string }) {
  const [selectedId, setSelectedId] = useState(() => perks.find((p) => p.id === param)?.id ?? perks.find((p) => p.state.kind === "available")?.id);
  const selected = perks.find((p) => p.id === selectedId);
  return (
    <article className="flex flex-col gap-12 md:gap-16">
      <MenuCover />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <ol className="flex flex-col gap-10">
          {branches.map((branch, i) => (
            <li key={branch.id}>
              <SectionHead no={pad2(i + 1)} title={branch.name} />
              <p className="mt-2 text-sm text-muted-foreground">{branch.blurb}</p>
              <ul className="mt-3 flex flex-col">
                {rowsFor(branch, "all").map(({ perk, indented }) => (
                  <li key={perk.id}>
                    <MenuEntry perk={perk} indented={indented} selected={perk.id === selectedId} onSelect={() => setSelectedId(perk.id)} />
                    {perk.id === selectedId && (
                      <div className="my-3 lg:hidden">
                        <ChefsNote key={perk.id} perk={perk} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        {selected && (
          <aside className="hidden lg:sticky lg:top-6 lg:block">
            <ChefsNote key={selected.id} perk={selected} />
          </aside>
        )}
      </div>
    </article>
  );
}

function MenuCover() {
  return (
    <Band ink="blue">
      <Kicker>The perk menu · {ownedCount} of {perks.length} already on your plate</Kicker>
      <div className="mt-6 grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <Display as="h1" className="text-[clamp(3rem,10vw,7.5rem)]">
            <span className="block">{perks.length} perks.</span>
            <span className="block">{branches.length} courses.</span>
          </Display>
          <p className="mt-6 max-w-lg text-lg font-medium leading-snug md:text-xl">
            You're level {me.level} with <span className="underline decoration-2 underline-offset-4">{me.skillPointsUnspent} skill points</span> and {me.coins} coins to order with. Every perk makes a thank-you count for a little more.
          </p>
          <p className="mt-6 max-w-lg border-l-4 border-current pl-4 text-sm leading-relaxed">
            <span className="font-semibold uppercase tracking-[0.18em]">House rules</span>
            <br />
            Spent skill points never come back, and there's no respec. An upgrade replaces its base perk's effect; it doesn't stack.
          </p>
        </div>
        <HedgehogChef size={280} title="A hedgehog chef" className="h-auto w-40 justify-self-end md:w-64" />
      </div>
    </Band>
  );
}

function MenuEntry({ perk, indented, selected, onSelect }: { perk: Perk; indented: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`-mx-3 flex w-[calc(100%+1.5rem)] items-start gap-3 px-3 py-2.5 text-left ${selected ? "bg-fill-selected" : "hover:bg-fill-hover"} ${indented ? "pl-9" : ""}`}
    >
      {indented && <IconCornerDownRight className="mt-1 -ml-6 size-4 shrink-0 text-muted-foreground" aria-label="Upgrade of the entry above" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`shrink-0 font-semibold ${perk.state.kind === "owned" || perk.state.kind === "available" ? "" : "text-muted-foreground"}`}>{perk.name}</span>
          <span className="mb-1 flex-1 border-b border-dotted border-foreground/40" aria-hidden />
          <Price perk={perk} />
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{perk.effect}</span>
      </span>
    </button>
  );
}

function Price({ perk }: { perk: Perk }) {
  const { state } = perk;
  if (state.kind === "owned")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
        <IconCheck className="size-4" />
        Yours
      </span>
    );
  if (state.kind === "available") return <span className="shrink-0 text-sm font-semibold tabular-nums">{costText(perk)}</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
      <IconLock className="size-3.5" />
      {shortState(state)}
    </span>
  );
}

function ChefsNote({ perk }: { perk: Perk }) {
  const facts: Array<[string, string]> = [
    ["Level", `${perk.minLevel} or higher`],
    ["Price", costText(perk)],
  ];
  if (perk.requires) facts.push(["Needs", perkName(perk.requires)]);
  const notes = [
    perk.requires && `An upgrade: it replaces ${perkName(perk.requires)}'s effect rather than adding to it.`,
    perk.group && `A group aura for ${me.primaryGroup.name}, your primary group.`,
    !perk.skillPoints && "Coins only, no skill points.",
  ].filter((n): n is string => typeof n === "string");
  return (
    <div className="border-2 border-foreground bg-card p-5 shadow-[6px_6px_0_0_var(--foreground)]">
      <Kicker className="text-muted-foreground">
        Chef's note · {branchName(perk)}
        {perk.requires && ` · upgrade of ${perkName(perk.requires)}`}
      </Kicker>
      <Display as="h3" className="mt-3 text-3xl md:text-4xl">
        {perk.name}
      </Display>
      <p className="mt-3 text-sm leading-relaxed">{perk.effect}</p>
      <dl className="mt-4 grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1.5 border-t border-foreground/20 pt-3 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <div className="mt-5 border-t border-foreground/20 pt-4">
        <PerkAction perk={perk} />
      </div>
    </div>
  );
}
