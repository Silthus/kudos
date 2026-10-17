// PROTOTYPE (#625): one printed page of the book, its folio and its turnable corner. Never merge to main.
import type { ReactNode } from "react";
import { HoggieSheet, TeamStickers, TeamTitle } from "./collectionPages";
import { ActivityGiven, ActivityReceived, BoardPodium, BoardRows, ContentsIndex, ContentsPlate, EarnedHalf, Endpaper, QuestsDone, QuestsNow, SettingsIntro, SettingsSheet, StoreCounter, StorePacks } from "./logPages";
import type { NumberedPage, PageView } from "./spreads";

export type Side = "left" | "right";

function contentOf(page: PageView): ReactNode {
  switch (page.kind) {
    case "contents-plate":
      return <ContentsPlate />;
    case "contents-index":
      return <ContentsIndex />;
    case "hoggies":
      return <HoggieSheet rarity={page.rarity} sheet={page.sheet} sheets={page.sheets} hoggies={page.hoggies} />;
    case "team-title":
      return <TeamTitle team={page.team} />;
    case "team-stickers":
      return <TeamStickers team={page.team} />;
    case "quests-now":
      return <QuestsNow />;
    case "quests-done":
      return <QuestsDone />;
    case "earned":
      return <EarnedHalf half={page.half} />;
    case "store-packs":
      return <StorePacks />;
    case "store-counter":
      return <StoreCounter />;
    case "activity-received":
      return <ActivityReceived />;
    case "activity-given":
      return <ActivityGiven />;
    case "board-podium":
      return <BoardPodium />;
    case "board-list":
      return <BoardRows />;
    case "settings-intro":
      return <SettingsIntro />;
    case "settings-sheet":
      return <SettingsSheet />;
    case "endpaper":
      return <Endpaper />;
  }
}

export function PageFace({ page, side, onCorner }: { page: NumberedPage | null; side: Side; onCorner?: () => void }) {
  if (page === null) return <div className="v2-page v2-page-blank" data-side={side} />;
  return (
    <div className="v2-page" data-side={side} data-kind={page.kind}>
      <div className="v2-page-body">{contentOf(page)}</div>
      <span className="v2-folio">{page.number}</span>
      {onCorner !== undefined && <button type="button" className="v2-corner" aria-label={side === "right" ? "Turn to the next page" : "Turn to the previous page"} onClick={onCorner} />}
    </div>
  );
}
