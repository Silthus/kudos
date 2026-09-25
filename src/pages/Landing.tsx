import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Gem, Lock, Sparkles, Timer, Trophy, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Logo } from "@/components/ui";
import { Avatar, Button, Eyebrow, RarityBadge } from "@/components/ui";
import { RARITY_META, RARITY_ORDER, type Rarity } from "@/lib/rarity";
import { signInRedirect } from "@/lib/routing";
import { siteUrl } from "@/lib/viewer";
import { api } from "../../convex/_generated/api";

export function SlackMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 122.8 122.8" className={className} aria-hidden>
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
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

function SlackMock() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % DROPS.length), 2800);
    return () => clearInterval(t);
  }, []);
  const drop = DROPS[i];
  const meta = RARITY_META[drop.rarity];
  return (
    <div className="relative">
      <div className="relative overflow-hidden border border-bark/60 bg-parchment">
        <div className="flex items-center gap-2 border-b border-parchment-deep px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 tabular text-xs text-ink/70"># releases</span>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex gap-3">
            <Avatar name="Alex Rivera" size={38} />
            <div>
              <div className="text-sm">
                <b className="font-semibold">Alex Rivera</b> <span className="text-xs text-ink/70">10:42</span>
              </div>
              <p className="mt-0.5 text-[15px] leading-relaxed text-ink">
                <span className="bg-[#1d9bd1]/20 px-1 text-pond-deep">@Priya</span>{" "}
                <span className="bg-[#1d9bd1]/20 px-1 text-pond-deep">@Jonas</span> 🌮🌮 the release went out without a single hiccup. Legends.
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full border border-[#1d9bd1]/50 bg-[#1d9bd1]/15 px-2 py-0.5 text-xs">🌮 4</span>
                <span className="rounded-full border border-bark/60 px-2 py-0.5 text-xs">🙌 3</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center bg-lantern/20 text-lg">🌮</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <b className="font-semibold">Kudos</b> <span className="bg-parchment-deep px-1 py-px text-[10px] font-semibold text-ink/75">APP</span>{" "}
                <span className="text-xs text-ink/70">Only visible to you</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className={`mt-2 border bg-parchment-deep/40 p-4 ring-1 ring-inset ${meta.ring} ${meta.glow}`}
                  style={{ borderColor: "transparent" }}
                >
                  <p className="text-[15px] leading-relaxed">{drop.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <RarityBadge rarity={drop.rarity} size="xs" />
                    {drop.rarity !== "common" && <span className="text-xs text-ink/75">✨ New discovery! ({12 + i}/72)</span>}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Timer, title: "A daily allowance", body: "Everyone gets a handful of kudos per day. Scarcity makes each one mean something; unused ones vanish at midnight." },
  { icon: Gem, title: "Collectible bot replies", body: "Every reply rolls a rarity, from Common to Legendary. Discover all 72 messages and brag about your gallery." },
  { icon: Trophy, title: "Leaderboards with momentum", body: "Weekly and monthly rankings, change vs the last period, and who used their full allowance." },
  { icon: Lock, title: "Giving first, privacy built in", body: "Received counts are private by default. Admins decide whether they're hidden, personal, or public." },
  { icon: BarChart3, title: "Analytics that matter", body: "Participation, allowance use, when and where recognition happens, and how concentrated giving is." },
  { icon: Webhook, title: "Webhooks, not sockets", body: "Slack's Events API posts straight into Convex HTTP actions. No always-on server, no Socket Mode." },
];

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
    await signIn("slack", { redirectTo: signInRedirect(location) });
  };

  return (
    <div className="relative overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/setup" className="hidden px-3 py-2 text-sm text-cream/80 hover:text-cream sm:block">
            Install guide
          </Link>
          <Button variant="outline" size="sm" onClick={slack} disabled={busy !== null}>
            <SlackMark /> Sign in with Slack
          </Button>
        </div>
      </header>

      {(installed || installError) && (
        <div className="mx-auto mt-2 max-w-6xl px-5">
          <div className={`border px-4 py-3 text-sm ${installed ? "border-hedge/30 bg-hedge/10" : "border-ember/30 bg-ember/10"}`}>
            {installed ? (
              <>🎉 Kudos is installed in <b>{installed}</b>. Sign in with Slack to open your dashboard, then invite <code>@Kudos</code> to a channel.</>
            ) : (
              <>
                Installation didn't complete ({installError}).{" "}
                {installError === "state_mismatch"
                  ? "Start it again with Add to Slack, and finish it in this browser."
                  : "Try again, or check the install guide."}
              </>
            )}
          </div>
        </div>
      )}

      <section className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <Eyebrow className="mb-5 text-lantern">Peer recognition for Slack</Eyebrow>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] sm:text-7xl">
            Make appreciation
            <br />a daily <span className="relative whitespace-nowrap text-lantern">habit<motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.7 }} className="absolute -bottom-1 left-0 h-1.5 w-full origin-left bg-ember" /></span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
            Mention a teammate, add a 🌮, and they get kudos. Everyone has a small daily allowance, every bot reply is a
            collectible with its own rarity, and the dashboard turns it all into leaderboards and team insight.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={`${site}/slack/install`}>
              <Button variant="primary" size="lg">
                <SlackMark className="h-5 w-5" /> Add to Slack
              </Button>
            </a>
            {demoEnabled && (
              <Button variant="outline" size="lg" onClick={demo} disabled={busy !== null}>
                <Sparkles className="h-4 w-4 text-soil" />
                {busy === "demo" ? "Opening demo…" : "Explore the live demo"}
              </Button>
            )}
          </div>
          {demoFailed ? (
            <p role="alert" className="mt-4 text-sm text-ember">
              The demo couldn't be opened. Try again in a moment, or check the install guide.
            </p>
          ) : (
            demoEnabled && <p className="mt-4 text-sm text-cream/70">No sign-up for the demo. It's a sample workspace with this year's history.</p>
          )}
        </div>
        <SlackMock />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border border-parchment-deep bg-parchment p-6"
            >
              <f.icon className="h-5 w-5 text-soil" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative border border-parchment-deep bg-parchment p-5 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>Drop rates</Eyebrow>
              <h2 className="mt-2 font-display text-3xl font-semibold">Every reply is a roll of the dice</h2>
              <p className="mt-2 max-w-lg text-ink/75">
                The bot answers givers and receivers with one of 72 messages. Rarer messages are funnier, and the game quietly favours ones you haven't seen yet.
              </p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {RARITY_ORDER.map((r, i) => (
              <div key={r} className={`bg-parchment-deep/40 p-3 ring-1 ring-inset sm:p-4 ${RARITY_META[r].ring} ${RARITY_META[r].glow}`}>
                <RarityBadge rarity={r} size="xs" />
                <div className={`mt-4 font-display text-3xl font-semibold tabular ${r === "legendary" ? "legendary-text" : ""}`}>{[55, 25, 12, 6, 2][i]}%</div>
                <div className="text-xs text-ink/70">{[25, 15, 10, 5, 5][i]} messages</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t-2 border-soil px-5 py-8 text-sm text-cream/70">
        <span>Built on Convex · Slack Events API over HTTPS</span>
        <Link to="/setup" className="hover:text-cream">
          Self-host & install guide →
        </Link>
      </footer>
    </div>
  );
}
