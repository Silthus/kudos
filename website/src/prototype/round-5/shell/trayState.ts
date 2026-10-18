// PROTOTYPE (#625, round 5): what the tray and sidebar show while cards are still flying: cards not in the tray yet, the hoggie count held back, landings and the put-in progress. Never merge to main.
import { storeOf } from "./store";

const notInTheTray = storeOf<ReadonlySet<string>>(new Set());

export const useNotInTheTray = notInTheTray.use;

export function keepOutOfTheTray(packId: string) {
  notInTheTray.set(new Set([...notInTheTray.get(), packId]));
}

export function showInTheTray(packId: string) {
  if (!notInTheTray.get().has(packId)) return;
  notInTheTray.set(new Set([...notInTheTray.get()].filter((id) => id !== packId)));
}

const heldHoggiesFound = storeOf<number | null>(null);

export const useHeldHoggiesFound = heldHoggiesFound.use;

export function holdHoggiesFoundAt(count: number) {
  heldHoggiesFound.set(count);
}

export function releaseHoggiesFound() {
  heldHoggiesFound.set(null);
}

const hoggieLandings = storeOf(0);

export const useHoggieLandings = hoggieLandings.use;

export function hoggieLanded(isNew: boolean) {
  const held = heldHoggiesFound.get();
  if (held !== null && isNew) heldHoggiesFound.set(held + 1);
  hoggieLandings.set(hoggieLandings.get() + 1);
}

export type Progress = { done: number; total: number };

const puttingIn = storeOf<Progress | null>(null);

export const usePuttingIn = puttingIn.use;

export const isPuttingIn = () => puttingIn.get() !== null;

export function startPuttingIn(total: number) {
  puttingIn.set({ done: 0, total });
}

export function oneMorePutIn() {
  const progress = puttingIn.get();
  if (progress !== null) puttingIn.set({ ...progress, done: progress.done + 1 });
}

export function finishPuttingIn() {
  puttingIn.set(null);
}
