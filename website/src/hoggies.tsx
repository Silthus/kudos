import {
  hedgehogCampfireCowboyPng,
  hedgehogClimber1Png,
  hedgehogCodingGroupPng,
  hedgehogConstruction1Png,
  hedgehogExplorerPng,
  hedgehogHandClaspPng,
  hedgehogHeartPng,
  hedgehogHourglassPng,
  hedgehogKatyPerryPng,
  hedgehogMegaphonePng,
  hedgehogMoneyPng,
  hedgehogNamastePng,
  hedgehogOrganizedPng,
  hedgehogPartyPng,
  hedgehogPuzzlePng,
  hedgehogReadingIsMagicPng,
  hedgehogReadingPng,
  hedgehogSafariPng,
  hedgehogSittingPng,
  hedgehogStampApprovedPng,
  hedgehogStarPng,
  hedgehogSuccessPng,
  hedgehogTownCrierPng,
  hedgehogWizard1Png,
} from "@posthog/brand/hoggies/png";
import { aspectRatio as mailboxAspectRatio, src as hedgehogMailboxPng } from "@posthog/brand/hoggies/png/mailbox";
import type { ComponentType, CSSProperties } from "react";

export type HoggieProps = { size: number; className?: string; silhouette?: boolean };

export type Hoggie = ComponentType<HoggieProps>;

type Picture = { src: string; aspectRatio: number };

export function HoggiePicture({ picture, size, className, silhouette = false }: HoggieProps & { picture: Picture }) {
  const height = Math.round(size / picture.aspectRatio);
  if (silhouette) return <Silhouette picture={picture} size={size} height={height} className={className} />;
  return <img src={picture.src} alt="" width={size} height={height} draggable={false} className={`h-auto ${className ?? ""}`} />;
}

function Silhouette({ picture, size, height, className }: { picture: Picture; size: number; height: number; className?: string }) {
  return (
    <svg aria-hidden="true" data-silhouette-art viewBox={`0 0 ${size} ${height}`} width={size} className={`hog-silhouette-art ${className ?? ""}`} style={{ "--art": `url("${picture.src}")` } as CSSProperties}>
      <rect width="100%" height="100%" fill="currentColor" />
    </svg>
  );
}

function drawn(src: string, aspectRatio = 1): Hoggie {
  const picture = { src, aspectRatio };
  return (props) => <HoggiePicture picture={picture} {...props} />;
}

export const HedgehogCampfireCowboy = drawn(hedgehogCampfireCowboyPng);
export const HedgehogClimber = drawn(hedgehogClimber1Png);
export const HedgehogCodingGroup = drawn(hedgehogCodingGroupPng);
export const HedgehogConstruction = drawn(hedgehogConstruction1Png);
export const HedgehogExplorer = drawn(hedgehogExplorerPng);
export const HedgehogHandClasp = drawn(hedgehogHandClaspPng);
export const HedgehogHeart = drawn(hedgehogHeartPng);
export const HedgehogHourglass = drawn(hedgehogHourglassPng);
export const HedgehogKatyPerry = drawn(hedgehogKatyPerryPng);
export const HedgehogMailbox = drawn(hedgehogMailboxPng, mailboxAspectRatio);
export const HedgehogMegaphone = drawn(hedgehogMegaphonePng);
export const HedgehogMoney = drawn(hedgehogMoneyPng);
export const HedgehogNamaste = drawn(hedgehogNamastePng);
export const HedgehogOrganized = drawn(hedgehogOrganizedPng);
export const HedgehogParty = drawn(hedgehogPartyPng);
export const HedgehogPuzzle = drawn(hedgehogPuzzlePng);
export const HedgehogReading = drawn(hedgehogReadingPng);
export const HedgehogReadingIsMagic = drawn(hedgehogReadingIsMagicPng);
export const HedgehogSafari = drawn(hedgehogSafariPng);
export const HedgehogSitting = drawn(hedgehogSittingPng);
export const HedgehogStampApproved = drawn(hedgehogStampApprovedPng);
export const HedgehogStar = drawn(hedgehogStarPng);
export const HedgehogSuccess = drawn(hedgehogSuccessPng);
export const HedgehogTownCrier = drawn(hedgehogTownCrierPng);
export const HedgehogWizard = drawn(hedgehogWizard1Png);
