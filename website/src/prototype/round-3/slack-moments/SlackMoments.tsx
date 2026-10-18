// PROTOTYPE (#625, round 3): a light Slack mock showing HedgeHug's three Slack moments, live from the in-memory album. Never merge to main.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AppLink } from "../../../AppLink";
import type { VariantProps } from "../../PrototypeStage";
import { personOf, useAlbum, type Album } from "../album";
import { General, HedgeHugDm, KudosChannel, TeamWorkflows, threadOf, type Focus, type Pane, type ThreadId } from "./moments";
import { Avatar, Composer, FaceChip, slackHref } from "./parts";
import "./slackMoments.css";

type View = { pane: Pane; thread: ThreadId | null; focus: Focus; hash: string };

const panes: Pane[] = ["kudos", "team-workflows", "general", "dm-hedgehug"];

const threads: ThreadId[] = ["thread", "thread-noor", "thread-mei", "thread-live"];

function viewOf(hash: string, album: Album): View {
  const asked = hash.replace(/^#/, "");
  const fallback = album.lastSlack !== null ? "thread-live" : "thread";
  const chosen = asked === "" || (asked === "thread-live" && album.lastSlack === null) ? fallback : asked;
  const thread = threads.find((id) => id === chosen);
  if (thread !== undefined) return { pane: threadOf(album, thread).pane, thread, focus: thread === "thread" ? "omar" : null, hash: thread };
  const pane = panes.find((id) => id === chosen) ?? "team-workflows";
  return { pane, thread: null, focus: pane === "kudos" ? "weekly" : pane === "dm-hedgehug" ? "recap" : null, hash: pane };
}

const moments = [
  { hash: "thread", number: 1, label: "Thread reply after a thoughtful kudos" },
  { hash: "dm-hedgehug", number: 2, label: "Monday hug recap" },
  { hash: "kudos", number: 3, label: "Weekly top thoughtful kudos" },
];

export function SlackMoments(_: VariantProps) {
  const { album } = useAlbum();
  const view = viewOf(window.location.hash, album);
  return (
    <div className="sm">
      <Caption view={view} />
      <div className="sm-window">
        <TopBar />
        <div className="sm-body" data-thread={view.thread !== null}>
          <Rail />
          <Sidebar view={view} />
          <ChannelPane album={album} view={view} />
          {view.thread !== null && <ThreadPanel album={album} thread={view.thread} pane={view.pane} />}
        </div>
      </div>
    </div>
  );
}

function Caption({ view }: { view: View }) {
  return (
    <nav className="sm-caption" aria-label="Prototype moments">
      <strong>Prototype: HedgeHug's three Slack moments</strong>
      {moments.map(({ hash, number, label }) => (
        <AppLink key={hash} href={slackHref(hash)} className="sm-chip" aria-current={view.hash === hash}>
          <span className="sm-chip-number">{number}</span>
          <span className="sm-chip-label">{label}</span>
        </AppLink>
      ))}
      <span className="sm-caption-note">Website buttons ask which website variant to open.</span>
    </nav>
  );
}

function TopBar() {
  return (
    <header className="sm-topbar">
      <div className="sm-search" aria-hidden="true">
        <span>⌕</span>
        <span>Search Example Co</span>
      </div>
    </header>
  );
}

function Rail() {
  return (
    <div className="sm-rail" aria-hidden="true">
      <span className="sm-workspace-icon">EC</span>
      <span className="sm-rail-item" data-active="true">
        <span className="sm-rail-glyph">⌂</span>
        Home
      </span>
      <span className="sm-rail-item">
        <span className="sm-rail-glyph">✉</span>
        DMs
      </span>
      <span className="sm-rail-item">
        <span className="sm-rail-glyph">🔔</span>
        Activity
      </span>
    </div>
  );
}

function Sidebar({ view }: { view: View }) {
  return (
    <nav className="sm-sidebar" aria-label="Channels and direct messages">
      <div className="sm-sidebar-head">
        <span>Example Co</span>
        <span aria-hidden="true">✎</span>
      </div>
      <div className="sm-sidebar-section">
        <div className="sm-sidebar-title">▾ Channels</div>
        <SidebarEntry pane="kudos" view={view} bold>
          <span className="sm-hash">#</span>kudos
        </SidebarEntry>
        <SidebarEntry pane="team-workflows" view={view} bold>
          <span className="sm-hash">#</span>team-workflows
        </SidebarEntry>
        <SidebarEntry pane="general" view={view}>
          <span className="sm-hash">#</span>general
        </SidebarEntry>
      </div>
      <div className="sm-sidebar-section">
        <div className="sm-sidebar-title">▾ Direct messages</div>
        <SidebarEntry pane="dm-hedgehug" view={view} bold>
          <Avatar author={{ kind: "app" }} mini />
          HedgeHug
        </SidebarEntry>
      </div>
      <div className="sm-sidebar-section sm-sidebar-muted" aria-hidden="true">
        <div className="sm-sidebar-title">▾ Apps</div>
        <div className="sm-sidebar-entry">
          <Avatar author={{ kind: "app" }} mini />
          HedgeHug
        </div>
      </div>
    </nav>
  );
}

function SidebarEntry({ pane, view, bold = false, children }: { pane: Pane; view: View; bold?: boolean; children: ReactNode }) {
  const current = view.pane === pane;
  return (
    <AppLink href={slackHref(pane)} className="sm-sidebar-entry" data-bold={bold && !current} aria-current={current ? "page" : undefined}>
      {children}
    </AppLink>
  );
}

const paneTitles: Record<Pane, { title: string; topic: string }> = {
  kudos: { title: "# kudos", topic: "Thank someone and say why. Top thoughtful kudos every Friday." },
  "team-workflows": { title: "# team-workflows", topic: "Workflows team chat. Launch week!" },
  general: { title: "# general", topic: "Company-wide announcements and pastries." },
  "dm-hedgehug": { title: "HedgeHug", topic: "" },
};

const memberKeys: Record<Exclude<Pane, "dm-hedgehug">, string[]> = {
  kudos: ["k:priya", "k:hana", "k:felix", "k:mei", "k:sofia", "k:leo"],
  "team-workflows": ["k:noor", "k:felix", "k:priya", "k:hana", "k:omar"],
  general: ["k:kai", "k:mei", "k:leo", "k:sofia", "k:omar"],
};

const memberCounts: Record<Exclude<Pane, "dm-hedgehug">, number> = { kudos: 48, "team-workflows": 6, general: 61 };

function ChannelPane({ album, view }: { album: Album; view: View }) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (list.current === null) return;
    list.current.scrollTop = list.current.scrollHeight;
    const focused = list.current.querySelector('[data-focus="true"]');
    if (focused !== null) list.current.scrollTop += focused.getBoundingClientRect().top - list.current.getBoundingClientRect().top - 44;
  }, [view.pane, view.focus, album.lastSlack]);
  const { title, topic } = paneTitles[view.pane];
  return (
    <section className="sm-pane" aria-label={title}>
      <header className="sm-pane-head">
        <span className="sm-pane-title">{title}</span>
        {view.pane === "dm-hedgehug" ? (
          <span className="sm-tabs" aria-hidden="true">
            <span className="sm-tab" data-active="true">
              Messages
            </span>
            <span className="sm-tab">About</span>
          </span>
        ) : (
          <>
            <span className="sm-pane-topic">{topic}</span>
            <Members album={album} pane={view.pane} />
          </>
        )}
      </header>
      <div ref={list} className="sm-scroll">
        <PaneMessages album={album} view={view} />
      </div>
      <Composer placeholder={view.pane === "dm-hedgehug" ? "Message HedgeHug" : `Message ${title.replace(" ", "")}`} />
    </section>
  );
}

function Members({ album, pane }: { album: Album; pane: Exclude<Pane, "dm-hedgehug"> }) {
  return (
    <span className="sm-pane-members" aria-label={`${memberCounts[pane]} members`}>
      <span className="sm-stack">
        {memberKeys[pane].slice(0, 3).map((key) => {
          const { name, face } = personOf(album, key)!;
          return <FaceChip key={key} name={name} face={face} />;
        })}
      </span>
      {memberCounts[pane]}
    </span>
  );
}

function PaneMessages({ album, view }: { album: Album; view: View }) {
  if (view.pane === "kudos") return <KudosChannel album={album} focus={view.focus} />;
  if (view.pane === "dm-hedgehug") return <HedgeHugDm album={album} focus={view.focus} />;
  if (view.pane === "general") return <General album={album} open={view.thread} />;
  return <TeamWorkflows album={album} open={view.thread} focus={view.focus} />;
}

function ThreadPanel({ album, thread, pane }: { album: Album; thread: ThreadId; pane: Pane }) {
  const { parent, reply } = threadOf(album, thread);
  return (
    <aside className="sm-thread" aria-label="Thread">
      <header className="sm-thread-head">
        <strong>Thread</strong>
        <span>{paneTitles[pane].title}</span>
        <AppLink href={slackHref(pane)} className="sm-close" aria-label="Close thread">
          ×
        </AppLink>
      </header>
      <div className="sm-scroll">
        {parent}
        <div className="sm-thread-count">1 reply</div>
        {reply}
      </div>
      <Composer placeholder="Reply…" />
    </aside>
  );
}
