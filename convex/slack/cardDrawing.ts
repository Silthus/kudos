"use node";

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { roundHogBoldUrl, roundHogRegularUrl, roundHogSemiBoldUrl } from "@posthog/brand/fonts";
import { Resvg } from "@resvg/resvg-js";
import { v } from "convex/values";
import satori from "satori";
import "wawoff2/decompress.js";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { rarityWord, type Rarity } from "../hoggies/catalogue";
import { isJustStarting, justStarting, playerCardValidator, type PlayerCard } from "./playerCard";

export const cardSize = { width: 1200, height: 630 };

export type CardArt = { face: string | null; crest: string | null; rarest: string | null };

type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown } };

type Child = Node | string | false | null;

const artTimeoutMs = 2000;

const pictureTypes = new Set(["image/png", "image/jpeg", "image/gif"]);

const ink = { page: "#1e1f23", card: "#25262b", border: "#3e424f", text: "#f3f4f6", quiet: "#aeb3c4", accent: "#ff7a45", accentInk: "#ff9a6e", track: "#3a3c44", gold: "#f5b301" };

const rarityInk: Record<Rarity, string> = { common: "#aeb3c4", uncommon: "#4ade80", rare: "#60a5fa", epic: "#c084fc", legendary: "#fb923c" };

const stackInk = { people: ["#6c7bd9", "#d9786c", "#5fb592"], emojis: ["#f5b301", "#ff7a45", "#c084fc"], medals: ["#d39a68", "#bfc2c8", "#e2b53a"] };

const fontFaces = [
  { url: roundHogRegularUrl, weight: 400 },
  { url: roundHogSemiBoldUrl, weight: 600 },
  { url: roundHogBoldUrl, weight: 700 },
] as const;

export const drawn = observedAction({
  args: { card: playerCardValidator, key: v.string() },
  handler: async (ctx, { card, key }): Promise<string | null> => {
    const png = await cardPictureOf(card, await artOf(card));
    const picture = await ctx.storage.store(new Blob([Buffer.from(png)], { type: "image/png" }));
    return ctx.runMutation(internal.slack.cardPictures.kept, { key, picture });
  },
});

export async function cardPictureOf(card: PlayerCard, art: CardArt): Promise<Uint8Array> {
  const svg = await satori(cardTreeOf(card, art) as never, { ...cardSize, fonts: await fontsOf() });
  return new Resvg(svg, { fitTo: { mode: "width", value: cardSize.width } }).render().asPng();
}

export async function artOf(card: PlayerCard): Promise<CardArt> {
  const [face, crest, rarest] = await Promise.all([pictureOrNull(card.face), pictureOrNull(card.team?.crest ?? null), pictureOrNull(card.rarest?.picture ?? null)]);
  return { face, crest, rarest };
}

async function pictureOrNull(url: string | null): Promise<string | null> {
  if (url === null) return null;
  try {
    const answer = await fetch(url, { signal: AbortSignal.timeout(artTimeoutMs) });
    const type = answer.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!answer.ok || !pictureTypes.has(type)) return null;
    return `data:${type};base64,${Buffer.from(await answer.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

type Woff2Decompress = (woff2: Uint8Array) => Promise<Uint8Array>;

const decompress = createRequire(import.meta.url)("wawoff2/decompress.js") as Woff2Decompress;

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" };

let fonts: Promise<Font[]> | undefined;

function fontsOf() {
  fonts ??= decodedFonts().catch((error: unknown) => {
    fonts = undefined;
    throw error;
  });
  return fonts;
}

async function decodedFonts(): Promise<Font[]> {
  const decoded: Font[] = [];
  for (const { url, weight } of fontFaces) {
    const woff2 = await readFile(new URL(url));
    decoded.push({ name: "RoundHog", data: Buffer.from(await decompress(woff2)), weight, style: "normal" });
  }
  return decoded;
}

function h(type: string, style: Record<string, unknown>, ...children: Child[]): Node {
  const shown = children.filter((child): child is Node | string => child !== false && child !== null);
  return { type, props: { style: { display: "flex", boxSizing: "border-box", ...style }, children: shown.length === 1 ? shown[0] : shown } };
}

function picture(src: string, size: number, style: Record<string, unknown> = {}): Node {
  return { type: "img", props: { src, width: size, height: size, style: { width: size, height: size, ...style } } };
}

function cardTreeOf(card: PlayerCard, art: CardArt): Node {
  return h(
    "div",
    { width: cardSize.width, height: cardSize.height, padding: 40, gap: 32, background: ink.page, color: ink.text, fontFamily: "RoundHog" },
    playerSideOf(card, art),
    rarestSideOf(card, art),
  );
}

function playerSideOf(card: PlayerCard, art: CardArt): Node {
  return h(
    "div",
    { flexDirection: "column", width: 720, padding: 36, gap: 24, justifyContent: "space-between", borderRadius: 32, border: `2px solid ${ink.border}`, backgroundColor: ink.card, backgroundImage: "radial-gradient(circle at 0% 0%, rgba(255,122,69,0.16), rgba(255,122,69,0) 60%)" },
    h("div", { alignItems: "center", gap: 32 }, ringOf(card, art), whoOf(card, art)),
    rankStripOf(card),
    isJustStarting(card) ? quietLineOf() : statsOf(card),
  );
}

function ringOf({ name, level }: PlayerCard, art: CardArt): Node {
  const size = 176;
  const radius = 80;
  const around = 2 * Math.PI * radius;
  const share = level?.share ?? 0;
  const ring = {
    type: "svg",
    props: {
      width: size,
      height: size,
      viewBox: `0 0 ${size} ${size}`,
      style: { position: "absolute", top: 0, left: 0 },
      children: [
        { type: "circle", props: { cx: size / 2, cy: size / 2, r: radius, fill: "none", stroke: ink.track, strokeWidth: 12 } },
        share > 0 && { type: "circle", props: { cx: size / 2, cy: size / 2, r: radius, fill: "none", stroke: ink.accent, strokeWidth: 12, strokeLinecap: "round", strokeDasharray: `${around * share} ${around}`, transform: `rotate(-90 ${size / 2} ${size / 2})` } },
      ].filter(Boolean),
    },
  };
  const face = art.face === null ? h("div", { width: 132, height: 132, borderRadius: 66, alignItems: "center", justifyContent: "center", backgroundColor: "#33353d", color: ink.quiet, fontSize: 48, fontWeight: 700 }, initialsOf(name)) : picture(art.face, 132, { borderRadius: 66, objectFit: "cover" });
  return h(
    "div",
    { position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    ring as Node,
    face,
    level === null ? null : h("div", { position: "absolute", bottom: -4, alignItems: "baseline", gap: 4, padding: "4px 16px", borderRadius: 999, backgroundColor: ink.accent, color: "#141414", border: `4px solid ${ink.card}` }, h("span", { fontSize: 20, fontWeight: 700 }, "LV"), h("span", { fontSize: 32, fontWeight: 700 }, String(level.level))),
  );
}

function whoOf({ name, team, level }: PlayerCard, art: CardArt): Node {
  return h(
    "div",
    { flexDirection: "column", gap: 10, flexGrow: 1, minWidth: 0 },
    h("div", { fontSize: 54, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, name),
    team === null ? null : h("div", { alignItems: "center", gap: 12, fontSize: 30, fontWeight: 600 }, art.crest === null ? null : picture(art.crest, 40), team.name),
    level === null ? null : h("div", { alignItems: "baseline", gap: 10, fontSize: 28 }, h("span", { fontWeight: 700 }, `${level.xp.toLocaleString("en-GB")} XP`), h("span", { color: ink.quiet }, `· level ${level.level}`)),
  );
}

function rankStripOf({ place }: PlayerCard): Node {
  const ranked = place !== null;
  return h(
    "div",
    { alignItems: "center", gap: 16, padding: "16px 22px", borderRadius: 18, fontSize: 28, border: `2px solid ${ranked ? "rgba(245,179,1,0.5)" : "rgba(255,122,69,0.3)"}`, backgroundColor: ranked ? "rgba(245,179,1,0.12)" : "rgba(255,122,69,0.1)" },
    crownOf(ranked ? ink.gold : ink.accentInk),
    ranked ? h("span", { fontWeight: 700 }, `No. ${place.rank}${place.tied ? " tied" : ""} all time`) : h("span", { fontWeight: 700 }, "Not on the board yet"),
    ranked ? h("span", { color: ink.quiet }, `· ${place.thoughtful} thoughtful kudos`) : null,
  );
}

function crownOf(colour: string): Node {
  return {
    type: "svg",
    props: { width: 34, height: 34, viewBox: "0 0 24 24", children: { type: "path", props: { d: "M3 18h18l-1.5-10-5 4L12 5l-2.5 7-5-4z", fill: "none", stroke: colour, strokeWidth: 2, strokeLinejoin: "round" } } },
  };
}

function statsOf({ hoggies, people, emojis, medals }: PlayerCard): Node {
  const found = hoggies?.found ?? 0;
  const total = hoggies?.total ?? 0;
  const line = `1px solid ${ink.border}`;
  return h(
    "div",
    { flexDirection: "column" },
    h(
      "div",
      { borderBottom: line },
      statCellOf({ borderRight: line }, h("div", { flexDirection: "column", gap: 10, flexGrow: 1 }, figureOf(found, total, "hoggies found"), barOf(total === 0 ? 0 : found / total))),
      statCellOf({}, stackOf(stackInk.people, people), figureOf(people, null, people === 1 ? "person" : "people")),
    ),
    h("div", {}, statCellOf({ borderRight: line }, stackOf(stackInk.emojis, emojis), figureOf(emojis, null, emojis === 1 ? "emoji" : "emojis")), statCellOf({}, stackOf(stackInk.medals, medals), figureOf(medals, null, medals === 1 ? "medal" : "medals"))),
  );
}

function statCellOf(edge: Record<string, unknown>, ...children: Child[]): Node {
  return h("div", { width: "50%", alignItems: "center", gap: 14, padding: "16px 20px", ...edge }, ...children);
}

function figureOf(figure: number, of: number | null, label: string): Node {
  return h(
    "div",
    { alignItems: "baseline", gap: 10 },
    h("span", { fontSize: 44, fontWeight: 700, letterSpacing: -1 }, String(figure)),
    of === null ? null : h("span", { fontSize: 22, fontWeight: 600, color: ink.quiet, marginLeft: -8 }, `/${of}`),
    h("span", { fontSize: 24, color: ink.quiet }, label),
  );
}

function barOf(share: number): Node {
  return h("div", { height: 12, borderRadius: 6, backgroundColor: ink.track, width: "100%" }, h("div", { height: 12, borderRadius: 6, backgroundColor: ink.accent, width: `${Math.max(share > 0 ? 4 : 0, Math.round(share * 100))}%` }));
}

function stackOf(colours: string[], count: number): Node {
  const shown = colours.slice(0, Math.min(colours.length, count));
  if (shown.length === 0) return h("div", { width: 30, height: 30, borderRadius: 15, border: `3px dashed ${ink.border}` });
  return h("div", {}, ...shown.map((colour, index) => h("div", { width: 38, height: 38, borderRadius: 19, backgroundColor: colour, border: `3px solid ${ink.card}`, marginLeft: index === 0 ? 0 : -14 })));
}

function quietLineOf(): Node {
  return h("div", { padding: "22px 4px", fontSize: 28, lineHeight: 1.3, color: ink.quiet, borderTop: `1px solid ${ink.border}` }, `${justStarting}.`);
}

function rarestSideOf({ rarest }: PlayerCard, art: CardArt): Node {
  const colour = rarest === null ? ink.border : rarityInk[rarest.rarity];
  return h(
    "div",
    { flexDirection: "column", flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, borderRadius: 32, border: `2px solid ${colour}`, backgroundColor: ink.card, backgroundImage: `radial-gradient(circle at 50% 30%, ${colour}33, ${colour}00 65%)` },
    h(
      "div",
      { width: 236, height: 236, borderRadius: 118, alignItems: "center", justifyContent: "center", border: `6px solid ${colour}`, backgroundColor: "#1a1b1f", color: ink.quiet, fontSize: 96, fontWeight: 700 },
      rarest === null || art.rarest === null ? "?" : picture(art.rarest, 196),
    ),
    h("div", { fontSize: 22, fontWeight: 700, letterSpacing: 2.5, color: ink.accentInk }, "RAREST FIND"),
    rarest === null ? h("div", { fontSize: 28, color: ink.quiet, textAlign: "center" }, "No hoggie found yet") : h("div", { fontSize: 46, fontWeight: 700, letterSpacing: -1, textAlign: "center" }, rarest.name),
    rarest === null ? null : h("div", { fontSize: 24, fontWeight: 700, letterSpacing: 2, color: colour }, rarityWord(rarest.rarity).toUpperCase()),
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
