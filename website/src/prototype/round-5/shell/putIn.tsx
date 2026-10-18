// PROTOTYPE (#625, round 5): putting opened cards in: each face flies from the top-bar tray to its slot on the team page, each hoggie to the sidebar. Never merge to main.
import { useCallback, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useNavigate } from "../../../AppLink";
import { HoggieArt, MemberFace } from "../../art";
import { useAlbum, type Album, type AlbumActions, type PackOpening } from "../../round-3/album";
import { packsHash, type Place } from "../address";
import { boxOf, burstAt, fly, motionReduced, type Box } from "./Flights";
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
    await Promise.all(plan.hoggiesOnly.map((opening, index) => pause(index * 260).then(() => putInAHoggie(opening, live))));
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
    await calmly(420, 300);
  }
  const hoggies: Promise<void>[] = [];
  for (const opening of visit.openings) {
    const { hoggieLands } = await putInAFace(opening, live);
    hoggies.push(hoggieLands);
    await calmly(200, 500);
  }
  await Promise.all(hoggies);
  if (!visit.completes) return calmly(500, 400);
  await calmly(380, 0);
  burstAt(document.querySelector(".r4t-a-seal"));
  await calmly(2200, 900);
}

async function putInAFace(opening: PackOpening, live: () => Live): Promise<{ hoggieLands: Promise<void> }> {
  const from = trayBox();
  keepOutOfTheTray(opening.pack.id);
  const hoggieLands = flyTheHoggie(opening, from, 180);
  const sticker = await soon(() => document.querySelector<HTMLElement>(stickerOf(opening.person.key)));
  if (sticker !== null) {
    showWhole(sticker);
    await fly({ content: <FlyingFace opening={opening} />, width: sticker.offsetWidth, height: sticker.offsetHeight, from, to: boxOf(sticker), arc: 110, durationMs: 780, peak: 150 });
  }
  live().actions.place(opening.pack.id);
  showInTheTray(opening.pack.id);
  oneMorePutIn();
  return { hoggieLands };
}

async function putInAHoggie(opening: PackOpening, live: () => Live) {
  keepOutOfTheTray(opening.pack.id);
  await flyTheHoggie(opening, trayBox(), 0);
  live().actions.place(opening.pack.id);
  live().actions.forgetOpening();
  showInTheTray(opening.pack.id);
  oneMorePutIn();
}

async function flyTheHoggie(opening: PackOpening, from: Box, delayMs: number) {
  const target = hoggiesEntry();
  if (target !== null) await fly({ content: <FlyingHoggie opening={opening} />, width: hoggieFlightSize, height: hoggieFlightSize, from, to: boxOf(target), arc: 70, durationMs: 760, delayMs, spin: 14, peak: 96 });
  hoggieLanded(opening.hoggie.isNew);
}

function stickerOf(person: string) {
  return `.r4t a[href$="#people/${person}"] .r4t-sticker`;
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
