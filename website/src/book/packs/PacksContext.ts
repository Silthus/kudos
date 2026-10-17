import { createContext, useContext } from "react";
import type { PackSession } from "./usePackSession";

const PacksContext = createContext<PackSession | undefined>(undefined);

export const PacksProvider = PacksContext.Provider;

export function usePacks() {
  return useContext(PacksContext);
}
