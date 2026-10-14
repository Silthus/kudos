import { Counters } from "../home/Counters";
import { Hero } from "../home/Hero";
import { FeatureCards } from "../home/FeatureCards";
import { ProfileCardPanel } from "../home/ProfileCardPanel";
import type { MemberProfile } from "../shell";

export function HomePage({ member }: { member: MemberProfile }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Hero member={member} />
          <Counters member={member} />
        </div>
        <ProfileCardPanel member={member} />
      </div>
      <FeatureCards member={member} />
    </div>
  );
}
