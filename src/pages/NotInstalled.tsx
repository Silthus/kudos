import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui";
import { siteUrl } from "@/lib/viewer";
import { SlackMark } from "./Landing";
import { ParchmentPage } from "./signedOut";

/** Signed in with Slack, but Kudos isn't in that workspace yet: a parchment page with the way forward. */
export function NotInstalled({ name }: { name: string | null }) {
  const { signOut } = useAuthActions();
  return (
    <ParchmentPage narrow>
      <div className="text-center">
        <h1 className="font-display text-[28px] font-medium leading-9 text-ink">Almost there{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
        <p className="mt-3 text-ink/75">You're signed in, but Kudos isn't installed in your Slack workspace yet. Add it to Slack, then sign in again.</p>
        <div className="mt-7 flex flex-col gap-4">
          <a href={`${siteUrl()}/slack/install`} className="pixel-btn inline-flex h-12 items-center justify-center gap-2 px-6 text-base font-semibold">
            <SlackMark className="h-5 w-5" /> Add Kudos to Slack
          </a>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </ParchmentPage>
  );
}
