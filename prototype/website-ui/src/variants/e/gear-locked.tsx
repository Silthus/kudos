// Variant E gear before level 3: a dimmed silhouette of the character sheet behind a lock, what it will be, and the things already waiting for the member.
import { IconLock } from "@posthog/icons";
import { gearById, type GearItem } from "./gear-items";
import { gearCss } from "./gear-sheet";
import { starterHog } from "./hedgehogs";
import { Panel } from "./hud";
import { RarityName } from "./rarity";
import { unlockOf } from "./unlocks";

const waitingIds = ["title-the-thankful", "emoji-fire"];

const waiting = waitingIds.map(gearById).filter((g): g is GearItem => Boolean(g));

const outlineAreas = ["hog", "title", "e0", "e1", "e2"];

export function GearLocked() {
  const gear = unlockOf("gear");
  return (
    <div id="gear" className="scroll-mt-24">
      <style>{gearCss}</style>
      <Panel
        label={
          <>
            <IconLock className="size-3" /> Character · Inventory
          </>
        }
      >
        <div className="relative overflow-hidden rounded-lg border border-dashed">
          <Silhouette />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-card/90 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border">
                <IconLock className="size-4 text-muted-foreground" />
              </span>
              <h3 className="hud-display text-lg font-bold leading-tight">
                {gear.name} unlock at level {gear.level}
              </h3>
              <p className="text-sm">{gear.teaser}</p>
              <p className="text-xs text-muted-foreground">{gear.how}</p>
              {waiting.length > 0 && <Waiting />}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Waiting() {
  return (
    <div className="mt-1 flex flex-col items-center gap-1.5 border-t pt-3">
      <span className="text-xs font-medium">{waiting.length === 1 ? "1 thing is waiting for you" : `${waiting.length} things are waiting for you`}</span>
      <ul className="flex flex-wrap justify-center gap-1.5">
        {waiting.map((item) => (
          <li key={item.id} className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs">
            {item.kind === "emoji" && <span aria-hidden>{item.preview}</span>}
            <RarityName rarity={item.rarity}>{item.kind === "quip" ? `“${item.name}”` : item.name}</RarityName>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Silhouette() {
  return (
    <div className="gear-sheet pointer-events-none select-none p-3 opacity-60" aria-hidden>
      <div style={{ gridArea: "stage" }} className="flex min-h-60 items-center justify-center rounded-lg border border-dashed bg-muted/60">
        <starterHog.Art size={136} title="" className="opacity-10 [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]" />
      </div>
      {outlineAreas.map((area) => (
        <div key={area} style={{ gridArea: area }} className="min-h-24 rounded-lg border border-dashed" />
      ))}
    </div>
  );
}
