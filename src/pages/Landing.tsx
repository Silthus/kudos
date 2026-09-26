import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Avatar, Button, RarityBadge } from "@/components/ui";
import { RARITY_META, RARITY_ORDER, type Rarity } from "@/lib/rarity";
import { signInRedirect } from "@/lib/routing";
import { siteUrl } from "@/lib/viewer";
import { LandingScene } from "@/world/LandingScene";
import { api } from "../../convex/_generated/api";
import { KudosSign } from "./signedOut";

export function SlackMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 122.8 122.8" className={className} aria-hidden>
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
        fill="#e01e5a"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
        fill="#36c5f0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
        fill="#2eb67d"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
        fill="#ecb22e"
      />
    </svg>
  );
}

const DROPS: { rarity: Rarity; text: string }[] = [
  { rarity: "common", text: "Delivered! Priya and Jonas just got 2 🌮 from you. 1 left for today." },
  { rarity: "uncommon", text: "You just made someone's afternoon. 2 🌮 for Priya and Jonas, 1 still up for grabs." },
  { rarity: "rare", text: "🎯 Direct hit! 2 🌮 landed squarely on Priya and Jonas. Ammo left today: 1." },
  { rarity: "epic", text: "⚡ Epic giving energy! You channeled 2 🌮 straight into Priya and Jonas. The team morale meter just ticked up." },
  { rarity: "legendary", text: "🔥 LEGENDARY DROP! M-M-M-Monster 🌮 from your hands flow. 2 points empower Priya and Jonas. Songs will be sung in #releases." },
];

/** A kudos in Slack and the bot's reply, rolling through the rarities. A mock of Slack: it keeps Slack's look and emoji. */
function SlackMock() {
  const still = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setI((n) => (n + 1) % DROPS.length), 2800);
    return () => clearInterval(t);
  }, [still]);
  const drop = DROPS[i];
  const meta = RARITY_META[drop.rarity];
  return (
    <div data-slack-mock data-user-text className="pixel-frame">
      <div className="flex items-center gap-2 bg-bark px-4 py-2.5 text-cream">
        <SlackMark />
        <span className="text-sm font-semibold"># releases</span>
      </div>
      <div className="space-y-5 bg-cream p-4 text-ink sm:p-5">
        <div className="flex gap-3">
          <Avatar name="Alex Rivera" size={38} />
          <div className="min-w-0">
            <div className="text-sm">
              <b className="font-semibold">Alex Rivera</b> <span className="text-xs text-ink/70">10:42</span>
            </div>
            <p className="mt-0.5 text-[15px] leading-relaxed text-ink">
              <span className="bg-[#1d9bd1]/20 px-1 text-pond-deep">@Priya</span> <span className="bg-[#1d9bd1]/20 px-1 text-pond-deep">@Jonas</span> 🌮🌮 the release went out
              without a single hiccup. Legends.
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full border border-[#1d9bd1]/50 bg-[#1d9bd1]/15 px-2 py-0.5 text-xs">🌮 4</span>
              <span className="rounded-full border border-ink/30 px-2 py-0.5 text-xs">🙌 3</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center bg-lantern text-lg">🌮</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <b className="font-semibold">Kudos</b> <span className="bg-parchment-deep px-1 py-px text-[10px] font-semibold text-ink/75">APP</span>{" "}
              <span className="text-xs text-ink/70">Only visible to you</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className={`mt-2 bg-parchment p-3 ring-2 ring-inset sm:p-4 ${meta.ring} ${meta.glow}`}
              >
                <p className="text-[15px] leading-relaxed">{drop.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RarityBadge rarity={drop.rarity} size="xs" />
                  {drop.rarity !== "common" && <span className="text-xs text-ink/75">✨ New discovery! ({12 + i}/72)</span>}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The three short signs under the world: what you do in Kudos. */
const SIGNS = [
  { title: "Give in Slack", body: "Mention a teammate and add the kudos emoji. Everyone has a few to give each day, so each one counts." },
  { title: "Grow a garden", body: "Thoughtful kudos earn XP and Hog coins. Plant for the people you thank and watch the garden grow." },
  { title: "Discover messages", body: "Every bot reply rolls a rarity, from Common to Legendary. Find all 72 and hang them in your gallery." },
];

const DROP_RATES = [55, 25, 12, 6, 2];
const MESSAGES_PER_RARITY = [25, 15, 10, 5, 5];

export function Landing() {
  const { signIn } = useAuthActions();
  const [params] = useSearchParams();
  const location = useLocation();
  const [busy, setBusy] = useState<"demo" | "slack" | null>(null);
  const [demoFailed, setDemoFailed] = useState(false);
  // Shown until the deployment says the demo is off (DEMO_MODE isn't "true").
  const demoEnabled = useQuery(api.session.setupStatus)?.demoEnabled !== false;
  const installed = params.get("installed");
  const installError = params.get("install_error");
  const site = siteUrl();

  const demo = async () => {
    setBusy("demo");
    setDemoFailed(false);
    try {
      // A refused sign-in resolves without signing in rather than throwing.
      const { signingIn } = await signIn("demo");
      if (!signingIn) setDemoFailed(true);
    } catch {
      setDemoFailed(true);
    } finally {
      setBusy(null);
    }
  };
  const slack = async () => {
    setBusy("slack");
    // Back to the page asked for, `?ws=` and all: the world follows a Slack link once you're in.
    await signIn("slack", { redirectTo: signInRedirect(location) });
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-dusk text-cream">
      <header className="mx-auto flex max-w-6xl justify-end px-5 pt-4">
        <Link to="/setup" className="px-2 py-1 text-sm text-cream/80 underline-offset-4 hover:text-cream hover:underline">
          Install guide
        </Link>
      </header>

      {(installed || installError) && (
        <div className="mx-auto mt-2 max-w-2xl px-5">
          <p role="status" className="pixel-note px-4 py-3 text-sm text-ink">
            {installed ? (
              <>
                Kudos is installed in <b>{installed}</b>. Sign in with Slack to open your garden, then invite <b>@Kudos</b> to a channel.
              </>
            ) : (
              <>
                Installation didn't complete ({installError}).{" "}
                {installError === "state_mismatch" ? "Start it again and finish it in this browser: " : "Try again, or read the install guide: "}
                <a href={`${site}/slack/install`} className="font-semibold text-ember-deep underline underline-offset-4">
                  Add Kudos to Slack again
                </a>
                .
              </>
            )}
          </p>
        </div>
      )}

      <main>
        <section className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-6 text-center">
          <KudosSign big />
          <p data-landing-sentence className="mt-6 max-w-xl text-lg leading-relaxed text-cream">
            Kudos turns the thank-yous you give in Slack into a garden that you and your team grow together.
          </p>
          <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" onClick={slack} disabled={busy !== null}>
              <SlackMark className="h-5 w-5" /> Sign in with Slack
            </Button>
            {demoEnabled && (
              <Button variant="outline" size="lg" onClick={demo} disabled={busy !== null}>
                {busy === "demo" ? "Opening the demo…" : "Explore the live demo"}
              </Button>
            )}
          </div>
          {demoFailed ? (
            <p role="alert" className="pixel-note mt-5 px-3 py-2 text-sm text-ember-deep">
              The demo couldn't be opened. Try again in a moment, or read the install guide.
            </p>
          ) : (
            demoEnabled && <p className="mt-5 text-sm text-cream/75">The demo needs no sign-up. It's a sample workspace with this year's history.</p>
          )}
        </section>

        <LandingScene className="mt-4 h-[380px] sm:h-[560px] lg:h-[680px]" />

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-5 pt-4 pb-16 sm:grid-cols-3 sm:gap-5">
          {SIGNS.map((s) => (
            <div key={s.title} data-landing-feature className="flex flex-col items-center">
              <div className="pixel-note w-full px-5 py-4">
                <h2 className="font-display text-xl font-medium leading-7 text-ink">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink/75">{s.body}</p>
              </div>
              <span aria-hidden className="block h-6 w-3 bg-bark shadow-[2px_0_0_0_var(--color-dusk-deep)]" />
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <h2 className="font-display text-3xl font-medium leading-9 text-cream">Every reply is a roll of the dice</h2>
              <p className="mt-3 max-w-lg leading-relaxed text-cream/80">
                The bot answers givers and receivers with one of 72 messages. Rarer messages are funnier, and the game quietly favours the ones you haven't seen yet.
              </p>
            </div>
            <SlackMock />
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {RARITY_ORDER.map((r, i) => (
              <div key={r} data-drop-rate className="pixel-note flex flex-col gap-2 p-3">
                <span aria-hidden className="block h-2" style={{ background: RARITY_META[r].color }} />
                <RarityBadge rarity={r} size="xs" />
                {/* Numbers read in Nunito: Pixelify's 5 looks like an S. */}
                <span className={`text-3xl font-bold tabular text-ink ${r === "legendary" ? "legendary-text self-start" : ""}`}>{DROP_RATES[i]}%</span>
                <span className="text-xs text-ink/75">{MESSAGES_PER_RARITY[i]} messages</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 border-t-2 border-soil px-5 py-8 text-sm text-cream/75">
        <span>Built on Convex and Slack's Events API.</span>
        <span className="flex flex-wrap gap-x-5 gap-y-2">
          <a href={`${site}/slack/install`} className="text-cream underline underline-offset-4 hover:text-lantern">
            Add Kudos to Slack
          </a>
          <Link to="/setup" className="text-cream underline underline-offset-4 hover:text-lantern">
            Self-host and install guide
          </Link>
        </span>
      </footer>
    </div>
  );
}
