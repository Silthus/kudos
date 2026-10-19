import { useMemo } from "react";
import { hrefOf } from "./place";

export type HoggieAddress = { open: (hoggie: string) => void; step: (hoggie: string) => void; close: () => void; showEveryRarity: () => void };

type Push = (href: string, state: unknown) => void;

type Replace = (href: string, state: unknown) => void;

const openedHere = "hoggieOpenedHere";

const pageHref = hrefOf({ kind: "hoggies", hoggie: null });

export function useHoggieAddress(push: Push, replace: Replace): HoggieAddress {
  return useMemo(
    () => ({
      open: (hoggie) => push(detailHrefOf(hoggie), { ...entryState(), [openedHere]: true }),
      step: (hoggie) => replace(detailHrefOf(hoggie), window.history.state),
      close: () => {
        if (openedHere in entryState()) window.history.back();
        else replace(pageHref, window.history.state);
      },
      showEveryRarity: () => replace(pageHref, null),
    }),
    [push, replace],
  );
}

function detailHrefOf(hoggie: string) {
  return hrefOf({ kind: "hoggies", hoggie });
}

function entryState(): object {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null ? state : {};
}
