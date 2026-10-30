import "@fontsource/lato/400.css";
import "@fontsource/lato/400-italic.css";
import "@fontsource/lato/700.css";
import "@fontsource/lato/900.css";
import type { ReactNode } from "react";
import type { Person } from "../../../convex/activity/entries";
import { NamedEmoji } from "../Emoji";
import { MemberFace } from "../Face";
import { HedgehogSitting } from "../hoggies";
import "./slackMessage.css";

const appName = "HedgeHug";

export function SlackMessage({ sender, at, children }: { sender: Person | null; at: string; children: ReactNode }) {
  return (
    <div className="xpm-slack">
      {sender === null ? <AppAvatar /> : <SenderAvatar sender={sender} />}
      <div className="xpm-slack-body">
        <p className="xpm-slack-head">
          <strong className="xpm-slack-name">{sender?.name ?? appName}</strong>
          {sender === null && <span className="xpm-slack-app">APP</span>}
          <span className="xpm-slack-time">{at}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

export function SlackText({ children }: { children: ReactNode }) {
  return <div className="xpm-slack-text">{children}</div>;
}

export function SlackReaction({ emoji, image, count }: { emoji: string; image?: string; count: number }) {
  return (
    <p className="xpm-slack-reactions">
      <span className="xpm-slack-reaction">
        <NamedEmoji name={emoji} image={image} />
        <span className="xpm-slack-reaction-count">{count}</span>
      </span>
    </p>
  );
}

function SenderAvatar({ sender: { face } }: { sender: Person }) {
  return (
    <span className="xpm-slack-avatar" data-tone={toneOf(face.initials)} aria-hidden="true">
      <MemberFace face={face} className="xpm-slack-picture" withoutPicture={face.initials} />
    </span>
  );
}

function AppAvatar() {
  return (
    <span className="xpm-slack-avatar xpm-slack-avatar-app" aria-hidden="true">
      <HedgehogSitting size={30} />
    </span>
  );
}

function toneOf(initials: string) {
  return [...initials].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
}
