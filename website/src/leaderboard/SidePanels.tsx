import { IconLock, IconTrending } from "@posthog/icons";
import type { ReactNode } from "react";
import { groupImprovementLine, improvementLine } from "../../../convex/leaderboard/improvementLine";
import type { GroupsBoardShown, Leaderboard, Period, ShellActions } from "../shell";
import type { SpotlightDraw } from "../spotlightRead";
import type { BoardId } from "./boards";
import { Crest } from "./Crest";
import { peerLine } from "./peerLine";
import { SidePanel as Panel } from "./SidePanel";
import { Spotlight } from "./Spotlight";
import { VisibilitySwitch } from "./VisibilitySwitch";

type SidePanelsProps = { board: Leaderboard; shown: BoardId; coinsShown: boolean; drawSpotlight: SpotlightDraw; onSetBoardVisibility: ShellActions["setBoardVisibility"] };

export function SidePanels({ board, shown, coinsShown, drawSpotlight, onSetBoardVisibility }: SidePanelsProps) {
  return (
    <div className="flex flex-col gap-5 lg:sticky lg:top-20">
      <Spotlight draw={drawSpotlight} />
      {shown === "everyone" && <EveryoneNotes board={board} />}
      {shown === "groups" && <GroupsNotes groups={board.groups!} period={board.period} />}
      <Panel id="how-it-counts-title" label="How it counts">
        <p className="text-muted-foreground">{shown === "groups" ? groupsCount : `Only kudos given count. Kudos received, XP, levels${coinsShown ? ", coins" : ""} and achievements never rank anyone.`}</p>
        <VisibilitySwitch onTheBoards={board.onTheBoards} setBoardVisibility={onSetBoardVisibility} />
      </Panel>
    </div>
  );
}

const groupsCount = "Groups score kudos given per person, so a small group can top the board. The share who gave sits beside it.";

function EveryoneNotes({ board: { improvement, peer, period } }: { board: Leaderboard }) {
  if (improvement === null || period === "all") return null;
  return (
    <OnlyYouSeeThese>
      <Note>{improvementLine(improvement, period)}</Note>
      {peer !== null && <Note>{peerLine(peer)}</Note>}
    </OnlyYouSeeThese>
  );
}

function GroupsNotes({ groups, period }: { groups: GroupsBoardShown; period: Period }) {
  const { mostImproved } = groups;
  const line = groupLineOf(groups, period);
  if (line === undefined && mostImproved === null) return null;
  return (
    <OnlyYouSeeThese>
      {mostImproved !== null && (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2.5 dark:bg-muted/40">
          <Crest group={mostImproved.group} mine={groups.rows.some((row) => row.mine && row.group === mostImproved.group)} size={36} />
          <span className="min-w-0">
            <span className="hud-label flex items-center gap-1">
              <IconTrending aria-hidden="true" className="size-3" /> Most improved
            </span>
            <span className="block truncate font-semibold">{mostImproved.name}</span>
          </span>
        </div>
      )}
      {line !== undefined && <Note>{line}</Note>}
    </OnlyYouSeeThese>
  );
}

function groupLineOf({ rows, improvement }: GroupsBoardShown, period: Period) {
  const mine = rows.find((row) => row.mine);
  if (improvement === null || mine === undefined || period === "all") return undefined;
  const line = groupImprovementLine(improvement, mine.name, period);
  return "gain" in improvement ? `${mine.name}: ${line}` : line;
}

function OnlyYouSeeThese({ children }: { children: ReactNode }) {
  return (
    <Panel
      id="only-you-title"
      label={
        <>
          <IconLock aria-hidden="true" className="size-3" /> Only you see these
        </>
      }
    >
      {children}
    </Panel>
  );
}

function Note({ children }: { children: string }) {
  return <p className="border-l-2 border-foreground/20 pl-3 tabular-nums">{children}</p>;
}
