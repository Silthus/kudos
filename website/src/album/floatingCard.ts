export type Room = { top: number; bottom: number; width: number };

export type Anchor = { top: number; bottom: number; left: number; width: number };

export type CardSize = { width: number; height: number };

export type Placement = { side: "above" | "below"; top: number; left: number };

const gap = 8;

export function placementOf(anchor: Anchor, card: CardSize, room: Room): Placement {
  const below = room.bottom - anchor.bottom - gap;
  const above = anchor.top - gap - room.top;
  const side = card.height <= below || below >= above ? "below" : "above";
  const wanted = side === "below" ? anchor.bottom + gap : anchor.top - gap - card.height;
  return { side, top: Math.max(room.top, Math.min(wanted, room.bottom - card.height)), left: Math.max(gap, Math.min(anchor.left + anchor.width / 2 - card.width / 2, room.width - card.width - gap)) };
}

export function roomOnScreen(): Room {
  const topBar = document.querySelector(".al-top")?.getBoundingClientRect().bottom ?? 0;
  return { top: topBar + gap, bottom: window.innerHeight - gap, width: window.innerWidth };
}
