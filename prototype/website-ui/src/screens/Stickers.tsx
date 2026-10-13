// PROTOTYPE sticker book: private stickers of people thanked and thanking, plus one album per group.
import { useState } from "react";
import { albums, me, stickers } from "../data/mock";
import type { Album, Member, Sticker as StickerFact } from "../data/types";
import { Avatar, Hand, Hog, Panel, Pill, Progress, Squiggle, Stat } from "../ui";

type Tab = "thanked" | "thankedMe";

const tilts = [-4, 2.5, -1.5, 3.5, -2.5, 1.5, -3, 4, -1, 2];

const tiltAt = (i: number) => tilts[i % tilts.length];

const firstName = (member: Member) => member.name.split(" ")[0];

export function Stickers({ param }: { param?: string }) {
  const [tab, setTab] = useState<Tab>(param === "thanked-me" ? "thankedMe" : "thanked");
  const shown = stickers.filter((s) => (tab === "thanked" ? s.thanked : s.thankedMe));
  const completed = albums.filter((a) => a.complete).length;

  return (
    <div className="space-y-6">
      <Intro completed={completed} />
      <Panel
        title="Your stickers"
        actions={<Tabs tab={tab} setTab={setTab} />}
        bodyClass="p-4 sm:p-6"
      >
        <p className="mb-5 text-sm text-muted">
          {tab === "thanked"
            ? `People you've thanked: ${shown.length}. A person you've thanked and who thanked you shows up on both pages.`
            : `People who've thanked you: ${shown.length}. A person you've thanked and who thanked you shows up on both pages.`}
        </p>
        <StickerPage stickers={shown} />
      </Panel>
      <Albums />
    </div>
  );
}

function Intro({ completed }: { completed: number }) {
  const thanked = stickers.filter((s) => s.thanked).length;
  const thankedMe = stickers.filter((s) => s.thankedMe).length;
  return (
    <Panel bodyClass="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0 self-center pb-3">
          <Hog size={104} mood="happy" />
          <Hand className="absolute -bottom-2 left-1/2 -translate-x-1/2 -rotate-6 whitespace-nowrap text-base">peel &amp; keep!</Hand>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Your <span className="marker">sticker book</span>
          </h1>
          <p className="text-sm text-muted">
            You get one sticker of each person you thank, and one of each person who thanks you. Any kudos counts, short or long.
            Stickers are yours to keep, forever.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill tone="marker">🔒 Only you can see your sticker book</Pill>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Thanked" value={thanked} hint="people" />
        <Stat label="Thanked me" value={thankedMe} hint="people" />
        <Stat label="Albums done" value={`${completed}/${albums.length}`} hint="groups" />
      </div>
    </Panel>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const options: Array<[Tab, string]> = [
    ["thanked", "Thanked"],
    ["thankedMe", "Thanked me"],
  ];
  return (
    <div className="flex rounded-md border border-line bg-surface-2 p-0.5" role="tablist">
      {options.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
          className={`cursor-pointer rounded px-2.5 py-1 text-xs font-bold sm:text-sm ${tab === id ? "bg-surface text-ink shadow-ph ring-1 ring-line-strong" : "text-muted hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StickerPage({ stickers: page }: { stickers: StickerFact[] }) {
  return (
    <div className="dotgrid -mx-1 rounded-md border border-dashed border-line-strong bg-surface-2 px-3 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {page.map((s, i) => (
          <StickerCard key={s.member.id} sticker={s} tilt={tiltAt(i)} />
        ))}
      </div>
    </div>
  );
}

function StickerCard({ sticker, tilt, small }: { sticker: StickerFact; tilt: number; small?: boolean }) {
  const { member } = sticker;
  const both = sticker.thanked && sticker.thankedMe;
  return (
    <figure
      className="group relative mx-auto w-full max-w-[150px] transition-transform duration-150 hover:-translate-y-1"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div
        className="relative rounded-[22px] bg-surface p-2"
        style={{ boxShadow: "0 0 0 1px var(--border), 3px 5px 0 -1px rgba(0,0,0,.10), 6px 12px 18px -10px rgba(0,0,0,.45)" }}
      >
        <div
          className="flex flex-col items-center gap-1.5 rounded-[16px] px-2 pb-2.5 pt-3 text-center"
          style={{ background: `linear-gradient(160deg, hsl(${member.hue} 75% 88%), hsl(${member.hue} 65% 76%))` }}
        >
          <Avatar initials={member.initials} hue={member.hue} size={small ? 40 : 52} />
          <figcaption className="w-full truncate font-display text-sm font-extrabold leading-tight text-[#151515]">{member.name}</figcaption>
          <span className="text-[11px] font-semibold text-[#151515]/65">since {sticker.since}</span>
        </div>
        <span
          aria-hidden
          className="absolute bottom-0 right-0 size-6 rounded-tl-[10px] rounded-br-[22px]"
          style={{ background: "linear-gradient(315deg, var(--bg) 48%, var(--border-strong) 52%, var(--surface-2) 70%)" }}
        />
      </div>
      {both && !small && <span className="absolute -right-1 -top-2 rotate-12 rounded-full bg-yellow px-1.5 py-0.5 text-[10px] font-black text-[#151515] shadow-ph">both ways</span>}
    </figure>
  );
}

function Albums() {
  const mine = albums.filter((a) => a.mine).sort((a, b) => Number(b.group.id === me.primaryGroup.id) - Number(a.group.id === me.primaryGroup.id));
  const others = albums.filter((a) => !a.mine);
  return (
    <Panel title="Albums" bodyClass="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Every group has an album. Its pages are the group's current members, apart from you. Thank someone, or get thanked by them, and their sticker
          fills their page. A completed album stays complete.
        </p>
        <TeamSpiritNote />
      </div>
      <AlbumSection heading="Your groups" albums={mine} />
      <AlbumSection heading="Every other group" albums={others} />
    </Panel>
  );
}

function TeamSpiritNote() {
  return (
    <a
      href="#/achievements"
      className="flex shrink-0 items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-muted hover:border-line-strong hover:text-ink sm:max-w-xs"
    >
      <span className="text-base">🏅</span>
      <span>
        Completed albums count for the <b className="text-ink">Team Spirit</b> achievement. Bronze is your primary group's album, {me.primaryGroup.name}. →
      </span>
    </a>
  );
}

function AlbumSection({ heading, albums: list }: { heading: string; albums: Album[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-faint">{heading}</h3>
      <div className="space-y-4">
        {list.map((a, i) => (
          <AlbumCard key={a.group.id} album={a} offset={i * 3} />
        ))}
      </div>
    </section>
  );
}

function heldStickers(album: Album, offset: number): StickerFact[] {
  const missingIds = new Set(album.missing.map((m) => m.id));
  const pool = stickers.filter((s) => !missingIds.has(s.member.id));
  return Array.from({ length: album.held }, (_, i) => pool[(i + offset) % pool.length]);
}

function AlbumCard({ album, offset }: { album: Album; offset: number }) {
  const primary = album.group.id === me.primaryGroup.id;
  const held = heldStickers(album, offset);
  return (
    <article className={`rounded-lg border bg-surface p-4 ${album.complete ? "border-green/60 ring-1 ring-green/30" : "border-line"}`}>
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 className="font-display text-lg font-extrabold">{album.group.name}</h4>
        {primary && <Pill tone="orange">Primary group</Pill>}
        {album.complete && <Pill tone="green">✅ Complete</Pill>}
        <span className="ml-auto text-sm font-bold tabular-nums">
          {album.held}/{album.pages} <span className="font-normal text-muted">pages</span>
        </span>
      </header>
      <div className="mb-4">
        <Progress value={album.held} max={album.pages} tone={album.complete ? "green" : "orange"} height={10} />
      </div>
      {album.complete && <Celebration name={album.group.name} />}
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 lg:grid-cols-8">
        {held.map((s, i) => (
          <StickerCard key={`${s.member.id}-${i}`} sticker={s} tilt={tiltAt(i + offset)} small />
        ))}
        {album.missing.map((m) => (
          <EmptySlot key={m.id} member={m} />
        ))}
      </div>
    </article>
  );
}

function Celebration({ name }: { name: string }) {
  return (
    <div className="relative mb-4 flex items-center gap-3 rounded-md bg-green/12 px-3 py-2">
      <Hog size={48} mood="party" hat="party" />
      <div>
        <div className="font-display font-extrabold">You've swapped thanks with all of {name}.</div>
        <Squiggle width={150} />
      </div>
      <span className="ml-auto hidden text-2xl sm:block">🎉</span>
    </div>
  );
}

function EmptySlot({ member }: { member: Member }) {
  return (
    <div className="mx-auto flex w-full max-w-[150px] flex-col items-center gap-1.5 rounded-[22px] border-2 border-dashed border-line-strong bg-surface-2/60 px-2 py-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-line-strong font-display text-sm font-extrabold text-faint">
        {member.initials}
      </span>
      <span className="w-full truncate text-xs font-bold text-muted">{member.name}</span>
      <span className="text-[11px] leading-tight text-faint">Thank {firstName(member)} to fill this page</span>
    </div>
  );
}

