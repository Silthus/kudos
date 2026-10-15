import { useEffect, useState } from "react";
import { hasSeen, markSeen } from "../crates/seen";

export function useFreshKeys(keys: string[]): ReadonlySet<string> {
  const joined = keys.join(" ");
  const [fresh] = useState(() => new Set(keys.filter((key) => !hasSeen(key))));
  useEffect(() => {
    for (const key of joined.split(" ")) if (key !== "") markSeen(key);
  }, [joined]);
  return fresh;
}
