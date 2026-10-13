import { Button } from "@posthog/quill";
import { MaxSays } from "../Max";

export function SignedOutPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <MaxSays
      title="Sign in"
      tab="Sign in"
      action={
        <Button variant="primary" size="lg" onClick={onSignIn}>
          <SlackGlyph /> Sign in with Slack
        </Button>
      }
    >
      See your kudos. Only members of your Slack workspace can sign in.
    </MaxSays>
  );
}

function SlackGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="10" y="2" width="4" height="9" rx="2" fill="#36C5F0" />
      <rect x="13" y="10" width="9" height="4" rx="2" fill="#2EB67D" />
      <rect x="10" y="13" width="4" height="9" rx="2" fill="#ECB22E" />
      <rect x="2" y="10" width="9" height="4" rx="2" fill="#E01E5A" />
    </svg>
  );
}
