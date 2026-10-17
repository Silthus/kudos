// PROTOTYPE (#625): what every page of the book can reach: the world and the reader's hands. Never merge to main.
import { createContext, useContext, type ReactNode } from "react";
import type { Quest, World, WorldActions } from "../world";
import type { Spread } from "./spreads";

export type Desk = {
  world: World;
  actions: WorldActions;
  spreads: Spread[];
  stuck: string | null;
  settingsPage: ReactNode | null;
  go(address: string): void;
  openPack(packId: string): void;
  nudge(quest: Quest): void;
  finish(quest: Quest): void;
};

export const DeskContext = createContext<Desk | null>(null);

export function useDesk() {
  const desk = useContext(DeskContext);
  if (desk === null) throw new Error("useDesk needs the book's desk.");
  return desk;
}
