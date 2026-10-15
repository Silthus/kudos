import type { CSSProperties, ReactNode } from "react";
import { IconSparkles } from "@posthog/icons";
import { CoinGlyph, SkillPointGlyph } from "../skills/glyphs";
import { coinsText, skillPointsText } from "../skills/perkWords";
import { copyWordsOf, dropLineOf, rarityWordsOf, type Drop } from "./drops";
import { DropArtwork } from "./Hoggie";
import type { Reward, RewardKind } from "./rewards";
import { rewardTokenAttributes } from "./RewardFlight";

export type TokenKind = RewardKind | "drop";

type Token = { kind: TokenKind; words: string; glow: string; glyph: ReactNode; drop?: Drop };

const sparks = [0, 1, 2, 3, 4, 5];

export const flyingOrder: RewardKind[] = ["xp", "skillPoints", "coins"];

const countedTokens: Record<RewardKind, (reward: Reward) => Token> = {
  xp: ({ xp }) => ({ kind: "xp", words: `+${xp} XP`, glow: "var(--band-lemon)", glyph: <IconSparkles aria-hidden="true" className="size-[1em] shrink-0" /> }),
  skillPoints: ({ skillPoints }) => ({ kind: "skillPoints", words: `+${skillPointsText(skillPoints)}`, glow: "var(--band-blue)", glyph: <SkillPointGlyph className="size-[1em]" /> }),
  coins: ({ coins }) => ({ kind: "coins", words: `+${coinsText(coins)}`, glow: "var(--band-tangerine)", glyph: <CoinGlyph className="size-[1em]" /> }),
};

export function tokensOf(reward: Reward, drop: Drop | null): Token[] {
  const counted = flyingKindsOf(reward).map((kind) => countedTokens[kind](reward));
  return drop === null ? counted : [...counted, { kind: "drop", words: drop.name, glow: `var(--rarity-${drop.rarity})`, glyph: null, drop }];
}

export function flyingKindsOf(reward: Reward): RewardKind[] {
  return flyingOrder.filter((kind) => reward[kind] > 0);
}

export type Stage = "charging" | "popped" | "ended";

type TokenStageProps = { tokens: Token[]; stage: Stage; flown: TokenKind[] };

export function TokenStage({ tokens, stage, flown }: TokenStageProps) {
  if (tokens.length === 0) return null;
  const onStage = stage !== "charging";
  return (
    <ul aria-hidden="true" className="reward-tokens" data-stage={stage}>
      {tokens.map((token, at) => (
        <li key={token.kind} className="reward-token-slot" style={{ "--pop-delay": `${at * 140}ms` } as CSSProperties}>
          {token.drop === undefined ? <PoppedToken token={token} onStage={stage === "popped"} flown={flown.includes(token.kind)} /> : <DropCard drop={token.drop} onStage={onStage} />}
        </li>
      ))}
    </ul>
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
        <li key={token.kind} className="moment-line inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold tabular-nums text-card-foreground shadow-sm" style={{ "--line-delay": `${0.1 + at * 0.12}s` } as CSSProperties} data-reward={token.kind === "coins" ? "coins" : undefined}>
          {token.drop === undefined ? (
            <>
              <span className="text-base leading-none">{token.glyph}</span>
              {token.words}
            </>
          ) : (
            dropLineOf(token.drop)
          )}
        </li>
      ))}
    </ul>
  );
}
