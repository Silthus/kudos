import { createContext, useContext } from "react";
import type { Capturer } from "./capture";

export const CapturingContext = createContext<Capturer | null>(null);

export function useCapturing(): Capturer | null {
  return useContext(CapturingContext);
}
