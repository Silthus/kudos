// PROTOTYPE, throwaway (Silthus/personal#133). Built only with VITE_PROTOTYPE=1; never merge.
import { useEffect, useState, type ReactNode } from "react";
import { NamedEmoji } from "../Emoji";
import { HoggieArt } from "./HoggieArt";
import "./onboardingPrototype.css";

export const onboardingPrototypeOn = import.meta.env.VITE_PROTOTYPE === "1";

const changed = "onboarding-prototype";

const startedWith = new URLSearchParams(window.location.search);
const params = new Map<string, string>();

function useParam(name: string, fallback: string): [string, (value: string) => void] {
  const read = () => params.get(name) ?? startedWith.get(name) ?? fallback;
  const [value, setValue] = useState(read);
  useEffect(() => {
    const follow = () => setValue(read());
    window.addEventListener(changed, follow);
    return () => window.removeEventListener(changed, follow);
  });
  const set = (next: string) => {
    params.set(name, next);
    window.dispatchEvent(new Event(changed));
  };
  return [value, set];
}

const variants = { A: "Three steps", B: "Slack demo", C: "Road to level 2" } as const;
type Variant = keyof typeof variants;
const scenes = { first: "First visit", thanked: "After the first thanks" } as const;
type Scene = keyof typeof scenes;

export function useScene(): Scene {
  return useParam("scene", "first")[0] as Scene;
}

export function OnboardingPrototype() {
  const [scene] = useParam("scene", "first");
  const [variant] = useParam("variant", "A");
  const [run, setRun] = useState(0);
  return (
    <>
      {scene === "first" ? <FirstVisit key={`${variant}-${run}`} variant={variant as Variant} /> : <LevelTwo key={run} />}
      <Switcher onReplay={() => setRun((count) => count + 1)} />
    </>
  );
}

type Step = "item" | "turned" | "card" | "done";

function FirstVisit({ variant }: { variant: Variant }) {
  const [step, setStep] = useState<Step>("item");
  useEffect(() => {
    if (step !== "turned") return;
    const next = window.setTimeout(() => setStep("card"), 2600);
    return () => window.clearTimeout(next);
  }, [step]);
  if (step === "done") return null;
  return (
    <div className="op-canvas" onClick={step === "turned" ? () => setStep("card") : undefined}>
      {step === "item" && <WelcomeItem onTurn={() => setStep("turned")} />}
      {step === "turned" && <TurnedWelcome />}
      {step === "card" && <HowItWorks variant={variant} onDone={() => setStep("done")} />}
    </div>
  );
}

function WelcomeItem({ onTurn }: { onTurn: () => void }) {
  return (
    <div className="op-stage">
      <p className="op-eyebrow">Welcome to HedgeHug</p>
      <h2 className="op-title">Your first hoggie is waiting</h2>
      <button type="button" className="op-item" onClick={onTurn} aria-label="Turn your welcome item">
        <span className="op-back">
          <span className="op-q">?</span>
        </span>
      </button>
      <p className="op-quiet">Click it to turn it over</p>
    </div>
  );
}

function TurnedWelcome() {
  return (
    <div className="op-stage">
      <div className="op-burst" />
      <div className="op-face">
        <HoggieArt hoggie="coffee-run" hidden={false} />
      </div>
      <h2 className="op-title">Coffee Run</h2>
      <p className="op-rarity">Rare hoggie · New in your album</p>
    </div>
  );
}

function HowItWorks({ variant, onDone }: { variant: Variant; onDone: () => void }) {
  return (
    <section className="op-card" data-variant={variant} aria-label="How HedgeHug works" onClick={(event) => event.stopPropagation()}>
      <p className="op-eyebrow">How HedgeHug works</p>
      {variant === "A" && <ThreeSteps />}
      {variant === "B" && <SlackDemo />}
      {variant === "C" && <RoadToLevelTwo />}
      <div className="op-actions">
        <a className="op-primary" href="https://slack.com/app_redirect?app=hedgehug" target="_blank" rel="noreferrer" onClick={onDone}>
          Try it in Slack
        </a>
        <button type="button" className="op-link" onClick={onDone}>
          Got it
        </button>
      </div>
    </section>
  );
}

function Hedgehog() {
  return <NamedEmoji name="hedgehog" />;
}

function Chip({ children, tone = "xp" }: { children: ReactNode; tone?: "xp" | "item" | "level" }) {
  return (
    <span className="op-chip" data-tone={tone}>
      {children}
    </span>
  );
}

function ThreeSteps() {
  return (
    <>
      <h2 className="op-card-title">Thank people in Slack. Collect them here.</h2>
      <ol className="op-steps">
        <li>
          <span className="op-step-mark">1</span>
          <span className="op-step-words">
            <strong>
              React with <Hedgehog /> on a message
            </strong>
            <span>That's a hug, a quick thank-you.</span>
          </span>
          <Chip>+1 XP for you both</Chip>
        </li>
        <li>
          <span className="op-step-mark">2</span>
          <span className="op-step-words">
            <strong>
              Post <Hedgehog /> @name and say why
            </strong>
            <span>That's a kudos. Saying why earns an item.</span>
          </span>
          <Chip>+10 XP</Chip>
          <Chip tone="item">+1 item</Chip>
        </li>
        <li>
          <span className="op-step-mark">3</span>
          <span className="op-step-words">
            <strong>Turn your items here</strong>
            <span>Faces and hoggies fill your album. Your first kudos takes you to level 2.</span>
          </span>
          <Chip tone="level">Level 2</Chip>
        </li>
      </ol>
    </>
  );
}

function SlackDemo() {
  return (
    <>
      <h2 className="op-card-title">Two ways to thank someone</h2>
      <div className="op-slack">
        <div className="op-msg op-beat" style={{ animationDelay: "0.2s" }}>
          <span className="op-avatar">AL</span>
          <span className="op-msg-body">
            <strong>Alex Lee</strong>
            <span>Shipped the fix for the flaky deploy, should be green now.</span>
            <span className="op-reactions">
              <span className="op-reaction op-pop" style={{ animationDelay: "0.9s" }}>
                <Hedgehog /> 1
              </span>
            </span>
          </span>
          <span className="op-beat op-side" style={{ animationDelay: "1.2s" }}>
            <Chip>Hug · +1 XP each</Chip>
          </span>
        </div>
        <div className="op-msg op-beat" style={{ animationDelay: "1.9s" }}>
          <span className="op-avatar op-you">You</span>
          <span className="op-msg-body">
            <strong>You</strong>
            <span>
              <Hedgehog /> <span className="op-mention">@Alex Lee</span> thanks for staying on the deploy fix, the release went out on time because of you.
            </span>
          </span>
          <span className="op-beat op-side" style={{ animationDelay: "2.6s" }}>
            <Chip>Kudos · +10 XP</Chip>
            <Chip tone="item">said why · +1 item</Chip>
          </span>
        </div>
      </div>
      <p className="op-card-note op-beat" style={{ animationDelay: "3.2s" }}>
        Your first kudos takes you to level 2. Items wait here for you to turn.
      </p>
    </>
  );
}

function RoadToLevelTwo() {
  return (
    <>
      <h2 className="op-card-title">Your first kudos takes you to level 2</h2>
      <div className="op-road">
        <div className="op-road-bar">
          <span className="op-road-fill" />
          <span className="op-road-level">Level 1</span>
          <span className="op-road-goal">Level 2</span>
        </div>
        <ul className="op-road-ways">
          <li>
            <Hedgehog /> react on a message <Chip>+1 XP</Chip>
          </li>
          <li>
            <Hedgehog /> @name and say why <Chip>+10 XP</Chip> <Chip tone="item">+1 item</Chip>
          </li>
          <li>
            first kudos ever <Chip tone="level">straight to level 2</Chip>
          </li>
        </ul>
      </div>
      <div className="op-unlocks">
        <span className="op-unlocks-title">Level 2 unlocks</span>
        <span className="op-unlock">🏆 Leaderboard</span>
        <span className="op-unlock">? ? ? 3 items</span>
        <span className="op-unlock">🙌 your next emoji</span>
      </div>
    </>
  );
}

function LevelTwo() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div className="op-canvas op-gold" onClick={() => setDone(true)}>
      <div className="op-stage">
        <div className="op-disc">2</div>
        <h2 className="op-title">You reached level 2!</h2>
        <p className="op-quiet">Your first kudos to Alex Lee did it.</p>
        <ul className="op-takeover-unlocks">
          <li className="op-pop" style={{ animationDelay: "0.4s" }}>
            <span className="op-backs">
              <span className="op-mini-back">?</span>
              <span className="op-mini-back">?</span>
              <span className="op-mini-back">?</span>
            </span>
            3 new items unlocked
          </li>
          <li className="op-pop" style={{ animationDelay: "0.8s" }}>
            <span className="op-big-emoji">🏆</span>
            Leaderboard unlocked
          </li>
          <li className="op-pop op-emoji-unlock" style={{ animationDelay: "1.2s" }}>
            <span className="op-big-emoji">🙌</span>
            <span>
              <strong>:raised_hands: unlocked</strong>
              <span className="op-quiet"> React or thank with it. It counts like <Hedgehog />.</span>
            </span>
          </li>
        </ul>
        <p className="op-quiet">Level 3 is 80 XP away · click to see your items</p>
      </div>
    </div>
  );
}

function Switcher({ onReplay }: { onReplay: () => void }) {
  const [scene, setScene] = useParam("scene", "first");
  const [variant, setVariant] = useParam("variant", "A");
  const keys = Object.keys(variants) as Variant[];
  const step = (by: number) => setVariant(keys[(keys.indexOf(variant as Variant) + by + keys.length) % keys.length]!);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="op-switcher" role="toolbar" aria-label="Prototype controls">
      {(Object.keys(scenes) as Scene[]).map((key) => (
        <button key={key} type="button" aria-pressed={scene === key} onClick={() => setScene(key)}>
          {scenes[key]}
        </button>
      ))}
      <span className="op-divider" />
      <button type="button" onClick={() => step(-1)} aria-label="Previous card">
        ‹
      </button>
      <span>
        Card {variant} · {variants[variant as Variant]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next card">
        ›
      </button>
      <span className="op-divider" />
      <button type="button" onClick={onReplay}>
        Replay
      </button>
    </div>
  );
}

type UsableEmoji = { name: string; glyph: string; how: string; inSlack: boolean };
type NextEmoji = { name: string; glyph: string; how: string; have: number; need: number };

const usableAtFirst: UsableEmoji[] = [{ name: "hedgehog", glyph: "🦔", how: "Your kudos emoji · works from the start", inSlack: true }];

const usableAfterThanks: UsableEmoji[] = [
  { name: "raised_hands", glyph: "🙌", how: "Reached level 2", inSlack: true },
  { name: "hype-alex-lee", glyph: "AL", how: "Your first thoughtful kudos for Alex Lee", inSlack: false },
  ...usableAtFirst,
];

const nextAtFirst: NextEmoji[] = [
  { name: "raised_hands", glyph: "🙌", how: "Reach level 2 · your first kudos does it", have: 0, need: 20 },
  { name: "hype-…", glyph: "?", how: "Thank someone and say why: unlock their hype emoji", have: 0, need: 1 },
  { name: "first-face", glyph: "🥉", how: "Get your first person into your album", have: 0, need: 1 },
];

const nextAfterThanks: NextEmoji[] = [
  { name: "first-face", glyph: "🥉", how: "Turn Alex Lee's item to put them in your album", have: 0, need: 1 },
  { name: "team-kettle-works", glyph: "🫖", how: "Collect all 3 people on Kettle Works", have: 1, need: 3 },
  { name: "level-5", glyph: "⭐", how: "Reach level 5", have: 25, need: 400 },
];

export function usableEmojiCount(scene: Scene) {
  return (scene === "first" ? usableAtFirst : usableAfterThanks).length;
}

export function EmojiPanelPrototype({ allEmojis }: { allEmojis: ReactNode }) {
  const scene = useScene();
  const [all, setAll] = useState(false);
  const usable = scene === "first" ? usableAtFirst : usableAfterThanks;
  const next = scene === "first" ? nextAtFirst : nextAfterThanks;
  if (all)
    return (
      <div>
        <button type="button" className="op-back-link" onClick={() => setAll(false)}>
          ← Your emojis
        </button>
        {allEmojis}
      </div>
    );
  return (
    <div className="op-emojis">
      <h2 className="op-emojis-title">Use these now</h2>
      <p className="op-emojis-hint">React with any of them or put them in a kudos. Each one counts like <Hedgehog />: XP for you both, and an item when you say why.</p>
      <ul className="op-emoji-list">
        {usable.map((emoji) => (
          <li key={emoji.name} className="op-emoji" data-usable="">
            <span className="op-emoji-glyph">{emoji.glyph}</span>
            <span className="op-emoji-words">
              <code>:{emoji.name}:</code>
              <span>{emoji.how}</span>
            </span>
            {emoji.inSlack ? <span className="op-in-slack">In Slack</span> : <button type="button" className="op-set-up">Set it up</button>}
          </li>
        ))}
      </ul>
      <h2 className="op-emojis-title">Unlock next</h2>
      <ul className="op-emoji-list">
        {next.map((emoji) => (
          <li key={emoji.name} className="op-emoji" data-locked="">
            <span className="op-emoji-glyph">{emoji.glyph}</span>
            <span className="op-emoji-words">
              <code>:{emoji.name}:</code>
              <span>{emoji.how}</span>
              <span className="op-emoji-bar">
                <span style={{ width: `${Math.max(4, (emoji.have / emoji.need) * 100)}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="op-all" onClick={() => setAll(true)}>
        All emojis · 27 →
      </button>
    </div>
  );
}

const gettingStartedSteps = [
  { goal: "Give a hug", done: { first: false, thanked: true } },
  { goal: "Give a thoughtful kudos", done: { first: false, thanked: true } },
  { goal: "Turn an item", done: { first: true, thanked: true } },
  { goal: "Reach level 2", done: { first: false, thanked: true } },
];

export function GettingStartedPrototype() {
  const scene = useScene();
  const done = gettingStartedSteps.filter((step) => step.done[scene]).length;
  const next = gettingStartedSteps.find((step) => !step.done[scene]);
  if (next === undefined) return null;
  return (
    <section className="al-started" aria-label="Getting started">
      <span className="al-started-title">
        Getting started · {done} of {gettingStartedSteps.length}
      </span>
      <ol className="al-started-steps">
        {gettingStartedSteps.map((step) => (
          <li key={step.goal} className="al-started-step" data-done={step.done[scene] ? "" : undefined} title={step.goal} />
        ))}
      </ol>
      <span className="al-started-next">
        Next: <strong>{next.goal}</strong> <span className="op-quiet">· react with <Hedgehog /> on any message in Slack</span>
      </span>
    </section>
  );
}
