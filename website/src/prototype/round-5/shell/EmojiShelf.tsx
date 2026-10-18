// PROTOTYPE (#625, round 6): the top-bar emoji button and its popup: your emojis by kind, the nearest few you could unlock next and how, then "Show all" or a search. Never merge to main.
import { IconEmoji, IconSearch } from "@posthog/icons";
import { useRef, useState } from "react";
import { AppLink } from "../../../AppLink";
import { useAlbum, type Album, type Emoji } from "../../round-3/album";
import { hrefOf } from "../address";
import { EmojiArt } from "./EmojiArt";
import { anyUnseen, firstFewOf, kinds, matches, progressWordsOf, readyToClaim, shelfOf, shownCountOf, type Shelf } from "./emojis";
import { useClosingFromOutside } from "./Tray";
import "./emoji.css";

export function EmojiButton() {
  const { album } = useAlbum();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useClosingFromOutside(open, root, close);
  const count = shownCountOf(album);
  const fresh = anyUnseen(album);
  return (
    <div className="r6s-emoji" ref={root}>
      <button type="button" className="r6s-emoji-button" aria-expanded={open} aria-controls="r6s-emoji-panel" onClick={() => setOpen(!open)} aria-label={`Your emojis, ${count} unlocked${fresh ? ", a new one is on its way" : ""}`}>
        <span className="r6s-emoji-glyph" aria-hidden="true">
          <IconEmoji />
          {fresh && <span className="r6s-emoji-dot" />}
        </span>
        <span key={count} className="r6s-emoji-count" aria-hidden="true">
          {count}
        </span>
      </button>
      {open && <EmojiPanel album={album} onFollow={close} />}
    </div>
  );
}

function EmojiPanel({ album, onFollow }: { album: Album; onFollow: () => void }) {
  const [search, setSearch] = useState("");
  const unlocked = shownCountOf(album);
  return (
    <div id="r6s-emoji-panel" className="r6s-emoji-panel" role="dialog" aria-label="Your emojis">
      <div className="r6s-emoji-head">
        <h2>
          Your emojis <span className="r6s-quiet">· {unlocked} of {album.emojis.length}</span>
        </h2>
        <p>They work in Slack: react with them, or put them in a kudos.</p>
        <label className="r6s-emoji-search">
          <IconSearch aria-hidden="true" />
          <input type="search" placeholder="Find an emoji, a team or a person" aria-label="Find an emoji" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
        </label>
      </div>
      {search.trim() === "" ? kinds.map((kind) => <KindSection key={kind.kind} album={album} shelf={shelfOf(album, kind)} onFollow={onFollow} />) : <Found album={album} search={search} onFollow={onFollow} />}
    </div>
  );
}

function KindSection({ album, shelf, onFollow }: { album: Album; shelf: Shelf; onFollow: () => void }) {
  const [all, setAll] = useState(false);
  const few = firstFewOf(shelf);
  const unlocked = all ? shelf.unlocked : few.unlocked;
  const locked = all ? shelf.locked : few.locked;
  const hidden = shelf.unlocked.length + shelf.locked.length - unlocked.length - locked.length;
  return (
    <section className="r6s-kind" aria-labelledby={`r6s-kind-${shelf.kind.kind}`}>
      <h3 id={`r6s-kind-${shelf.kind.kind}`} className="r6s-kind-title">
        <span>{shelf.kind.title}</span>
        <span className="r6s-quiet">
          {shelf.unlocked.length} of {shelf.total}
        </span>
      </h3>
      {unlocked.length > 0 && <UnlockedTiles album={album} emojis={unlocked} />}
      {unlocked.length === 0 && <p className="r6s-kind-none">None yet.</p>}
      <p className="r6s-kind-hint">{shelf.kind.hint}</p>
      {locked.length > 0 && <LockedRows album={album} emojis={locked} onFollow={onFollow} />}
      {hidden > 0 && (
        <button type="button" className="r6s-more" onClick={() => setAll(true)}>
          Show all · {hidden} more
        </button>
      )}
      {all && (
        <button type="button" className="r6s-more" onClick={() => setAll(false)}>
          Show fewer
        </button>
      )}
    </section>
  );
}

function UnlockedTiles({ album, emojis }: { album: Album; emojis: Emoji[] }) {
  return (
    <ul className="r6s-tiles">
      {emojis.map((emoji) => (
        <li key={emoji.id} className="r6s-tile" data-new={emoji.seen ? undefined : ""} title={`${emoji.name} · ${emoji.label}`}>
          <EmojiArt album={album} emoji={emoji} size={40} />
          <span className="r6s-tile-name">{emoji.name}</span>
          {!emoji.seen && <span className="r6s-tile-new">New</span>}
        </li>
      ))}
    </ul>
  );
}

function LockedRows({ album, emojis, onFollow }: { album: Album; emojis: Emoji[]; onFollow: () => void }) {
  return (
    <ul className="r6s-locked">
      {emojis.map((emoji) => (
        <li key={emoji.id}>
          <LockedRow album={album} emoji={emoji} onFollow={onFollow} />
        </li>
      ))}
    </ul>
  );
}

function LockedRow({ album, emoji, onFollow }: { album: Album; emoji: Emoji; onFollow: () => void }) {
  const ready = readyToClaim(emoji);
  const progress = emoji.progress;
  const body = (
    <>
      <EmojiArt album={album} emoji={emoji} size={32} />
      <span className="r6s-locked-words">
        <strong>{progressWordsOf(album, emoji)}</strong>
        <span className="r6s-quiet">
          {emoji.name} · {emoji.howTo}
        </span>
        {progress !== null && (
          <span className="r6s-locked-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, (progress.have / progress.need) * 100)}%` }} />
          </span>
        )}
      </span>
    </>
  );
  if (ready && emoji.source.kind === "team")
    return (
      <AppLink href={hrefOf({ kind: "team", team: emoji.source.team })} className="r6s-locked-row" data-ready="" onFollow={onFollow}>
        {body}
      </AppLink>
    );
  return <span className="r6s-locked-row">{body}</span>;
}

function Found({ album, search, onFollow }: { album: Album; search: string; onFollow: () => void }) {
  const found = album.emojis.filter((emoji) => matches(album, emoji, search));
  const unlocked = found.filter(({ unlocked: has }) => has);
  const locked = found.filter(({ unlocked: has }) => !has).slice(0, 30);
  if (found.length === 0) return <p className="r6s-kind-none r6s-found-none">No emoji matches “{search.trim()}”.</p>;
  return (
    <section className="r6s-kind" aria-label="Matches">
      {unlocked.length > 0 && <UnlockedTiles album={album} emojis={unlocked} />}
      {locked.length > 0 && <LockedRows album={album} emojis={locked} onFollow={onFollow} />}
    </section>
  );
}
