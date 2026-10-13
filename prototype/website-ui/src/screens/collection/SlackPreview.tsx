// PROTOTYPE Slack-like mock of the public quip reply that a loadout produces under a kudos message.
import { me, members } from "../../data/mock";
import type { Cosmetic } from "../../data/types";
import { rarityBorder } from "../../ui";

export type ShownLoadout = { title: Cosmetic; card: Cosmetic; quip?: Cosmetic; emoji: string };

const recipients = [members[0], members[1]];

function Mention({ name }: { name: string }) {
  return <span className="rounded bg-blue/12 px-0.5 font-semibold text-blue dark:text-blue-light">@{name}</span>;
}

function SlackAvatar({ children, hue }: { children: string; hue?: number }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-black text-[#151515]"
      style={{ background: hue === undefined ? "var(--yellow)" : `hsl(${hue} 70% 78%)` }}
    >
      {children}
    </span>
  );
}

function Recipients() {
  return (
    <>
      {recipients.map((r, i) => (
        <span key={r.id}>
          {i > 0 && " "}
          <Mention name={r.name} />
        </span>
      ))}
    </>
  );
}

export function SlackPreview({ shown, animate }: { shown: ShownLoadout; animate: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface text-[15px] leading-snug shadow-ph">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-sm">
        <span className="font-bold"># team-bramble</span>
        <span className="text-faint">· Thread</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex gap-3">
          <SlackAvatar hue={me.hue}>{me.initials}</SlackAvatar>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold">{me.name}</span>
              <span className="text-xs text-faint">10:42</span>
            </div>
            <p>
              {shown.emoji} <Recipients /> thanks for pairing on the flaky test all afternoon!
            </p>
          </div>
        </div>
        {shown.quip ? (
          <>
            <div className="flex items-center gap-2 text-xs text-faint">
              <span className="h-px flex-1 bg-line" />1 reply<span className="h-px flex-1 bg-line" />
            </div>
            <QuipReply shown={shown} quip={shown.quip} animate={animate} />
          </>
        ) : (
          <NoQuip />
        )}
      </div>
    </div>
  );
}

function QuipReply({ shown, quip, animate }: { shown: ShownLoadout; quip: Cosmetic; animate: boolean }) {
  return (
    <div className="flex gap-3">
      <SlackAvatar>🦔</SlackAvatar>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-bold">HedgeHug</span>
          <span className="rounded bg-surface-2 px-1 text-[10px] font-bold uppercase text-muted ring-1 ring-line">App</span>
          <span className="text-xs text-faint">10:42</span>
        </div>
        <CardImage card={shown.card} animate={animate} />
        <p>
          {shown.emoji}{" "}
          <b>
            {me.name} · {shown.title.name}
          </b>{" "}
          → <Recipients />
        </p>
        <p className="italic">“{quip.name}”</p>
      </div>
    </div>
  );
}

function CardImage({ card, animate }: { card: Cosmetic; animate: boolean }) {
  return (
    <div className={`flex h-28 w-full max-w-[260px] items-center gap-3 rounded-md border-2 bg-marker/60 px-4 dotgrid ${rarityBorder[card.rarity]}`}>
      <span className={`text-5xl ${animate ? "animate-wiggle" : ""}`}>{card.preview}</span>
      <span className="font-display text-base font-extrabold">{card.name}</span>
    </div>
  );
}

function NoQuip() {
  return <p className="rounded-md border border-dashed border-line-strong px-3 py-3 text-sm text-muted">No quips picked, so the app posts no reply under your kudos. Your kudos still lands the same.</p>;
}
