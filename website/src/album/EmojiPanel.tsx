import { IconSearch } from "@posthog/icons";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { hypeEmblemPicture } from "../../../convex/album/emojiCatalogue";
import type { LoopLesson } from "../../../convex/album/items/welcome";
import { AppLink } from "../AppLink";
import { NamedEmoji } from "../Emoji";
import type { Album, AlbumEmoji, PickKudosEmoji } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { NotInSlack, SetItUp } from "./findInSlack";
import { howToUnlockWords, isReadyToUnlock, matchesSearch, milestoneGroupsOf, milestonesShown, picksKudosEmojis, shareOf, shelvesOf, shownCountOf, teamOf, tierWords, unlockNextOf, usableNowOf, useItInSlackWords, whyWords, type MilestoneGroup, type NextEmoji, type Shelf } from "./emojiShelf";
import { NewLabel } from "./ItemBoard";
import { KudosEmojiPicker } from "./KudosEmojiPicker";
import { useNewInThePanel } from "./newEmojis";
import { hrefOf } from "./place";
import "./emoji.css";

type PanelProps = { album: Album; justUnlocked: string[]; onFollow: () => void; pickKudosEmoji: PickKudosEmoji };

export function EmojiPanel({ opensOnJustUnlocked, ...props }: PanelProps & { opensOnJustUnlocked: boolean }) {
  const { emojiHowTo } = props.album;
  if (emojiHowTo === undefined) return <AllEmojis {...props} />;
  return <EmojisToUse key={String(opensOnJustUnlocked)} {...props} howTo={emojiHowTo} opensOnAll={opensOnJustUnlocked} />;
}

function EmojisToUse({ album, justUnlocked, onFollow, pickKudosEmoji, howTo, opensOnAll }: PanelProps & { howTo: LoopLesson; opensOnAll: boolean }) {
  const [all, setAll] = useState(opensOnAll);
  const [moved, setMoved] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  const toAll = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (moved) (all ? back : toAll).current?.focus();
  }, [all, moved]);
  const show = (allShown: boolean) => {
    setAll(allShown);
    setMoved(true);
  };
  if (all)
    return (
      <>
        <button type="button" ref={back} className="al-emoji-back" aria-label="Back to the emojis you can use" onClick={() => show(false)}>
          <span aria-hidden="true">←</span> Use these now
        </button>
        <AllEmojis album={album} justUnlocked={justUnlocked} onFollow={onFollow} pickKudosEmoji={pickKudosEmoji} />
      </>
    );
  return (
    <div className="al-emoji-panel">
      <KudosEmojiPicker album={album} pickKudosEmoji={pickKudosEmoji} />
      <UseTheseNow album={album} howTo={howTo} />
      <UnlockNext album={album} onFollow={onFollow} />
      <button type="button" ref={toAll} className="al-emoji-all" onClick={() => show(true)}>
        All emojis · {shownCountOf(shelvesOf(album.emojis))} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function UseTheseNow({ album, howTo }: { album: Album; howTo: LoopLesson }) {
  return (
    <LeadingSection title="Use these now">
      <p className="al-emoji-panel-hint">
        {picksKudosEmojis(album) ? (
          <>
            React with any of them for a hug, like <NamedEmoji name={howTo.kudosEmoji} image={howTo.kudosEmojiImage ?? undefined} />: XP for you both.
          </>
        ) : (
          <>
            React with any of them or put them in a kudos. Each one counts like <NamedEmoji name={howTo.kudosEmoji} image={howTo.kudosEmojiImage ?? undefined} />: XP for you both, and an item when it's in a kudos.
          </>
        )}
      </p>
      <ul className="al-emoji-rows">
        <li className="al-emoji-row">
          <KudosEmojiPicture howTo={howTo} />
          <span className="al-emoji-words">
            <code className="al-emoji-code ph-no-capture">:{howTo.kudosEmoji}:</code>
            <span className="al-emoji-why">Your kudos emoji · {picksKudosEmojis(album) ? "always counts in kudos" : "works from the start"}</span>
          </span>
          <InSlack />
        </li>
        {usableNowOf(album.emojis).map((emoji) => (
          <li key={emoji.id} className="al-emoji-row">
            <EarnedEmoji emoji={emoji} status={emoji.inSlack ? <InSlack /> : <SetItUp emoji={emoji} emojiPage={album.emojiPage} />} />
          </li>
        ))}
      </ul>
    </LeadingSection>
  );
}

function KudosEmojiPicture({ howTo: { kudosEmoji, kudosEmojiImage } }: { howTo: LoopLesson }) {
  return (
    <span className="al-emoji-art ph-no-capture" data-kind="kudos" style={{ width: 36, height: 36 }} aria-hidden="true">
      {kudosEmojiImage === null ? <NamedEmoji name={kudosEmoji} /> : <img src={kudosEmojiImage} alt="" width={36} height={36} decoding="async" />}
    </span>
  );
}

function UnlockNext({ album, onFollow }: { album: Album; onFollow: () => void }) {
  const next = unlockNextOf(album.emojis);
  if (next.length === 0) return null;
  return (
    <LeadingSection title="Unlock next">
      <ul className="al-emoji-rows">
        {next.map((emoji) => (
          <li key={emoji.kind === "hype" ? "hype" : emoji.emoji.id} className="al-emoji-row" data-locked="">
            <NextEmojiRow next={emoji} onFollow={onFollow} />
          </li>
        ))}
      </ul>
    </LeadingSection>
  );
}

function NextEmojiRow({ next, onFollow }: { next: NextEmoji; onFollow: () => void }) {
  switch (next.kind) {
    case "levelTwo":
      return <LockedEmoji emoji={next.emoji} words="Reach level 2 · your first kudos does it" onFollow={onFollow} />;
    case "hype":
      return <HypeToUnlock />;
    case "nearest":
      return <LockedEmoji emoji={next.emoji} onFollow={onFollow} />;
  }
}

function HypeToUnlock() {
  return (
    <>
      <span className="al-emoji-art" data-kind="hype" data-locked="" style={{ width: 36, height: 36 }} aria-hidden="true">
        <img src={hypeEmblemPicture} alt="" width={36} height={36} loading="lazy" decoding="async" />
      </span>
      <span className="al-emoji-words">
        <span className="al-emoji-why">Give someone a kudos: unlock their hype emoji</span>
        <span className="al-emoji-bar" aria-hidden="true">
          <span style={{ width: "4%" }} />
        </span>
      </span>
    </>
  );
}

function LeadingSection({ title, children }: { title: string; children: ReactNode }) {
  const heading = useId();
  return (
    <section className="al-emoji-shelf" aria-labelledby={heading}>
      <h2 id={heading} className="al-emoji-panel-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AllEmojis({ album, justUnlocked, onFollow, pickKudosEmoji }: PanelProps) {
  const [search, setSearch] = useState("");
  const searching = search.trim() !== "";
  const shelves = shelvesOf(album.emojis);
  const earned = shelves.reduce((count, shelf) => count + shelf.earned.length, 0);
  const shown = shownCountOf(shelves);
  return (
    <div className="al-emoji-panel">
      <div className="al-emoji-panel-head">
        <h2 className="al-emoji-panel-title">
          Your emojis <span className="al-quiet">· {earned} of {shown}</span>
        </h2>
        <p className="al-emoji-panel-hint">Emojis marked In Slack work there: {picksKudosEmojis(album) ? "react with them for a hug, and count the ones you pick in the kudos you give." : "react with them and put them in the kudos you give."}</p>
        <label className="al-emoji-search">
          <IconSearch aria-hidden="true" />
          <input type="search" placeholder="Find an emoji, a team or a person" aria-label="Find an emoji" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {searching ? (
        <Found album={album} search={search} onFollow={onFollow} />
      ) : (
        <>
          <KudosEmojiPicker album={album} pickKudosEmoji={pickKudosEmoji} Heading="h3" />
          <JustUnlocked album={album} ids={justUnlocked} onFollow={onFollow} />
          {shelves.map((shelf) => (
            <ShelfSection key={shelf.kind.kind} album={album} shelf={shelf} onFollow={onFollow} />
          ))}
        </>
      )}
    </div>
  );
}

function JustUnlocked({ album, ids, onFollow }: { album: Album; ids: string[]; onFollow: () => void }) {
  const title = useId();
  const emojis = ids.flatMap((id) => album.emojis.filter((emoji) => emoji.id === id));
  if (emojis.length === 0) return null;
  return (
    <section className="al-emoji-shelf" aria-labelledby={title}>
      <h3 id={title} className="al-emoji-shelf-title">
        Just unlocked
      </h3>
      <EmojiRows album={album} emojis={emojis} onFollow={onFollow} />
    </section>
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
        {emoji.earned ? <EarnedEmojiName emoji={emoji} /> : <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>}
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
          {emoji.earned ? <EarnedEmoji emoji={emoji} status={<SlackStatus emoji={emoji} emojiPage={album.emojiPage} />} /> : <LockedEmoji emoji={emoji} onFollow={onFollow} />}
        </li>
      ))}
    </ul>
  );
}

function EarnedEmoji({ emoji, status }: { emoji: AlbumEmoji; status: ReactNode }) {
  return (
    <>
      <EmojiPicture emoji={emoji} size={36} />
      <span className="al-emoji-words">
        <EarnedEmojiName emoji={emoji} />
        <span className="al-emoji-why ph-no-capture">{whyWords(emoji)}</span>
      </span>
      {status}
    </>
  );
}

function EarnedEmojiName({ emoji }: { emoji: AlbumEmoji }) {
  const isNew = useNewInThePanel(emoji.id);
  return (
    <span>
      <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
      {isNew && <NewLabel />}
    </span>
  );
}

export function SlackStatus({ emoji, emojiPage }: { emoji: Pick<AlbumEmoji, "id" | "kind" | "name" | "picture" | "from" | "inSlack">; emojiPage: string | null }) {
  if (!emoji.inSlack) return <NotInSlack emoji={emoji} emojiPage={emojiPage} />;
  return <InSlack />;
}

function InSlack() {
  return (
    <span className="al-emoji-in-slack" title={useItInSlackWords}>
      In Slack
    </span>
  );
}

function LockedEmoji({ emoji, words = howToUnlockWords(emoji), onFollow }: { emoji: AlbumEmoji; words?: string; onFollow: () => void }) {
  const team = teamOf(emoji);
  const body = (
    <>
      <EmojiPicture emoji={emoji} size={36} locked />
      <span className="al-emoji-words">
        <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
        <span className="al-emoji-why">{words}</span>
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
