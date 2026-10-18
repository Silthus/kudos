// PROTOTYPE (#625, round 3): Slack-shaped building blocks for the Slack moments mock. Never merge to main.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppLink } from "../../../AppLink";
import { HedgehogHeart } from "../../../hoggies";
import type { Face } from "../../../shell";
import { MemberFace } from "../../art";
import { prototypeRounds } from "../../variants";

export type Author = { kind: "person"; name: string; face: Face } | { kind: "app" };

export type Reaction = { emoji: string; count: number; mine?: boolean };

export const kudosEmoji = "hedgehug";

const websiteVariants = prototypeRounds[2].variants.filter(({ key }) => key !== "slack");

export function slackHref(hash: string) {
  return `/?variant=slack#${hash}`;
}

export function KudosEmoji() {
  return (
    <span role="img" aria-label=":hedgehug:" title=":hedgehug:">
      <HedgehogHeart size={20} className="sm-emoji" />
    </span>
  );
}

export function Avatar({ author, mini = false }: { author: Author; mini?: boolean }) {
  const shape = mini ? "sm-mini-avatar" : "sm-avatar";
  if (author.kind === "app")
    return (
      <span className={`${shape} sm-app-avatar`}>
        <HedgehogHeart size={mini ? 18 : 30} />
      </span>
    );
  return (
    <span className={shape}>
      <MemberFace face={author.face} className="" />
    </span>
  );
}

export function FaceChip({ name, face }: { name: string; face: Face }) {
  return (
    <span className="sm-mini-avatar" title={name}>
      <MemberFace face={face} className="" />
    </span>
  );
}

export function Mention({ name, me = false }: { name: string; me?: boolean }) {
  return (
    <span className="sm-mention" data-me={me}>
      @{name}
    </span>
  );
}

export function Reactions({ reactions }: { reactions: Reaction[] }) {
  return (
    <div className="sm-reactions">
      {reactions.map(({ emoji, count, mine = false }) => (
        <span key={emoji} className="sm-reaction" data-mine={mine} aria-label={`${count} reacted with ${emoji === kudosEmoji ? ":hedgehug:" : emoji}`}>
          {emoji === kudosEmoji ? <HedgehogHeart size={16} className="sm-emoji" /> : <span aria-hidden="true">{emoji}</span>}
          <span aria-hidden="true">{count}</span>
        </span>
      ))}
    </div>
  );
}

export type Replies = { thread: string; count: number; last: string; open: boolean };

export function Message({ author, time, children, reactions, replies, focus = false }: { author: Author; time: string; children: ReactNode; reactions?: Reaction[]; replies?: Replies; focus?: boolean }) {
  return (
    <article className="sm-message" data-focus={focus}>
      <Avatar author={author} />
      <div>
        <div className="sm-meta">
          <span className="sm-name">{author.kind === "app" ? "HedgeHug" : author.name}</span>
          {author.kind === "app" && <span className="sm-app-tag">APP</span>}
          <span className="sm-time">{time}</span>
        </div>
        {children}
        {reactions !== undefined && <Reactions reactions={reactions} />}
        {replies !== undefined && <RepliesLink replies={replies} />}
      </div>
    </article>
  );
}

function RepliesLink({ replies }: { replies: Replies }) {
  return (
    <AppLink href={slackHref(replies.thread)} className="sm-replies" data-open={replies.open}>
      <Avatar author={{ kind: "app" }} mini />
      <span className="sm-replies-count">
        {replies.count} {replies.count === 1 ? "reply" : "replies"}
      </span>
      <span className="sm-replies-last">{replies.last}</span>
    </AppLink>
  );
}

export function DayDivider({ day }: { day: string }) {
  return (
    <div className="sm-day" role="separator" aria-label={day}>
      <span>{day}</span>
    </div>
  );
}

export function Section({ children, accessory }: { children: ReactNode; accessory?: ReactNode }) {
  return (
    <div className="sm-section">
      <div>{children}</div>
      {accessory}
    </div>
  );
}

export function Accessory({ children, face = false }: { children: ReactNode; face?: boolean }) {
  return (
    <span className="sm-accessory" data-face={face}>
      {children}
    </span>
  );
}

export function Context({ children }: { children: ReactNode }) {
  return <div className="sm-context">{children}</div>;
}

export function WebsiteButton({ label, path, hash = "", primary = false }: { label: string; path: string; hash?: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div ref={holder} className="sm-web">
      <button type="button" className="sm-btn" data-primary={primary} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div role="menu" className="sm-menu">
          <div className="sm-menu-title">Prototype: open the website in</div>
          {websiteVariants.map(({ key, name }) => (
            <AppLink key={key} role="menuitem" href={`${path}?variant=${key}${hash}`} onFollow={() => setOpen(false)}>
              Open in variant {key} · {name}
            </AppLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Composer({ placeholder }: { placeholder: string }) {
  return (
    <div className="sm-composer" aria-hidden="true">
      <div className="sm-composer-tools">
        <span>B</span>
        <span>I</span>
        <span>S</span>
        <span>🔗</span>
        <span>≡</span>
      </div>
      <div className="sm-composer-input">{placeholder}</div>
    </div>
  );
}
