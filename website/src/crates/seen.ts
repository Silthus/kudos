const prefix = "hedgehug.seen.";

export function hasSeen(seen: string) {
  try {
    return localStorage.getItem(prefix + seen) !== null;
  } catch {
    return false;
  }
}

export function markSeen(seen: string) {
  try {
    localStorage.setItem(prefix + seen, "1");
  } catch {
    return;
  }
}
