// PROTOTYPE selected perk: effect, requirements and the page's one buy action (a stub).
import { IconCheck } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useState, type ReactNode } from "react";
import { me } from "../../data/mock";
import type { Perk } from "../../data/types";
import { blockedReason, costText, perkName } from "./perks";
import { PerkStateLabel } from "./PerkList";

export function PerkFacts({ perk }: { perk: Perk }) {
  const rows: Array<[string, string]> = [
    ["Effect", perk.effect],
    ["Level", `${perk.minLevel} or higher`],
    ["Cost", costText(perk)],
  ];
  if (perk.requires) rows.push(["Needs", perkName(perk.requires)]);
  return (
    <div className="flex flex-col gap-4">
      <PerkStateLabel state={perk.state} />
      <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <PerkNotes perk={perk} />
    </div>
  );
}

function PerkNotes({ perk }: { perk: Perk }) {
  const notes = [
    perk.requires && `An upgrade: it replaces ${perkName(perk.requires)}'s effect rather than adding to it.`,
    perk.group && `A group aura for ${me.primaryGroup.name}, your primary group.`,
    !perk.skillPoints && "Coins only, no skill points.",
  ].filter((n): n is string => typeof n === "string");
  if (notes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

export function PerkAction({ perk }: { perk: Perk }) {
  const [done, setDone] = useState(false);
  const { kind } = perk.state;

  if (done) return <Confirmation>{perk.name} is yours. Prototype: nothing was spent.</Confirmation>;

  if (kind === "owned") {
    if (perk.branch !== "active") return <p className="text-sm text-muted-foreground">You own this one. Perks are permanent.</p>;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">You own this one. Switch it on for one day a week.</p>
        <Button variant="outline" onClick={() => setDone(true)}>
          Switch on for today
        </Button>
      </div>
    );
  }

  const spendsPoints = (perk.skillPoints ?? 0) > 0;
  const reason = blockedReason(perk.state, me.level);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" disabled={kind !== "available"} onClick={() => setDone(true)}>
        Buy for {costText(perk)}
      </Button>
      <p className="text-xs text-muted-foreground">
        {reason ?? (spendsPoints ? "Spent skill points never come back, and there's no respec." : `This spends ${perk.coins} coins for good.`)}
      </p>
    </div>
  );
}

function Confirmation({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm">
      <IconCheck className="size-4 shrink-0 text-success" />
      {children}
    </p>
  );
}
