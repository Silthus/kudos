export type Entry = { id: string; name: string; value: number };

export type BoardRow = { rank: number; id: string; name: string; value: number; viewer: boolean };

export type BoardView = {
  rows: Array<BoardRow | { gap: true }>;
  viewerAbsent?: "not-ranked";
};

const topPositions = 3;
const positionsAroundViewer = 3;
const mostRows = 10;
const lastPositionShowingTheFirstTen = mostRows - positionsAroundViewer;

export function board(entries: Entry[], viewer: string | null): BoardView {
  const ranked = rankedRows(entries, viewer);
  const viewerPosition = ranked.findIndex((row) => row.viewer) + 1;
  if (viewerPosition === 0) return { rows: ranked.slice(0, topPositions), viewerAbsent: "not-ranked" };
  if (viewerPosition <= lastPositionShowingTheFirstTen) return { rows: ranked.slice(0, mostRows) };

  const aroundViewer = ranked.slice(viewerPosition - 1 - positionsAroundViewer, viewerPosition + positionsAroundViewer);
  const skipsPositions = viewerPosition - positionsAroundViewer > topPositions + 1;
  return { rows: [...ranked.slice(0, topPositions), ...(skipsPositions ? [{ gap: true as const }] : []), ...aroundViewer] };
}

function rankedRows(entries: Entry[], viewer: string | null): BoardRow[] {
  const ordered = entries.filter((entry) => entry.value > 0).toSorted(byValueThenName);
  return ordered.map((entry) => ({
    ...entry,
    rank: ordered.findIndex((other) => other.value === entry.value) + 1,
    viewer: entry.id === viewer,
  }));
}

function byValueThenName(a: Entry, b: Entry) {
  return b.value - a.value || a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id);
}
