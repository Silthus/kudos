// Variant E standing card: this week's place on My group, Groups and Everyone, with the faces just above and below you, each row a door into its leaderboard.
import { IconArrowRight, IconChevronRight } from "@posthog/icons";
import { me } from "../../data/mock";
import { Panel } from "./hud";
import { GroupCrest, HiddenFace, MemberFace } from "./leaderboard-faces";
import type { Board } from "./leaderboard-route";
import { boardStanding, type BoardStanding, type Neighbour } from "./standing-data";

const allBoards: Board[] = ["group", "groups", "everyone"];
const boardsWhenHidden: Board[] = ["groups"];

export function Standing() {
  const visible = me.privacy.showOnLeaderboards;
  const shown = (visible ? allBoards : boardsWhenHidden).map(boardStanding).filter((s): s is BoardStanding => Boolean(s));
  return (
    <Panel label="Where you stand" action={<span className="text-[11px] text-muted-foreground">This week</span>}>
      <div className="flex flex-col gap-3">
        <ul className="-mx-2 flex flex-col">
          {shown.map((standing) => (
            <li key={standing.board}>
              <StandingRow standing={standing} />
            </li>
          ))}
        </ul>
        {!visible && <HiddenNote />}
        <div className="border-t pt-3">
          <a href="#/leaderboard" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
            Open the leaderboard <IconArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </Panel>
  );
}

function StandingRow({ standing }: { standing: BoardStanding }) {
  return (
    <a href={`#/leaderboard/${standing.board}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fill-hover">
      <Place standing={standing} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{standing.label}</span>
        <span className="truncate text-xs text-muted-foreground">{standing.scope}</span>
      </span>
      <Neighbours standing={standing} />
      <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function Place({ standing }: { standing: BoardStanding }) {
  const notes = [standing.tied && "tied", standing.change !== undefined && standing.change !== 0 && `${standing.change > 0 ? "▲" : "▼"} ${Math.abs(standing.change)}`].filter(Boolean);
  const changeWords = standing.change ? `, ${standing.change > 0 ? "up" : "down"} ${Math.abs(standing.change)} since last week` : "";
  return (
    <span className="flex w-14 shrink-0 flex-col" aria-label={`${standing.tied ? "Tied at " : ""}number ${standing.rank}${changeWords}`}>
      <span className="hud-display text-2xl font-bold leading-none tabular-nums">#{standing.rank}</span>
      <span className="mt-1 h-3 whitespace-nowrap text-[10px] leading-3 text-muted-foreground tabular-nums">{notes.join(" · ")}</span>
    </span>
  );
}

function Neighbours({ standing }: { standing: BoardStanding }) {
  return (
    <span className="flex shrink-0 items-end gap-1">
      <Face neighbour={standing.above} standing={standing} size={22} />
      <Face neighbour={standing.you} standing={standing} size={28} />
      <Face neighbour={standing.below} standing={standing} size={22} />
    </span>
  );
}

function Face({ neighbour, standing, size }: { neighbour?: Neighbour; standing: BoardStanding; size: number }) {
  if (!neighbour) return <span className="w-8" aria-hidden />;
  return (
    <span className="flex w-8 flex-col items-center gap-1" title={`${neighbour.name}: ${neighbour.value} ${standing.unit}`}>
      {standing.faces === "groups" ? <GroupCrest group={neighbour.name} mine={neighbour.mine} size={size} /> : <MemberFace name={neighbour.name} me={neighbour.mine} size={size} />}
      <span className={`text-[10px] leading-none tabular-nums ${neighbour.mine ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{neighbour.value}</span>
    </span>
  );
}

function HiddenNote() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
      <HiddenFace size={28} />
      <span className="flex flex-col">
        <span className="text-sm font-medium">You're hidden from leaderboards</span>
        <span className="text-xs text-muted-foreground">You're off My group and Everyone. Groups still shows your group.</span>
      </span>
    </div>
  );
}
