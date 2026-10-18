// PROTOTYPE (#625, round 6): putting opened cards in, one deliberate card at a time: the slot beckons, the face lifts out of the tray and lands in it, then its hoggie presses into the Hoggies entry. Never merge to main.
import { useCallback, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useNavigate } from "../../../AppLink";
import { HoggieArt, MemberFace } from "../../art";
import { useAlbum, type Album, type AlbumActions, type PackOpening } from "../../round-3/album";
import { packsHash, type Place } from "../address";
import { teamColourOf } from "./Cards";
import { beckonAt, boxOf, fly, motionReduced, type Box } from "./Flights";
import { closePacks } from "./history";
import { planOf, teamPageHref, type Visit } from "./plan";
import { finishPuttingIn, holdHoggiesFoundAt, hoggieLanded, isPuttingIn, keepOutOfTheTray, oneMorePutIn, releaseHoggiesFound, showInTheTray, startPuttingIn } from "./trayState";

type Live = { album: Album; actions: AlbumActions; navigate: (href: string) => void; place: Place };

export type PutIn = (packIds: string[] | "all") => void;

export function usePutIn(place: Place): PutIn {
  const { album, actions } = useAlbum();
  const navigate = useNavigate();
  const live = useRef<Live>({ album, actions, navigate, place });
  useLayoutEffect(() => {
    live.current = { album, actions, navigate, place };
  });
  return useCallback((packIds) => void putIn(packIds, () => live.current), []);
}

const hoggieFlightSize = 84;

const faceFlightSize = 120;

const beatMs = 350;

const beckonMs = 480;

const liftAndTravelMs = 1310;

function pause(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function calmly(movingMs: number, stillMs: number) {
  return pause(motionReduced() ? stillMs : movingMs);
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function soon<T>(find: () => T | null, withinMs = 1500): Promise<T | null> {
  const until = performance.now() + withinMs;
  for (;;) {
    const found = find();
    if (found !== null || performance.now() > until) return found;
    await nextFrame();
  }
}

async function putIn(packIds: string[] | "all", live: () => Live) {
  if (isPuttingIn()) return;
  startPuttingIn(0);
  try {
    if (window.location.hash === packsHash) closePacks();
    await soon(() => (window.location.hash === packsHash ? null : true));
    await nextFrame();
    const { album, place } = live();
    const openings = album.tray.filter(({ pack }) => packIds === "all" || packIds.includes(pack.id));
    const plan = planOf(album, openings, currentTeamOf(album, place));
    startPuttingIn(openings.length);
    holdHoggiesFoundAt(album.hoggiesFound);
    for (const opening of plan.hoggiesOnly) await putInAHoggie(opening, live);
    for (const visit of plan.visits) await visitTeam(visit, live);
  } finally {
    releaseHoggiesFound();
    finishPuttingIn();
  }
}

function currentTeamOf(album: Album, place: Place) {
  if (place.kind !== "team") return null;
  return place.team ?? album.teams.find(({ mine }) => mine)!.team;
}

async function visitTeam(visit: Visit, live: () => Live) {
  if (currentTeamOf(live().album, live().place) !== visit.team.team) {
    live().navigate(teamPageHref(visit.team));
    await calmly(520, 300);
  }
  for (const opening of visit.openings) {
    await putInAFace(opening, live);
    await calmly(beatMs, 200);
    await flyTheHoggie(opening);
    await calmly(beatMs, 200);
  }
  if (!visit.completes) return calmly(300, 300);
  await beckonTheSeal();
}

async function beckonTheSeal() {
  const stopBeckoning = beckonAt(document.querySelector(sealSelector), true);
  await calmly(1200, 600);
  stopBeckoning();
}

async function putInAFace(opening: PackOpening, live: () => Live) {
  const slot = await soon(() => slotOf(opening.person.key));
  if (slot !== null) {
    showWhole(slot);
    await nextFrame();
    const stopBeckoning = beckonAt(slot);
    await calmly(beckonMs, 0);
    stopBeckoning();
  }
  const from = trayBox();
  keepOutOfTheTray(opening.pack.id);
  if (slot !== null) {
    const fading = fadeTheSilhouette(slot);
    await fly({ content: <FlyingFace opening={opening} />, width: faceFlightSize, height: faceFlightSize, from, to: boxOf(slot), arc: 140, durationMs: 860, spin: 7, peak: 132, lift: true, landing: { colour: teamColourOf(live().album, opening.person.teams[0]!), sparkles: 10, press: "card" } });
    fading.cancel();
  }
  live().actions.place(opening.pack.id);
  showInTheTray(opening.pack.id);
  oneMorePutIn();
}

async function putInAHoggie(opening: PackOpening, live: () => Live) {
  keepOutOfTheTray(opening.pack.id);
  await flyTheHoggie(opening);
  live().actions.place(opening.pack.id);
  live().actions.forgetOpening();
  showInTheTray(opening.pack.id);
  oneMorePutIn();
  await calmly(beatMs, 200);
}

async function flyTheHoggie(opening: PackOpening) {
  const target = hoggiesEntry();
  if (target !== null) {
    const stopBeckoning = beckonAt(target, true);
    await calmly(220, 0);
    await fly({ content: <FlyingHoggie opening={opening} />, width: hoggieFlightSize, height: hoggieFlightSize, from: trayBox(), to: boxOf(target), arc: 90, durationMs: 780, spin: -10, peak: 104, lift: true, landing: { colour: `var(--rarity-${opening.hoggie.rarity})`, sparkles: 9, press: "sticker" } });
    stopBeckoning();
  }
  hoggieLanded(opening.hoggie.isNew);
}

function fadeTheSilhouette(slot: HTMLElement) {
  return slot.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0.15 }], { duration: motionReduced() ? 240 : liftAndTravelMs, fill: "forwards", easing: "ease-in" });
}

const sealSelector = ".r5-main :is(.r6t-a-seal, .r4t-a-seal, [data-r6-seal])";

function slotOf(person: string) {
  const link = `.r5-main a[href$="#people/${person}"]`;
  return document.querySelector<HTMLElement>(`.r5-main [data-r6-slot="${person}"]`) ?? document.querySelector<HTMLElement>(`${link} :is(.r6t-sticker, .r4t-sticker)`) ?? document.querySelector<HTMLElement>(link);
}

function showWhole(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  if (box.top >= 60 && box.bottom <= window.innerHeight) return;
  element.scrollIntoView({ block: "center", behavior: "instant" });
}

function shown(element: Element | null) {
  return element !== null && element.getClientRects().length > 0 ? element : null;
}

function trayBox(): Box {
  const source = shown(document.querySelector(".r5 .r5-tray-stack")) ?? shown(document.querySelector(".r5 .r5-packs"));
  return source === null ? { left: window.innerWidth - 220, top: 12, width: 36, height: 36 } : boxOf(source);
}

function hoggiesEntry() {
  return shown(document.querySelector('.r5 [data-side-page="hoggies"] .r5-page-icon')) ?? shown(document.querySelector(".r5 .r5-side-toggle"));
}

function FlyingFace({ opening }: { opening: PackOpening }) {
  return (
    <span className="r5-fly-face">
      <MemberFace face={opening.person.face} className="r5-fly-face-img" />
    </span>
  );
}

function FlyingHoggie({ opening }: { opening: PackOpening }) {
  return (
    <span className="r5-fly-hoggie" style={{ "--rarity": `var(--rarity-${opening.hoggie.rarity})` } as CSSProperties}>
      <HoggieArt slug={opening.hoggie.hoggie} size={hoggieFlightSize - 12} />
    </span>
  );
}
