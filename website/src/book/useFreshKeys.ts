import { useEffect, useState } from "react";
import { hasSeen, markSeen } from "../crates/seen";

export function useFreshKeys(keys: string[]): ReadonlySet<string> {
  const joined = keys.join(" ");
  const [fresh, setFresh] = useState(() => new Set(unseenAmong(keys)));
  useEffect(() => {
    const arrived = unseenAmong(joined.split(" "));
    if (arrived.length === 0) return;
    setFresh((shown) => new Set([...shown, ...arrived]));
    for (const key of arrived) markSeen(key);
  }, [joined]);
  return fresh;
}

function unseenAmong(keys: string[]) {
  return keys.filter((key) => key !== "" && !hasSeen(key));
}
