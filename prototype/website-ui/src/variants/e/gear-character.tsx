// Variant E gear panel: one card with two sides, the character with its slots and the inventory, swirled between; a slot opens its kind, equipping lands back in the slot.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconBox, IconUser } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { me } from "../../data/mock";
import { slotCount, type GearKind } from "./gear-items";
import { InventorySide, type Filter } from "./gear-bag";
import { kindHeading, kindIcon, slotsFor, type InventoryItem } from "./gear-inventory";
import { useGear, type SlotKind, type SlotRef } from "./hedgehogs";
import { Panel, useReducedMotion } from "./hud";
import { RarityName } from "./rarity";

export type Side = "character" | "inventory";

const css = `
.gear-sheet{display:grid;gap:.625rem;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-areas:"stage stage stage stage stage stage" "hog hog hog title title title" "e0 e0 e1 e1 e2 e2"}
.gear-sheet>[data-area]{min-width:0}
@media (min-width:640px){.gear-sheet{grid-template-columns:minmax(0,11rem) minmax(0,1fr) 6.5rem;grid-template-rows:repeat(6,minmax(0,auto));grid-template-areas:"hog stage e0" "hog stage e0" "hog stage e1" "title stage e1" "title stage e2" "title stage e2"}}
.gear-stage{background:radial-gradient(closest-side,color-mix(in oklab,var(--foreground) 7%,transparent),transparent 75%),var(--muted)}
.gear-face{transform-origin:50% 40%;backface-visibility:hidden}
@media (prefers-reduced-motion:no-preference){
.gear-out-inventory{animation:gear-out-inventory .2s cubic-bezier(.5,0,.9,.4) both}
.gear-in-inventory{animation:gear-in-inventory .25s cubic-bezier(.2,.8,.2,1.15) both}
.gear-out-character{animation:gear-out-character .2s cubic-bezier(.5,0,.9,.4) both}
.gear-in-character{animation:gear-in-character .25s cubic-bezier(.2,.8,.2,1.15) both}
}
@keyframes gear-out-inventory{to{transform:perspective(1400px) rotateY(90deg) rotateZ(-5deg) scale(.86);opacity:.35}}
@keyframes gear-in-inventory{from{transform:perspective(1400px) rotateY(-90deg) rotateZ(5deg) scale(.86);opacity:.35}}
@keyframes gear-out-character{to{transform:perspective(1400px) rotateY(-90deg) rotateZ(5deg) scale(.86);opacity:.35}}
@keyframes gear-in-character{from{transform:perspective(1400px) rotateY(90deg) rotateZ(-5deg) scale(.86);opacity:.35}}
`;

const swirlOut = 200;
const swirlIn = 250;

const sameSlot = (a: SlotRef | undefined, b: SlotRef) => a?.kind === b.kind && a.index === b.index;
const indexes = (kind: GearKind) => Array.from({ length: slotCount[kind] }, (_, i) => i);

function useSwirl(initial: Side) {
  const reduced = useReducedMotion();
  const [side, setSide] = useState(initial);
  const [turn, setTurn] = useState<{ phase: "out" | "in"; to: Side }>();
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const turnTo = (to: Side, onLanded?: () => void) => {
    clearTimeout(timer.current);
    if (reduced) {
      setSide(to);
      onLanded?.();
      return;
    }
    setTurn({ phase: "out", to });
    timer.current = window.setTimeout(() => {
      setSide(to);
      onLanded?.();
      setTurn({ phase: "in", to });
      timer.current = window.setTimeout(() => setTurn(undefined), swirlIn);
    }, swirlOut);
  };

  return { side, heading: turn?.to ?? side, swirlClass: turn ? `gear-${turn.phase}-${turn.to}` : "", turnTo };
}

export function GearPanel({ initialSide = "character" }: { initialSide?: Side }) {
  const g = useGear();
  const { side, heading, swirlClass, turnTo } = useSwirl(initialSide);
  const [filter, setFilter] = useState<Filter>("all");
  const [target, setTarget] = useState<SlotRef>();
  const [landed, setLanded] = useState<{ slot: SlotRef; n: number }>();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSide === "inventory") panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialSide]);

  const openSlot = (slot: SlotRef) => {
    setTarget(slot);
    setFilter(slot.kind);
    turnTo("inventory");
  };

  const slotFor = (kind: SlotKind): SlotRef => {
    if (target?.kind === kind) return target;
    if (kind === "hedgehog" || kind === "title") return { kind, index: 0 };
    const empty = g.slots[kind].indexOf(null);
    return { kind, index: empty >= 0 ? empty : 0 };
  };

  const equip = (item: InventoryItem) => {
    const slot = slotFor(item.kind);
    if (item.kind === "hedgehog") g.equipHog(item.id);
    else g.equipGear(item.kind, slot.index, item.id);
    setTarget(undefined);
    turnTo("character", () => setLanded((l) => ({ slot, n: (l?.n ?? 0) + 1 })));
  };

  const switchSide = (to: Side) => {
    if (to === side) return;
    if (to === "inventory") {
      setTarget(undefined);
      setFilter("all");
    }
    turnTo(to);
  };

  return (
    <div ref={panelRef} id="gear" className="scroll-mt-24">
      <style>{css}</style>
      <Panel
        label={heading === "character" ? <>Character · {2 + slotCount.quip + slotCount.emoji} slots</> : "Inventory"}
        action={
          <ToggleGroup variant="outline" size="sm" value={[heading]} onValueChange={(v) => v[0] && switchSide(v[0] as Side)} aria-label="Gear side">
            <ToggleGroupItem value="character">
              <IconUser /> Character
            </ToggleGroupItem>
            <ToggleGroupItem value="inventory">
              <IconBox /> Inventory
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className={`gear-face ${swirlClass}`}>
          {side === "character" ? <CharacterSide landed={landed} onOpen={openSlot} /> : <InventorySide filter={filter} onFilter={setFilter} target={target} onEquip={equip} />}
        </div>
      </Panel>
    </div>
  );
}

function CharacterSide({ landed, onOpen }: { landed?: { slot: SlotRef; n: number }; onOpen: (slot: SlotRef) => void }) {
  const g = useGear();
  const title = g.itemIn("title", 0);
  const landedIn = (slot: SlotRef) => (landed && sameSlot(landed.slot, slot) ? landed.n : undefined);

  const slot = (ref: SlotRef, name: string | undefined, body: ReactNode) => (
    <GearSlot slotRef={ref} name={name} landed={landedIn(ref)} onOpen={() => onOpen(ref)}>
      {body}
    </GearSlot>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="gear-sheet">
        <div data-area style={{ gridArea: "stage" }} className="gear-stage relative flex min-h-56 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-3 py-5 text-center">
          <span key={`${g.hog.id}-${landedIn({ kind: "hedgehog", index: 0 }) ?? 0}`} className="hud-pop relative inline-flex">
            <span className="absolute inset-x-6 bottom-1 h-3 rounded-full bg-foreground/15 blur-md" aria-hidden />
            <g.hog.Art size={136} className="relative" title={`Your hedgehog: ${g.hog.name}`} />
          </span>
          <div className="leading-tight">
            <div className="hud-display text-2xl font-bold">{me.name}</div>
            <div key={title?.id} className="hud-fade text-sm">
              {title ? <RarityName rarity={title.rarity}>{title.name}</RarityName> : <span className="text-muted-foreground">No title</span>}
            </div>
          </div>
        </div>
        <div data-area style={{ gridArea: "hog" }} className="flex">
          {slot(
            { kind: "hedgehog", index: 0 },
            g.hog.name,
            <span className="flex min-w-0 items-center gap-2">
              <g.hog.Art size={44} title="" />
              <RarityName rarity={g.hog.rarity} className="truncate text-sm">
                {g.hog.name}
              </RarityName>
            </span>,
          )}
        </div>
        <div data-area style={{ gridArea: "title" }} className="flex">
          {slot(
            { kind: "title", index: 0 },
            title?.name,
            title && (
              <RarityName rarity={title.rarity} className="hud-display text-base leading-tight">
                {title.name}
              </RarityName>
            ),
          )}
        </div>
        {indexes("emoji").map((i) => {
          const item = g.itemIn("emoji", i);
          return (
            <div key={i} data-area style={{ gridArea: `e${i}` }} className="flex">
              {slot(
                { kind: "emoji", index: i },
                item?.name,
                item && (
                  <span className="flex min-w-0 flex-col items-center gap-1">
                    <span className="text-3xl leading-none">{item.preview}</span>
                    <RarityName rarity={item.rarity} className="max-w-full truncate text-[11px]">
                      {item.name}
                    </RarityName>
                  </span>
                ),
              )}
            </div>
          );
        })}
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-3">
        {indexes("quip").map((i) => {
          const item = g.itemIn("quip", i);
          return (
            <li key={i} className="flex">
              {slot(
                { kind: "quip", index: i },
                item?.name,
                item && (
                  <RarityName rarity={item.rarity} className="line-clamp-2 text-sm leading-snug">
                    “{item.name}”
                  </RarityName>
                ),
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Pick a slot to change what is in it.</p>
    </div>
  );
}

function GearSlot({ slotRef, name, landed, onOpen, children }: { slotRef: SlotRef; name?: string; landed?: number; onOpen: () => void; children: ReactNode }) {
  const Icon = kindIcon[slotRef.kind];
  const numbered = slotsFor(slotRef.kind) > 1;
  const label = `${kindHeading[slotRef.kind].replace(/s$/, "")}${numbered ? ` ${slotRef.index + 1}` : ""}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}: ${name ?? "empty"}. Change it`}
      className={`hud-lift relative flex min-h-24 w-full flex-col gap-1.5 rounded-lg border bg-background p-2.5 text-left hover:bg-fill-hover dark:bg-muted/40 ${name ? "" : "border-dashed"}`}
    >
      {landed !== undefined && <span key={landed} className="hud-burst pointer-events-none absolute inset-0 rounded-lg" aria-hidden />}
      <span className="hud-label flex items-center gap-1">
        <Icon className="size-3" />
        {label}
      </span>
      <span key={`${name}-${landed ?? 0}`} className={`flex min-w-0 flex-1 items-center ${slotRef.kind === "emoji" ? "justify-center" : ""} ${landed !== undefined ? "hud-pop" : ""}`}>
        {children ?? <span className="text-xs text-muted-foreground">Empty</span>}
      </span>
    </button>
  );
}
