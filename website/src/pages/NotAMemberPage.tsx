import { MaxSays } from "../Max";
import { SignOutButton } from "../SignOutButton";

export function NotAMemberPage({ onSignOut }: { onSignOut: () => void }) {
  return (
    <MaxSays title="Members only" tab="Members only" action={<SignOutButton onSignOut={onSignOut} />}>
      Only members of this Slack workspace can use HedgeHug.
    </MaxSays>
  );
}
