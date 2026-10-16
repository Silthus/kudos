import { FirstKudosNudge, hasGivenNoKudos } from "../home/FirstKudosNudge";
import { Hero } from "../home/Hero";
import { MainColumnPanels, RightRailPanels, type HomeReads } from "../home/FeaturePanels";
import { GearPanel } from "../home/GearPanel";
import type { LoadoutActions } from "../home/gear";
import { JourneyPanel } from "../home/JourneyPanel";
import { ProfileCardPanel } from "../home/ProfileCardPanel";
import { MemberTabs } from "../home/MemberTabs";
import { RecentKudosCard } from "../home/RecentKudosCard";
import type { RecentKudosRead } from "../recentKudosRead";
import type { PendingItemPurchase } from "../home/itemPurchase";
import type { HomePanel } from "../route";
import type { MemberProfile, ShellActions } from "../shell";

export type { LoadoutActions };

type HomePageProps = { member: MemberProfile; panel?: HomePanel; reads: HomeReads; useRecentKudos: RecentKudosRead; onBuyItem: ShellActions["buyItem"]; pendingPurchase: PendingItemPurchase; loadout: LoadoutActions };

export function HomePage({ member, panel, reads, useRecentKudos, onBuyItem, pendingPurchase, loadout }: HomePageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <TabsWhileActivityAnswers useRecentKudos={useRecentKudos} />
        <Hero member={member} />
        {hasGivenNoKudos(member) && <FirstKudosNudge member={member} />}
        <JourneyPanel journey={member.journey} />
        <GearPanel member={member} opensOn={panel === "inventory" ? "inventory" : "character"} loadout={loadout} buyItem={onBuyItem} pendingPurchase={pendingPurchase} />
        <MainColumnPanels member={member} collection={reads.collection} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <ProfileCardPanel member={member} card={reads.card} />
        <RecentKudosCard useRecentKudos={useRecentKudos} />
        <RightRailPanels member={member} reads={reads} />
      </div>
    </div>
  );
}

function TabsWhileActivityAnswers({ useRecentKudos }: { useRecentKudos: RecentKudosRead }) {
  const answer = useRecentKudos("received");
  return answer?.kind === "recent" ? <MemberTabs current="character" /> : null;
}
