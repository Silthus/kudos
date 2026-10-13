import { Card, CardContent } from "@posthog/quill";
import { MemberFace } from "../Face";
import type { SignedInMember } from "../shell";

export function ProfileCardPanel({ member }: { member: SignedInMember }) {
  return (
    <section aria-labelledby="profile-card-title">
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <h2 id="profile-card-title" className="hud-label">
            Your profile card
          </h2>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <MemberFace member={member} className="size-10" />
            <span className="font-medium">{member.name ?? "You"}</span>
          </div>
          <p className="text-xs text-muted-foreground">Teammates see your face and name. The kudos you receive stay private.</p>
        </CardContent>
      </Card>
    </section>
  );
}
