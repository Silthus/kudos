// PROTOTYPE (#625): Radical polish: today's header-and-pages website, reorganised around the level climb and one quest log. Never merge to main.
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import type { Route } from "../../route";
import type { VariantProps } from "../PrototypeStage";
import { useWorld, type World } from "../world";
import { pageGroupOf, RelocateContext, relocateWith, sectionHere } from "./address";
import { Book } from "./Book";
import { Header } from "./Header";
import { Home } from "./Home";
import { ActivityPage, LeaderboardPage, NotHere, QuestsPage, SettingsPage } from "./Pages";
import { QuestToasts, useFinishedQuests } from "./QuestToasts";
import { RevealDialog } from "./RevealDialog";
import { StageContext, usePackOpening } from "./stage";
import "./radicalPolish.css";

export function RadicalPolish({ route, member, todaysPage }: VariantProps) {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const relocate = useMemo(() => relocateWith(rerender), []);
  useRerenderOnHistory(rerender);
  useTopOfEachNewPage();
  const { world, actions } = useWorld();
  const { reveal, close, stage } = usePackOpening(world, actions);
  const { finished, dismiss } = useFinishedQuests(world.quests);
  const stillWaiting = finished.filter(({ id }) => world.quests.some((quest) => quest.id === id && quest.state === "finished"));
  return (
    <RelocateContext.Provider value={relocate}>
      <StageContext.Provider value={stage}>
        <div className="v3" inert={reveal !== null}>
          <Header world={world} section={sectionHere()} />
          <main className="v3-main">
            <PageFor route={route} world={world} chatUrl={member.chatUrl} todaysPage={todaysPage} />
          </main>
        </div>
        <div className="v3 v3-layer">
          <QuestToasts finished={stillWaiting} onDismiss={dismiss} />
          {reveal !== null && <RevealDialog key={reveal.drop.hoggie + reveal.before.xp} reveal={reveal} onClose={close} />}
        </div>
      </StageContext.Provider>
    </RelocateContext.Provider>
  );
}

function PageFor({ route, world, chatUrl, todaysPage }: { route: Route; world: World; chatUrl: string; todaysPage: VariantProps["todaysPage"] }) {
  if (route.page === "home") return <Home world={world} chatUrl={chatUrl} />;
  if (route.page === "book") return <Book world={world} />;
  if (route.page === "quests") return <QuestsPage world={world} />;
  if (route.page === "activity") return <ActivityPage world={world} />;
  if (route.page === "leaderboard") return <LeaderboardPage world={world} />;
  if (route.page === "settings") return <SettingsPage todaysPage={todaysPage} />;
  return <NotHere />;
}

function useRerenderOnHistory(rerender: () => void) {
  useEffect(() => {
    window.addEventListener("popstate", rerender);
    window.addEventListener("hashchange", rerender);
    return () => {
      window.removeEventListener("popstate", rerender);
      window.removeEventListener("hashchange", rerender);
    };
  }, [rerender]);
}

function useTopOfEachNewPage() {
  const group = pageGroupOf(window.location.pathname);
  const last = useRef(group);
  useLayoutEffect(() => {
    if (last.current === group) return;
    last.current = group;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [group]);
}
