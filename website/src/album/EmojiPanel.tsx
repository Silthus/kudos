import { IconSearch } from "@posthog/icons";
import { useId, useState } from "react";
import { AppLink } from "../AppLink";
import type { Album, AlbumEmoji } from "./answer";
import { AddToSlackButton } from "./AddToSlackButton";
import { EmojiPicture } from "./EmojiPicture";
import { earnedCountOf, howToUnlockWords, isReadyToUnlock, matchesSearch, shareOf, shelvesOf, teamOf, useItInSlackWords, whyWords, type Shelf } from "./emojiShelf";
import { hrefOf } from "./place";
import "./emoji.css";

type PanelProps = { album: Album; onFollow: () => void };

export function EmojiPanel({ album, onFollow }: PanelProps) {
  const [search, setSearch] = useState("");
  const searching = search.trim() !== "";
  return (
    <div className="al-emoji-panel">
      <div className="al-emoji-panel-head">
        <h2 className="al-emoji-panel-title">
          Your emojis <span className="al-quiet">· {earnedCountOf(album.emojis)} of {album.emojis.length}</span>
        </h2>
        <p className="al-emoji-panel-hint">Emojis marked In Slack work there: react with them or put them in a kudos.</p>
        <label className="al-emoji-search">
          <IconSearch aria-hidden="true" />
          <input type="search" placeholder="Find an emoji, a team or a person" aria-label="Find an emoji" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {searching ? <Found album={album} search={search} onFollow={onFollow} /> : shelvesOf(album.emojis).map((shelf) => <ShelfSection key={shelf.kind.kind} album={album} shelf={shelf} onFollow={onFollow} />)}
    </div>
  );
}

function ShelfSection({ album, shelf, onFollow }: { album: Album; shelf: Shelf; onFollow: () => void }) {
  const [all, setAll] = useState(false);
  const title = useId();
  const { kind, earned, locked } = shelf;
  const earnedShown = all ? earned : earned.slice(0, kind.earnedShown);
  const lockedShown = all ? locked : locked.slice(0, kind.lockedShown);
  const hidden = earned.length + locked.length - earnedShown.length - lockedShown.length;
  return (
    <section className="al-emoji-shelf" aria-labelledby={title}>
      <h3 id={title} className="al-emoji-shelf-title">
        <span>{kind.title}</span>
        <span className="al-quiet">{kind.kind === "hype" ? earned.length : `${earned.length} of ${earned.length + locked.length}`}</span>
      </h3>
      {earned.length === 0 && <p className="al-emoji-none">None yet. {kind.hint}</p>}
      <EmojiRows album={album} emojis={[...earnedShown, ...lockedShown]} onFollow={onFollow} />
      {earned.length > 0 && kind.kind === "hype" && <p className="al-emoji-none">{kind.hint}</p>}
      {hidden > 0 && (
        <button type="button" className="al-emoji-more" onClick={() => setAll(true)}>
          Show all · {hidden} more
        </button>
      )}
    </section>
  );
}

function Found({ album, search, onFollow }: { album: Album; search: string; onFollow: () => void }) {
  const found = shelvesOf(album.emojis.filter((emoji) => matchesSearch(emoji, search))).flatMap(({ earned, locked }) => [...earned, ...locked]);
  if (found.length === 0) return <p className="al-emoji-none ph-no-capture">No emoji matches “{search.trim()}”.</p>;
  return (
    <section className="al-emoji-shelf" aria-label="Matches">
      <EmojiRows album={album} emojis={found} onFollow={onFollow} />
    </section>
  );
}

function EmojiRows({ album, emojis, onFollow }: { album: Album; emojis: AlbumEmoji[]; onFollow: () => void }) {
  if (emojis.length === 0) return null;
  return (
    <ul className="al-emoji-rows">
      {emojis.map((emoji) => (
        <li key={emoji.id} className="al-emoji-row" data-locked={emoji.earned ? undefined : ""}>
          {emoji.earned ? <EarnedEmoji emoji={emoji} emojiPage={album.emojiPage} /> : <LockedEmoji emoji={emoji} onFollow={onFollow} />}
        </li>
      ))}
    </ul>
  );
}

function EarnedEmoji({ emoji, emojiPage }: { emoji: AlbumEmoji; emojiPage: string | null }) {
  return (
    <>
      <EmojiPicture emoji={emoji} size={36} />
      <span className="al-emoji-words">
        <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
        <span className="al-emoji-why ph-no-capture">{whyWords(emoji)}</span>
      </span>
      <SlackStatus emoji={emoji} emojiPage={emojiPage} />
    </>
  );
}

export function SlackStatus({ emoji, emojiPage }: { emoji: Pick<AlbumEmoji, "kind" | "name" | "picture" | "from" | "inSlack">; emojiPage: string | null }) {
  if (!emoji.inSlack) return <AddToSlackButton emoji={emoji} emojiPage={emojiPage} />;
  return (
    <span className="al-emoji-in-slack" title={useItInSlackWords}>
      In Slack
    </span>
  );
}

function LockedEmoji({ emoji, onFollow }: { emoji: AlbumEmoji; onFollow: () => void }) {
  const team = teamOf(emoji);
  const body = (
    <>
      <EmojiPicture emoji={emoji} size={36} locked />
      <span className="al-emoji-words">
        <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
        <span className="al-emoji-why">{howToUnlockWords(emoji)}</span>
        <span className="al-emoji-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(4, shareOf(emoji) * 100)}%` }} />
        </span>
      </span>
    </>
  );
  if (team !== null && isReadyToUnlock(emoji))
    return (
      <AppLink href={hrefOf({ kind: "team", team })} className="al-emoji-ready" onFollow={onFollow}>
        {body}
      </AppLink>
    );
  return body;
}
