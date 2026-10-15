import { Card, CardContent } from "@posthog/quill";
import { useId, useState, type ReactNode } from "react";
import { BoardTabs, EveryoneCard, type BoardIds } from "../leaderboard/BoardCards";
import { BoardList } from "../leaderboard/BoardList";
import { boardsOn, firstBoardOn, peopleBoardOf, type BoardId, type PeopleBoard } from "../leaderboard/boards";
import { EmptyBoard } from "../leaderboard/EmptyBoard";
import { GroupsList, GroupsPodium } from "../leaderboard/GroupsBoard";
import { groupsStoryOf, nobodyGaveYetOn } from "../leaderboard/groupsStory";
import { PeriodSwitch } from "../leaderboard/PeriodSwitch";
import { periodNamed } from "../leaderboard/periods";
import { PeoplePodium } from "../leaderboard/Podium";
import { SidePanels } from "../leaderboard/SidePanels";
import { storyOf, type Story } from "../leaderboard/story";
import { viewerLineOf } from "../leaderboard/ViewerLine";
import type { GroupsBoardShown, Leaderboard, ShellActions } from "../shell";
import type { SpotlightDraw } from "../spotlightRead";
import { PageTitle } from "../PageTitle";
import type { Period } from "../shell";

type LeaderboardPageProps = { board: Leaderboard; coinsShown: boolean; period: Period; drawSpotlight: SpotlightDraw; onChoosePeriod: (period: Period) => void; onSetBoardVisibility: ShellActions["setBoardVisibility"] };

export function LeaderboardPage({ board, coinsShown, period, drawSpotlight, onChoosePeriod, onSetBoardVisibility }: LeaderboardPageProps) {
  const boards = boardsOn(board);
  const [chosen, setChosen] = useState<BoardId>();
  const shown = chosen !== undefined && boards.includes(chosen) ? chosen : firstBoardOn(board);
  const ids = useBoardIds();
  const tabbed = boards.length > 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="hud-label">Leaderboard · kudos given</span>
          <PeriodSwitch period={period} onChoose={onChoosePeriod} />
        </div>
        {tabbed ? <BoardTabs board={board} boards={boards} selected={shown} ids={ids} onSelect={setChosen} /> : <EveryoneCard board={board} />}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" {...(tabbed && { role: "tabpanel", id: ids.panel, "aria-labelledby": ids.label(shown), tabIndex: 0 })}>
          {shown === "groups" ? <GroupsBoardView groups={board.groups!} period={board.period} chatUrl={board.chatUrl} /> : <PeopleBoardView key={shown} board={peopleBoardOf(board, shown)} title={titleOf(board, shown)} />}
        </div>
        <SidePanels board={board} shown={shown} coinsShown={coinsShown} drawSpotlight={drawSpotlight} onSetBoardVisibility={onSetBoardVisibility} />
      </div>
    </div>
  );
}

function useBoardIds(): BoardIds {
  const id = useId();
  return { tab: (board) => `${id}-${board}-tab`, label: (board) => `${id}-${board}-label`, panel: `${id}-panel` };
}

function titleOf(board: Leaderboard, shown: Exclude<BoardId, "groups">) {
  return shown === "my-group" ? board.myGroup!.group.name : "Everyone";
}

function PeopleBoardView({ board, title }: { board: PeopleBoard; title: string }) {
  const story = storyOf(board);
  return (
    <>
      <BoardCardPanel title={`${title} · ${periodNamed(board.period).label}`}>
        {story === undefined ? (
          <EmptyBoard chatUrl={board.chatUrl} />
        ) : (
          <>
            <Headline story={story} />
            <PeoplePodium board={board} />
          </>
        )}
      </BoardCardPanel>
      {story !== undefined && <BoardList key={board.period} board={board} after={viewerLineOf(board)} />}
    </>
  );
}

function GroupsBoardView({ groups, period, chatUrl }: { groups: GroupsBoardShown; period: Period; chatUrl: string }) {
  const story = groupsStoryOf(groups, period);
  return (
    <>
      <BoardCardPanel title={`Groups · ${periodNamed(period).label}`}>
        {story === undefined ? (
          <EmptyBoard chatUrl={chatUrl} sentence={nobodyGaveYetOn(period)} />
        ) : (
          <>
            <Headline story={story} />
            <GroupsPodium groups={groups} />
          </>
        )}
      </BoardCardPanel>
      {story !== undefined && <GroupsList key={period} groups={groups} />}
    </>
  );
}

function BoardCardPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="board-title">
      <Card size="sm">
        <CardContent className="flex flex-col gap-6">
          <h2 id="board-title" className="hud-label">
            {title}
          </h2>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function Headline({ story }: { story: Story }) {
  return (
    <div className="flex flex-col gap-2">
      <PageTitle tab="Leaderboard" size="headline">
        {story.headline}
      </PageTitle>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{story.deck}</p>
    </div>
  );
}
