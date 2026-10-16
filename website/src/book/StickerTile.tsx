import type { Sticker } from "../collectionRead";
import { MemberFace } from "../Face";
import { dateWords } from "./dates";
import { Tag } from "./Tag";

type StickerTileProps = { sticker: Sticker; fresh: boolean; timeZone: string };

export function StickerTile({ sticker, fresh, timeZone }: StickerTileProps) {
  return (
    <li data-sticker={sticker.key} data-former={sticker.former ? "" : undefined} className="relative flex flex-col items-center gap-1.5 rounded-lg border bg-card px-1.5 pb-2 pt-3 text-center">
      <StickerFace sticker={sticker} className="size-16" />
      <span className={`w-full truncate text-xs font-medium ${sticker.former ? "text-muted-foreground" : ""}`}>{sticker.name}</span>
      <span className="text-[11px] leading-tight tabular-nums text-muted-foreground">{dateWords(sticker.firstAt, timeZone)}</span>
      {sticker.former && <span className="text-[11px] leading-tight text-muted-foreground">Former teammate</span>}
      {fresh && <Tag className="absolute -left-1 -top-1">New</Tag>}
    </li>
  );
}

export function StickerFace({ sticker, className }: { sticker: Pick<Sticker, "face" | "former">; className: string }) {
  return (
    <span className="sticker-face inline-flex shrink-0 rounded-full">
      <MemberFace face={sticker.face} className={`${className} ${sticker.former ? "grayscale" : ""}`} />
    </span>
  );
}

export function stickerWordsOf(stickers: Sticker[]) {
  if (stickers.length === 0) return "No stickers of teammates yet";
  return stickers.length === 1 ? "1 sticker of a teammate" : `${stickers.length} stickers of teammates`;
}
