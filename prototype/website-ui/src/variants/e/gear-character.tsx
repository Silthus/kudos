// Variant E gear panel, once the inventory opens: one card with two sides swirled by the header toggle only; the hedgehog or an emoji slot flips just the centre stage into a picker, and the inventory equips in place.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconBox, IconUser } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { me } from "../../data/mock";
import { InventorySide } from "./gear-bag";
import { emojiSlots } from "./gear-items";
import { kindIcon, slotName, type InventoryItem } from "./gear-inventory";
import { useGearAtLevel } from "./gear-level";
import { MoreHogsLine, SlotPicker } from "./gear-picker";
import { gearCss } from "./gear-sheet";
import { useTurn } from "./gear-turn";
import type { SlotRef } from "./hedgehogs";
import { Panel } from "./hud";

type Side = "character" | "inventory";

type Stage = "portrait" | "picker";

type Landed = { slot: SlotRef; n: number };

const hogSlot: SlotRef = { kind: "hedgehog", index: 0 };

const emojiIndexes = Array.from({ length: emojiSlots }, (_, i) => i);

const sameSlot = (a: SlotRef | undefined, b: SlotRef) => a?.kind === b.kind && a.index === b.index;

export function GearPanel({ initialSide = "character" }: { initialSide?: Side }) {
  const { face: side, toward, turnClass, turnTo } = useTurn<Side>(initialSide);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSide === "inventory") panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialSide]);

  return (
    <div ref={panelRef} id="gear" className="scroll-mt-24">
      <style>{gearCss}</style>
      <Panel
        label={toward === "character" ? <>Character · {1 + emojiSlots} slots</> : "Inventory"}
        action={
          <ToggleGroup variant="outline" size="sm" value={[toward]} onValueChange={(v) => v[0] && v[0] !== side && turnTo(v[0] as Side)} aria-label="Gear side">
            <ToggleGroupItem value="character">
              <IconUser /> Character
            </ToggleGroupItem>
            <ToggleGroupItem value="inventory">
              <IconBox /> Inventory
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className={`gear-face ${turnClass("gear")}`}>{side === "character" ? <CharacterSide /> : <InventorySide />}</div>
      </Panel>
    </div>
  );
}

function CharacterSide() {
  const g = useGearAtLevel();
  const { face: stage, turnClass, turnTo } = useTurn<Stage>("portrait");
  const [picking, setPicking] = useState<SlotRef>();
  const [landed, setLanded] = useState<Landed>();
  const landedIn = (slot: SlotRef) => (landed && sameSlot(landed.slot, slot) ? landed.n : undefined);
  const choosing = stage === "picker" ? picking : undefined;

  const open = (slot: SlotRef) => {
    setPicking(slot);
    if (stage === "portrait") turnTo("picker");
  };

  const close = (slot?: SlotRef) => turnTo("portrait", () => slot && setLanded((l) => ({ slot, n: (l?.n ?? 0) + 1 })));

  const pick = (item: InventoryItem | null) => {
    if (!picking) return;
    if (item === null) g.unequipEmoji(picking.index);
    else if (item.kind === "hedgehog") g.equipHog(item.id);
    else g.equipEmoji(picking.index, item.id);
    close(picking);
  };

  useEffect(() => {
    if (stage !== "picker") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const slot = (ref: SlotRef, name: string | undefined, body: ReactNode) => (
    <GearSlot slotRef={ref} name={name} landed={landedIn(ref)} choosing={sameSlot(choosing, ref)} onOpen={() => open(ref)}>
      {body}
    </GearSlot>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="gear-sheet">
        <div data-area style={{ gridArea: "stage" }} className={`gear-stage gear-face relative flex min-h-64 flex-col overflow-hidden rounded-lg border ${turnClass("stage")}`}>
          <Portrait hidden={stage === "picker"} landed={landedIn(hogSlot)} />
          {stage === "picker" && picking && (
            <div className="absolute inset-0 p-3">
              <SlotPicker slot={picking} onPick={pick} onDone={() => close()} />
            </div>
          )}
        </div>
        <div data-area style={{ gridArea: "hog" }} className="flex">
          {slot(
            hogSlot,
            g.hog.name,
            <span className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:justify-center">
              <g.hog.Art size={72} title="" />
              <span className="max-w-full truncate text-sm font-medium">{g.hog.name}</span>
              {!g.hogsOpen && <MoreHogsLine />}
            </span>,
          )}
        </div>
        {emojiIndexes.map((i) => {
          const item = g.emojiIn(i);
          return (
            <div key={i} data-area style={{ gridArea: `e${i}` }} className="flex">
              {slot(
                { kind: "emoji", index: i },
                item?.name,
                item && (
                  <span className="flex min-w-0 flex-col items-center gap-1">
                    <span className="text-3xl leading-none">{item.glyph}</span>
                    <span className="max-w-full truncate text-[11px]">{item.name}</span>
                  </span>
                ),
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{stage === "picker" ? "Pick something to wear, or press Escape to keep it as it is." : "Pick a slot to change what is in it."}</p>
    </div>
  );
}

function Portrait({ hidden, landed }: { hidden: boolean; landed?: number }) {
  const g = useGearAtLevel();
  return (
    <div className={`flex flex-1 flex-col items-center justify-center gap-2 px-3 py-5 text-center ${hidden ? "invisible" : ""}`} aria-hidden={hidden || undefined}>
      <span key={`${g.hog.id}-${landed ?? 0}`} className="hud-pop relative inline-flex">
        <span className="absolute inset-x-6 bottom-1 h-3 rounded-full bg-foreground/15 blur-md" aria-hidden />
        <g.hog.Art size={136} className="relative" title={`Your hedgehog: ${g.hog.name}`} />
      </span>
      <div className="leading-tight">
        <div className="hud-display text-2xl font-bold">{me.name}</div>
        <div className="flex justify-center gap-1 pt-1 text-xl leading-none" aria-label="Your kudos emoji">
          {emojiIndexes.map((i) => (
            <span key={`${i}-${g.emojiIn(i)?.id}`} className="hud-fade">
              {g.emojiIn(i)?.glyph}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GearSlot({ slotRef, name, landed, choosing, onOpen, children }: { slotRef: SlotRef; name?: string; landed?: number; choosing: boolean; onOpen: () => void; children: ReactNode }) {
  const Icon = kindIcon[slotRef.kind];
  const label = slotName(slotRef);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={choosing}
      aria-label={`${label}: ${name ?? "empty"}. Change it`}
      className={`hud-lift relative flex min-h-24 w-full flex-col gap-1.5 rounded-lg border bg-background p-2.5 text-left hover:bg-fill-hover dark:bg-muted/40 ${name ? "" : "border-dashed"} ${choosing ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      {landed !== undefined && <span key={landed} className="hud-burst pointer-events-none absolute inset-0 rounded-lg" aria-hidden />}
      <span className="hud-label flex items-center gap-1">
        <Icon className="size-3" />
        {label}
      </span>
      <span key={`${name}-${landed ?? 0}`} className={`flex min-w-0 flex-1 items-center justify-center ${landed !== undefined ? "hud-pop" : ""}`}>
        {children ?? <span className="text-xs text-muted-foreground">Empty</span>}
      </span>
    </button>
  );
}
