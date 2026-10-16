import { FirstKudosNudge, hasGivenNoKudos } from "../home/FirstKudosNudge";
import { Hero } from "../home/Hero";
import { MainColumnPanels, RightRailPanels, type HomeReads } from "../home/FeaturePanels";
import { InventoryPanel } from "../home/InventoryPanel";
import { JourneyPanel } from "../home/JourneyPanel";
import { ProfileCardPanel } from "../home/ProfileCardPanel";
import { MemberTabs } from "../home/MemberTabs";
import { RecentKudosCard } from "../home/RecentKudosCard";
import type { RecentKudosRead } from "../recentKudosRead";
import type { PendingItemPurchase } from "../home/itemPurchase";
import type { MemberProfile, ShellActions } from "../shell";

type HomePageProps = { member: MemberProfile; reads: HomeReads; useRecentKudos: RecentKudosRead; onBuyItem: ShellActions["buyItem"]; pendingPurchase: PendingItemPurchase };

export function HomePage({ member, reads, useRecentKudos, onBuyItem, pendingPurchase }: HomePageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <TabsWhileActivityAnswers useRecentKudos={useRecentKudos} />
        <Hero member={member} />
        {hasGivenNoKudos(member) && <FirstKudosNudge member={member} />}
        <JourneyPanel journey={member.journey} />
        <InventoryPanel member={member} buyItem={onBuyItem} pendingPurchase={pendingPurchase} />
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
