import { IconSearch } from "@posthog/icons";
import { useId, useState } from "react";
import { AppLink } from "../AppLink";
import type { Album, AlbumEmoji } from "./answer";
import { AddToSlackButton } from "./AddToSlackButton";
import { EmojiPicture } from "./EmojiPicture";
import { howToUnlockWords, isReadyToUnlock, matchesSearch, milestoneGroupsOf, milestonesShown, shareOf, shelvesOf, teamOf, tierWords, useItInSlackWords, whyWords, type MilestoneGroup, type Shelf } from "./emojiShelf";
import { hrefOf } from "./place";
import "./emoji.css";

type PanelProps = { album: Album; onFollow: () => void };

export function EmojiPanel({ album, onFollow }: PanelProps) {
  const [search, setSearch] = useState("");
  const searching = search.trim() !== "";
  const shelves = shelvesOf(album.emojis);
  const earned = shelves.reduce((count, shelf) => count + shelf.earned.length, 0);
  const shown = shelves.reduce((count, shelf) => count + shelf.earned.length + shelf.locked.length, 0);
  return (
    <div className="al-emoji-panel">
      <div className="al-emoji-panel-head">
        <h2 className="al-emoji-panel-title">
          Your emojis <span className="al-quiet">· {earned} of {shown}</span>
        </h2>
        <p className="al-emoji-panel-hint">Emojis marked In Slack work there: react with them and put them in the kudos you give.</p>
        <label className="al-emoji-search">
          <IconSearch aria-hidden="true" />
          <input type="search" placeholder="Find an emoji, a team or a person" aria-label="Find an emoji" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {searching ? <Found album={album} search={search} onFollow={onFollow} /> : shelves.map((shelf) => <ShelfSection key={shelf.kind.kind} album={album} shelf={shelf} onFollow={onFollow} />)}
    </div>
  );
}

function ShelfSection({ album, shelf, onFollow }: { album: Album; shelf: Shelf; onFollow: () => void }) {
  const moreHype = album.moreEmojis;
  const [all, setAll] = useState(false);
  const title = useId();
  const { kind, earned, locked } = shelf;
  if (kind.kind === "random" && earned.length === 0) return null;
  const groups = kind.kind === "milestone" ? milestoneGroupsOf([...earned, ...locked]) : null;
  const earnedShown = all ? earned : earned.slice(0, kind.earnedShown);
  const lockedShown = all ? locked : locked.slice(0, kind.lockedShown);
  const hidden = groups !== null ? (all ? 0 : Math.max(0, groups.length - milestonesShown)) : earned.length + locked.length - earnedShown.length - lockedShown.length;
  return (
    <section className="al-emoji-shelf" aria-labelledby={title}>
      <h3 id={title} className="al-emoji-shelf-title">
        <span>{kind.title}</span>{" "}
        <span className="al-quiet">{kind.onlyEarned ? earned.length : `${earned.length} of ${earned.length + locked.length}`}</span>
      </h3>
      {earned.length === 0 && <p className="al-emoji-none">None yet. {kind.hint}</p>}
      {groups === null ? <EmojiRows album={album} emojis={[...earnedShown, ...lockedShown]} onFollow={onFollow} /> : <MilestoneGroups album={album} groups={all ? groups : groups.slice(0, milestonesShown)} />}
      {earned.length > 0 && kind.onlyEarned && <p className="al-emoji-none">{kind.hint}</p>}
      {kind.kind === "hype" && moreHype && <MoreHype />}
      {(all || hidden > 0) && (
        <button type="button" className="al-emoji-more" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all · ${hidden} more`}
        </button>
      )}
    </section>
  );
}

function MilestoneGroups({ album, groups }: { album: Album; groups: MilestoneGroup[] }) {
  return groups.map((group) => <MilestoneEmojis key={group.milestone} album={album} group={group} />);
}

function MilestoneEmojis({ album, group }: { album: Album; group: MilestoneGroup }) {
  const title = useId();
  const earned = group.emojis.filter((emoji) => emoji.earned).length;
  return (
    <section className="al-emoji-group" aria-labelledby={title}>
      <h4 id={title} className="al-emoji-group-title">
        <span>{group.name}</span>{" "}
        <span className="al-quiet">
          {earned} of {group.emojis.length}
        </span>
      </h4>
      <ul className="al-emoji-rows">
        {group.emojis.map((emoji) => (
          <li key={emoji.id} className="al-emoji-row" data-locked={emoji.earned ? undefined : ""}>
            <TierEmoji emoji={emoji} emojiPage={album.emojiPage} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TierEmoji({ emoji, emojiPage }: { emoji: AlbumEmoji; emojiPage: string | null }) {
  return (
    <>
      <EmojiPicture emoji={emoji} size={36} locked={!emoji.earned} />
      <span className="al-emoji-words">
        <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
        <span className="al-emoji-why">{tierWords(emoji)}</span>
        {!emoji.earned && <ProgressBar emoji={emoji} />}
      </span>
      {emoji.earned && <SlackStatus emoji={emoji} emojiPage={emojiPage} />}
    </>
  );
}

function ProgressBar({ emoji }: { emoji: AlbumEmoji }) {
  return (
    <span className="al-emoji-bar" aria-hidden="true">
      <span style={{ width: `${Math.max(4, shareOf(emoji) * 100)}%` }} />
    </span>
  );
}

function Found({ album, search, onFollow }: { album: Album; search: string; onFollow: () => void }) {
  const found = shelvesOf(album.emojis.filter((emoji) => matchesSearch(emoji, search))).flatMap(({ earned, locked }) => [...earned, ...locked]);
  return (
    <section className="al-emoji-shelf" aria-label="Matches">
      {found.length === 0 ? <p className="al-emoji-none ph-no-capture">No emoji matches “{search.trim()}”.</p> : <EmojiRows album={album} emojis={found} onFollow={onFollow} />}
      {album.moreEmojis && <MoreHype />}
    </section>
  );
}

function MoreHype() {
  return <p className="al-emoji-none">You have more hype emojis than the popup lists.</p>;
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
        <ProgressBar emoji={emoji} />
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
