import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TeamCrest } from "../../crates/TeamCrest";
import type { Face } from "../../shell";
import { centreRect, flyBetween, markFor, rectOf, scrollIntoViewIfNeeded } from "./flight";
import type { TeamAlbum, TeamPerson } from "./teamFixtures";

export type StickerMomentProps = { person: TeamPerson; album: TeamAlbum; completes: boolean; onStuck: () => void; onDone: () => void };

type Phase = "peel" | "fly" | "stuck" | "complete";

const peelsForMs = 1300;

const fliesForMs = 950;

export function StickerMoment({ person, album, completes, onStuck, onDone }: StickerMomentProps) {
  const [phase, setPhase] = useState<Phase>("peel");
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== "peel") return;
    const timer = setTimeout(() => setPhase("fly"), peelsForMs);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== "fly" || card.current === null) return;
    const slot = `[data-slot="${person.key}"]`;
    const target = (scrollIntoViewIfNeeded(slot) && rectOf(slot)) || (scrollIntoViewIfNeeded(`[data-team="${album.team}"]`) && rectOf(`[data-team="${album.team}"]`)) || rectOf('[data-chapter="teams"]') || centreRect(80);
    void flyBetween(card.current, card.current.getBoundingClientRect(), target, fliesForMs).then(() => {
      onStuck();
      markFor(slot, "data-stuck", 1600);
      setPhase(completes ? "complete" : "stuck");
    });
  }, [phase, person.key, album.team, completes, onStuck]);
  useEffect(() => {
    if (phase === "stuck") {
      const timer = setTimeout(onDone, 1400);
      return () => clearTimeout(timer);
    }
    if (phase === "complete") {
      markFor("[data-crest-plate]", "data-earned", 2600);
      markFor(`[data-team="${album.team}"]`, "data-earned", 2600);
      const timer = setTimeout(onDone, 3200);
      return () => clearTimeout(timer);
    }
  }, [phase, album.team, onDone]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-[55]">
      {(phase === "peel" || phase === "fly") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className={`sm-ribbon ${phase === "peel" ? "sm-in" : "sm-out"}`}>Sticker collected</span>
          <div ref={card} className="sm-card bk-sticker flex aspect-[3/4] w-40 flex-col">
            <div className="bk-sheen sm-sheen relative flex-1 overflow-hidden rounded-[6px] bg-muted">
              <Portrait face={person.face} />
              <figcaption className="bk-name-strip absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-semibold leading-tight">{person.name}</figcaption>
            </div>
          </div>
          <p className={`sm-line ${phase === "peel" ? "sm-in" : "sm-out"}`} style={{ "--d": "0.25s" } as CSSProperties}>
            {`You thanked ${person.name}. Their sticker goes on the ${album.name} page.`}
          </p>
        </div>
      )}
      {phase === "complete" && (
        <div className="absolute inset-x-0 top-[calc(var(--hud-height,3.5rem)+1rem)] flex justify-center px-4">
          <div className="sm-crest-banner sm-in flex items-center gap-4 rounded-2xl px-5 py-4">
            <span className="sm-crest-pop">
              <TeamCrest art={album.art} size={64} />
            </span>
            <span className="flex flex-col">
              <span className="hud-label" style={{ color: "var(--band-lemon)" }}>
                Team complete
              </span>
              <span className="hud-display text-2xl font-extrabold leading-tight">{`${album.name} crest earned`}</span>
              <span className="text-sm" style={{ color: "rgb(255 255 255 / 0.75)" }}>
                Everyone on the team is in your book.
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Portrait({ face }: { face: Face }) {
  if (face.kind === "initials") return <span className="hud-display absolute inset-0 grid place-items-center text-4xl font-bold text-muted-foreground">{face.initials}</span>;
  const onColour: CSSProperties | undefined = face.kind === "company-profile" ? { backgroundColor: face.colour } : undefined;
  return <img src={face.image} alt="" style={onColour} className={`absolute inset-0 size-full object-cover ${face.kind === "company-profile" ? "object-top" : ""}`} />;
}
