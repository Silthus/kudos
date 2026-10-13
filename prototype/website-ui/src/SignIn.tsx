// PROTOTYPE: a fake "Sign in with Slack". It keeps the deep link (next) so a member lands where they clicked.
import { ThemeToggle } from "./chrome";
import { useNav } from "./nav";
import { Bubble, Button, Hand, Hog } from "./ui";

export function SignIn({ dark, toggle, next }: { dark: boolean; toggle: () => void; next?: string }) {
  const { setSignedIn } = useNav();
  const signIn = () => {
    setSignedIn(true);
    location.hash = `/${next && next !== "signin" ? next : "profile"}`;
  };
  return (
    <div className="dotgrid flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle dark={dark} toggle={toggle} />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <Bubble className="mb-4 animate-pop">Psst. Your kudos are waiting for you in here.</Bubble>
        <Hog size={140} mood="wave" className="animate-wiggle" />
        <h1 className="mt-4 font-display text-4xl font-black tracking-tight">
          Kudos<span className="text-orange">.</span>
        </h1>
        <p className="mt-2 text-muted">
          See your <span className="marker">level, perks, stickers and achievements</span>. Only people in your Slack workspace can sign in.
        </p>
        <div className="mt-6">
          <Button tone="plain" onClick={signIn}>
            <SlackGlyph /> Sign in with Slack
          </Button>
        </div>
        {next && next !== "profile" && (
          <p className="mt-4 text-xs text-faint">
            After signing in you'll land on <code className="font-mono">/{next}</code>.
          </p>
        )}
        <Hand className="mt-8 -rotate-2">prototype: no real sign-in happens ✌️</Hand>
      </main>
    </div>
  );
}

function SlackGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="10" y="2" width="4" height="9" rx="2" fill="#36C5F0" />
      <rect x="13" y="10" width="9" height="4" rx="2" fill="#2EB67D" />
      <rect x="10" y="13" width="4" height="9" rx="2" fill="#ECB22E" />
      <rect x="2" y="10" width="9" height="4" rx="2" fill="#E01E5A" />
    </svg>
  );
}
