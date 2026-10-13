// PROTOTYPE: a fake "Sign in with Slack". It keeps the deep link (next) so a member lands where they clicked.
import { Button, Card, CardContent } from "@posthog/quill";
import { HedgehogHandClasp } from "@posthog/brand/hoggies";
import { ThemeButton } from "./Layout";
import { useNav } from "./nav";

export function SignIn({ dark, toggle, next }: { dark: boolean; toggle: () => void; next?: string }) {
  const { setSignedIn } = useNav();
  const signIn = () => {
    setSignedIn(true);
    location.hash = `/${next && next !== "signin" ? next : "profile"}`;
  };
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeButton dark={dark} toggle={toggle} />
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-24">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <HedgehogHandClasp size={112} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">HedgeHug</h1>
              <p className="text-sm text-muted-foreground">Thanks a Hog</p>
            </div>
            <p className="text-sm text-muted-foreground">See your level, perks, stickers and achievements. Only members of your Slack workspace can sign in.</p>
            <Button variant="primary" size="lg" className="w-full" onClick={signIn}>
              <SlackGlyph /> Sign in with Slack
            </Button>
            {next && next !== "profile" && (
              <p className="text-xs text-muted-foreground">
                You'll land on <code className="font-mono">/{next}</code> afterwards.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Prototype: no real sign-in happens.</p>
      </main>
    </div>
  );
}

function SlackGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <rect x="10" y="2" width="4" height="9" rx="2" fill="#36C5F0" />
      <rect x="13" y="10" width="9" height="4" rx="2" fill="#2EB67D" />
      <rect x="10" y="13" width="4" height="9" rx="2" fill="#ECB22E" />
      <rect x="2" y="10" width="9" height="4" rx="2" fill="#E01E5A" />
    </svg>
  );
}
