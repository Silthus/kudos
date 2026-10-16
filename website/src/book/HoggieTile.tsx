import { Button } from "@posthog/quill";
import type { CSSProperties } from "react";
import type { CollectionHoggie } from "../collectionRead";
import type { AvatarChoice } from "./avatarChoice";
import { dateWords } from "./dates";
import { HoggieCoin } from "./HoggieCoin";
import { Tag } from "./Tag";

type HoggieTileProps = { hoggie: CollectionHoggie; fresh: boolean; timeZone: string; avatar: AvatarChoice | null };

export function HoggieTile({ hoggie, fresh, timeZone, avatar }: HoggieTileProps) {
  const found = hoggie.firstAt !== null;
  const isAvatar = avatar?.current?.hoggie === hoggie.hoggie;
  return (
    <li data-hoggie={hoggie.hoggie} data-held={found ? "found" : "missing"} data-avatar-current={isAvatar || undefined} aria-current={isAvatar ? "true" : undefined} data-rarity={hoggie.rarity} className="hoggie-tile relative flex flex-col items-center gap-1.5 rounded-lg border bg-card px-1.5 pb-2 pt-3 text-center" style={{ "--rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
      <HoggieCoin art={hoggie.art} rarity={hoggie.rarity} size={64} found={found} />
      <span className={`w-full truncate text-xs font-medium ${found ? "" : "text-muted-foreground"}`}>{hoggie.name}</span>
      {hoggie.firstAt === null ? <span className="sr-only">Not found yet</span> : <span className="text-[11px] leading-tight tabular-nums text-muted-foreground">{dateWords(hoggie.firstAt, timeZone)}</span>}
      {hoggie.count > 1 && <span className="absolute -right-1 -top-1 rounded-full border bg-card px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums shadow-xs">{`×${hoggie.count}`}</span>}
      {fresh && <Tag className="absolute -left-1 -top-1">New</Tag>}
      {avatar !== null && <span className="flex min-h-6 items-center">{hoggie.count > 0 && <AvatarAction hoggie={hoggie} avatar={avatar} isAvatar={isAvatar} />}</span>}
    </li>
  );
}

function AvatarAction({ hoggie, avatar, isAvatar }: { hoggie: CollectionHoggie; avatar: AvatarChoice; isAvatar: boolean }) {
  if (isAvatar) return <Tag>Your avatar</Tag>;
  return (
    <Button variant="link-muted" size="xs" aria-label={`Use as avatar: ${hoggie.name}`} disabled={avatar.pending} onClick={() => avatar.choose(hoggie.hoggie)}>
      Use as avatar
    </Button>
  );
}
