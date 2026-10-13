import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";

const graceMs = 5_000;

export function useSocketUnreachable() {
  const { isWebSocketConnected } = useConvexConnectionState();
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    setGraceOver(false);
    if (isWebSocketConnected) return;
    const timer = setTimeout(() => setGraceOver(true), graceMs);
    return () => clearTimeout(timer);
  }, [isWebSocketConnected]);
  return !isWebSocketConnected && graceOver;
}
