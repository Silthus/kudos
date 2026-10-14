import { Hero } from "../home/Hero";
import { MainColumnPanels, RightRailPanels, type RailReads } from "../home/FeaturePanels";
import { JourneyPanel } from "../home/JourneyPanel";
import { ProfileCardPanel } from "../home/ProfileCardPanel";
import type { MemberProfile } from "../shell";

export function HomePage({ member, reads }: { member: MemberProfile; reads: RailReads }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Hero member={member} />
        <JourneyPanel journey={member.journey} />
        <MainColumnPanels member={member} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <ProfileCardPanel member={member} card={reads.card} />
        <RightRailPanels member={member} reads={reads} />
      </div>
    </div>
  );
}
