import type { CSSProperties, ReactNode } from "react";
import { IconSparkles } from "@posthog/icons";
import { CoinGlyph, SkillPointGlyph } from "../skills/glyphs";
import { coinsText, skillPointsText } from "../skills/perkWords";
import { copyWordsOf, dropLineOf, rarityWordsOf, type CompletedCrest, type Drop } from "./drops";
import { DropArtwork } from "./Hoggie";
import type { Reward, RewardKind } from "./rewards";
import { rewardTokenAttributes } from "./RewardFlight";
import { TeamCrest } from "./TeamCrest";

export type TokenKind = RewardKind | "drop" | "crest";

type Token = { kind: TokenKind; words: string; glow: string; glyph: ReactNode; drop?: Drop; crest?: CompletedCrest };

export const crestBeatDelayMs = 900;

export const crestBeatPlaysForMs = 1400;

const popStepMs = 140;

const sparks = [0, 1, 2, 3, 4, 5];

export const flyingOrder: RewardKind[] = ["xp", "skillPoints", "coins"];

const countedTokens: Record<RewardKind, (reward: Reward) => Token> = {
  xp: ({ xp }) => ({ kind: "xp", words: `+${xp} XP`, glow: "var(--band-lemon)", glyph: <IconSparkles aria-hidden="true" className="size-[1em] shrink-0" /> }),
  skillPoints: ({ skillPoints }) => ({ kind: "skillPoints", words: `+${skillPointsText(skillPoints)}`, glow: "var(--band-blue)", glyph: <SkillPointGlyph className="size-[1em]" /> }),
  coins: ({ coins }) => ({ kind: "coins", words: `+${coinsText(coins)}`, glow: "var(--band-tangerine)", glyph: <CoinGlyph className="size-[1em]" /> }),
};

export function tokensOf(reward: Reward, drop: Drop | null): Token[] {
  const counted = flyingKindsOf(reward).map((kind) => countedTokens[kind](reward));
  if (drop === null) return counted;
  const found: Token = { kind: "drop", words: dropLineOf(drop), glow: `var(--rarity-${drop.rarity})`, glyph: null, drop };
  return drop.crest ? [...counted, found, crestTokenOf(drop.crest)] : [...counted, found];
}

function crestTokenOf(crest: CompletedCrest): Token {
  return { kind: "crest", words: `${crest.name} crest · Team complete`, glow: "var(--band-lemon)", glyph: <TeamCrest art={crest.art} size={18} />, crest };
}

export function hasCrest(tokens: Token[]) {
  return tokens.some(({ crest }) => crest !== undefined);
}

function popDelayOf(token: Token, at: number) {
  return at * popStepMs + (token.crest === undefined ? 0 : crestBeatDelayMs);
}

export function flyingKindsOf(reward: Reward): RewardKind[] {
  return flyingOrder.filter((kind) => reward[kind] > 0);
}

export type Stage = "charging" | "popped" | "ended";

type TokenStageProps = { tokens: Token[]; stage: Stage; flown: TokenKind[] };

export function TokenStage({ tokens, stage, flown }: TokenStageProps) {
  if (tokens.length === 0) return null;
  return (
    <ul aria-hidden="true" className="reward-tokens" data-stage={stage}>
      {tokens.map((token, at) => (
        <li key={token.kind} data-token={token.kind} className="reward-token-slot" style={{ "--pop-delay": `${popDelayOf(token, at)}ms` } as CSSProperties}>
          <TokenOnStage token={token} stage={stage} flown={flown.includes(token.kind)} />
        </li>
      ))}
    </ul>
  );
}

function TokenOnStage({ token, stage, flown }: { token: Token; stage: Stage; flown: boolean }) {
  const onStage = stage !== "charging";
  if (token.crest !== undefined) return <CrestCard crest={token.crest} onStage={onStage} />;
  if (token.drop !== undefined) return <DropCard drop={token.drop} onStage={onStage} />;
  return <PoppedToken token={token} onStage={stage === "popped"} flown={flown} />;
}

function CrestCard({ crest, onStage }: { crest: CompletedCrest; onStage: boolean }) {
  return (
    <span className="crest-card" style={{ "--token-glow": "var(--band-lemon)" } as CSSProperties} {...(onStage && rewardTokenAttributes("crest"))}>
      <Sparks />
      <span className="crest-card-label">Team complete!</span>
      <span className="crest-card-art">
        <TeamCrest art={crest.art} size={112} />
      </span>
      <span className="crest-card-name">{crest.name}</span>
      <span className="crest-card-sub">Crest earned</span>
    </span>
  );
}

function PoppedToken({ token, onStage, flown }: { token: Token; onStage: boolean; flown: boolean }) {
  return (
    <span className="reward-token" data-flown={flown || undefined} style={{ "--token-glow": token.glow } as CSSProperties} {...(onStage && rewardTokenAttributes(token.kind))}>
      <Sparks />
      {token.glyph}
      {token.words}
    </span>
  );
}

function DropCard({ drop, onStage }: { drop: Drop; onStage: boolean }) {
  return (
    <span className="drop-card" data-rarity={drop.rarity} style={{ "--token-glow": `var(--rarity-${drop.rarity})` } as CSSProperties} {...(onStage && rewardTokenAttributes("drop"))}>
      <Sparks />
      <span className="drop-card-art">
        <DropArtwork art={drop.art} size={88} />
      </span>
      <span className="drop-card-name">{drop.name}</span>
      <span className="drop-card-copy" data-new={drop.isNew || undefined}>
        {copyWordsOf(drop)}
      </span>
      <span className="drop-card-rarity">{rarityWordsOf(drop.rarity)}</span>
    </span>
  );
}

function Sparks() {
  return (
    <span className="reward-token-sparks">
      {sparks.map((spark) => (
        <span key={spark} className="reward-token-spark" style={{ "--spark": spark } as CSSProperties} />
      ))}
    </span>
  );
}

export function RewardChips({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 0) return null;
  return (
    <ul aria-label="Rewards" className="flex flex-wrap items-center justify-center gap-2">
      {tokens.map((token, at) => (
        <li key={token.kind} className="moment-line inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-bold tabular-nums text-card-foreground shadow-sm" style={{ "--line-delay": `${0.1 + at * 0.12}s` } as CSSProperties} data-reward={token.kind === "coins" ? "coins" : undefined}>
          {token.glyph !== null && <span className="text-base leading-none">{token.glyph}</span>}
          {token.words}
        </li>
      ))}
    </ul>
  );
}
