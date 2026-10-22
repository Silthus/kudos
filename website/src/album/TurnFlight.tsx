import type { CSSProperties } from "react";
import type { TurnedFaceShown } from "../../../convex/website/album";
import { metalOf } from "../book/metal";
import { HoggieArt } from "./HoggieArt";
import { medalWordsOf } from "./milestones";
import { rarityWordOf } from "./opening";
import { Confetti, Sparkles } from "./PackCards";
import { PersonPicture } from "./PersonPicture";
import type { Chip, Flight, FlightBoxes, MedalPop } from "./useTurnFlight";
import { comboFor, faceWordOf } from "./arcade/motion";

export function TurnFlight({ flight, boxes }: { flight: Flight; boxes: FlightBoxes }) {
  const { face } = flight;
  return (
    <>
      <div className="ib-air" aria-hidden="true" data-face={face === null ? undefined : faceWordOf(face)} data-combo={comboFor(flight.item)}>
        <Flyer flight={flight} boxes={boxes} />
        {flight.burst && face !== null && <Burst flight={flight} face={face} />}
        {flight.caption && face !== null && <Caption flight={flight} face={face} />}
        {flight.chip !== null && <XpChip chip={flight.chip} />}
        {flight.rings !== null && face !== null && <Rings rect={flight.rings} face={face} />}
        {flight.flourish !== null && <GoldFlourish rect={flight.flourish} />}
        {flight.medal !== null && <MedalFlourish medal={flight.medal} />}
        {flight.stage !== "back" && <p className="ib-skip">Click to skip</p>}
      </div>
      <p role="status" aria-label="Turning over" className="al-sr ph-no-capture">
        {saidOf(flight)}
      </p>
    </>
  );
}

function Flyer({ flight: { from, face }, boxes }: { flight: Flight; boxes: FlightBoxes }) {
  return (
    <div ref={boxes.flyer} className="ib-flyer" style={{ left: from.left, top: from.top, width: from.width, height: from.height, "--burst": face === null ? "var(--al-accent)" : colourOf(face) } as CSSProperties}>
      <div ref={boxes.flip} className="ib-flip">
        <div className="ib-face">
          <span className="ib-back">
            <span className="ib-q">?</span>
          </span>
        </div>
        <div className="ib-face ib-front-face">
          <span className="ib-front" data-kind={face?.kind}>
            <span ref={boxes.disc} className="ib-disc" />
            {face !== null && <FrontArt face={face} />}
          </span>
        </div>
      </div>
    </div>
  );
}

function FrontArt({ face }: { face: TurnedFaceShown }) {
  if (face.kind === "hoggie") return <HoggieArt hoggie={face.drop.hoggie} hidden={false} />;
  return <PersonPicture face={face.thanked.face} name={face.thanked.name ?? ""} collected frame="ib-sticker" className="ib-sticker-face" />;
}

function Burst({ flight: { spot, size }, face }: { flight: Flight; face: TurnedFaceShown }) {
  const rare = face.kind === "hoggie" && face.drop.rarity !== "common" && face.drop.rarity !== "uncommon";
  return (
    <span className="ib-burst" data-rare={rare ? "" : undefined} style={{ left: spot.x, top: spot.y, width: size, height: size, "--burst": colourOf(face), "--rarity-color": colourOf(face) } as CSSProperties}>
      <span className="ib-rays" />
      <span className="ib-flash" />
      <Sparkles count={rare ? 18 : 10} seed={size} />
    </span>
  );
}

function Caption({ flight: { spot, size }, face }: { flight: Flight; face: TurnedFaceShown }) {
  return (
    <span className="ib-caption ph-no-capture" style={{ left: spot.x, top: spot.y + size / 2 + 14, "--burst": colourOf(face) } as CSSProperties}>
      <strong className="ib-caption-name">{nameOf(face)}</strong>
      <span className="ib-caption-what">{whatOf(face)}</span>
    </span>
  );
}

function XpChip({ chip: { xp, from, to } }: { chip: Chip }) {
  const middle = { x: (from.x + to.x) / 2 + 40, y: Math.min(from.y, to.y) - 60 };
  return (
    <span className="ib-chip" style={{ left: from.x, top: from.y, "--mx": `${middle.x - from.x}px`, "--my": `${middle.y - from.y}px`, "--dx": `${to.x - from.x}px`, "--dy": `${to.y - from.y}px` } as CSSProperties}>
      +{xp} XP
    </span>
  );
}

function Rings({ rect, face }: { rect: DOMRect; face: TurnedFaceShown }) {
  return (
    <span className="ib-rings" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, "--burst": colourOf(face) } as CSSProperties}>
      <span className="ib-ring" />
      <span className="ib-ring" data-late="" />
    </span>
  );
}

function GoldFlourish({ rect }: { rect: DOMRect }) {
  return (
    <span className="ib-burst ib-flourish" data-rare="" style={{ left: rect.left + rect.width / 2, top: rect.top + rect.height / 2, width: rect.width, height: rect.height, "--burst": "var(--al-gold)", "--rarity-color": "var(--al-gold)" } as CSSProperties}>
      <span className="ib-rays" />
      <span className="ib-flash" />
      <Sparkles count={20} seed={rect.width + rect.top} />
    </span>
  );
}

function MedalFlourish({ medal: { tier, art, card } }: { medal: MedalPop }) {
  const colour = metalOf(tier.tier);
  const centre = { left: art.left + art.width / 2, top: art.top + art.height / 2 };
  return (
    <>
      <span className="ib-burst ib-medal-burst" data-rare="" style={{ ...centre, width: art.width, height: art.width, "--burst": colour, "--rarity-color": colour } as CSSProperties}>
        <span className="ib-rays" />
        <span className="ib-flash" />
        <Sparkles count={16} seed={art.width + art.top} />
        {tier.tier === "diamond" && <Confetti size="gold" seed={art.left + art.top} />}
      </span>
      <span className="ib-caption ib-medal-caption" style={{ left: centre.left, top: card.bottom + 14, "--burst": colour } as CSSProperties}>
        {medalWordsOf(tier)}
      </span>
    </>
  );
}

function saidOf({ caption, face, medal }: Flight) {
  if (medal !== null) return `${medalWordsOf(medal.tier)} medal unlocked`;
  return caption && face !== null ? `${nameOf(face)}: ${whatOf(face)}` : "";
}

export function nameOf(face: TurnedFaceShown) {
  return face.kind === "hoggie" ? face.drop.name : (face.thanked.name ?? "Your teammate");
}

export function whatOf(face: TurnedFaceShown) {
  const fresh = face.kind === "hoggie" ? face.drop.isNew : face.isNew;
  const what = face.kind === "hoggie" ? `${rarityWordOf(face.drop.rarity)} hoggie` : "Sticker";
  return fresh ? `${what} · New` : what;
}

function colourOf(face: TurnedFaceShown) {
  return face.kind === "hoggie" ? `var(--rarity-${face.drop.rarity})` : "var(--al-accent)";
}
