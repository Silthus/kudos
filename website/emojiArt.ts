import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Plugin } from "vite";
import { emojiArtPictureOf, emojiArt as catalogue, hypeEmblemPicture, milestoneTierArtOf, milestoneTierEmojis, teamEmblemPicture } from "../convex/album/emojiCatalogue";
import type { MilestoneId } from "../convex/album/milestoneCatalogue";
import type { MilestoneTier } from "../convex/album/records";
import { hoggieSharePictureOf, sharedHoggies } from "../convex/items/shareArt";

type Picture = { path: string; svg: () => string };

const size = 128;

type Metal = { glint: string; mid: string; dark: string };

const metals: Record<MilestoneTier, Metal> = {
  bronze: { glint: "#f3d6bb", mid: "#d39a68", dark: "#a3622c" },
  silver: { glint: "#f1f2f4", mid: "#bfc2c8", dark: "#737780" },
  gold: { glint: "#f8e39a", mid: "#e2b53a", dark: "#94700a" },
  diamond: { glint: "#e2f5fa", mid: "#7cc9de", dark: "#2a7f9e" },
};

const levelGold = { light: "#fff1b8", mid: "#e4b520", dark: "#c99400", glint: "#f8e39a" };

const sparkled: ReadonlySet<MilestoneTier> = new Set(["gold", "diamond"]);

const milestoneHoggies: Record<MilestoneId, string> = {
  people: "explorer",
  teams: "coding-group",
  reach: "hand-clasp",
  hoggies: "star",
  thoughtful: "heart",
};

const levelColours: Record<string, string> = { "5": "#f54e00", "10": "#1d4aff", "15": "#29a37a", "20": "#b62ad9", "25": "#c99400" };

const digitStrokes: Record<string, string> = {
  "0": "M5 1C1.6 1 .5 4.6 .5 8s1.1 7 4.5 7 4.5-3.6 4.5-7S8.4 1 5 1Z",
  "1": "M2 4.2 6 1v14",
  "2": "M.8 4.4C1.3 2.1 2.9 1 5 1c2.6 0 4.2 1.5 4.2 3.7 0 2.6-2.7 4.6-8.4 10.3h8.6",
  "5": "M9 1H1.8L1 7.6C2.1 6.6 3.4 6.1 4.9 6.1c2.8 0 4.6 1.9 4.6 4.4 0 2.8-2 4.5-4.7 4.5-2 0-3.5-.8-4.4-2.2",
};

const rosettePoints = Array.from({ length: 56 }, (_, index) => {
  const radius = index % 2 === 0 ? 64 : 58;
  const angle = (Math.PI * index) / 28 - Math.PI / 2;
  return `${(64 + radius * Math.cos(angle)).toFixed(2)},${(64 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

const sparkle = "M110 2 112.6 13.4 124 16 112.6 18.6 110 30 107.4 18.6 96 16 107.4 13.4Z";

const spark = "M12 1.5 14.6 8.4 21.8 9.1 16.3 13.8 18 21 12 17.1 6 21 7.7 13.8 2.2 9.1 9.4 8.4Z";

const shield = "M32 4 56 13v22c0 11-11 19-24 25C19 54 8 46 8 35V13z";

export function emojiArt(): Plugin {
  return {
    name: "emoji-art",
    generateBundle() {
      for (const { fileName, source } of emojiArtFiles()) this.emitFile({ type: "asset", fileName, source });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const file = emojiArtFiles().find(({ fileName }) => `/${fileName}` === request.url);
        if (file === undefined) return next();
        response.setHeader("Content-Type", "image/png");
        response.end(file.source);
      });
    },
  };
}

let rendered: { fileName: string; source: Uint8Array }[] | undefined;

export function emojiArtFiles() {
  rendered ??= [...pictures().map(({ path, svg }) => ({ fileName: path.slice(1), source: new Resvg(svg(), { fitTo: { mode: "width", value: size } }).render().asPng() })), ...shareArtFiles()];
  return rendered;
}

function pictures(): Picture[] {
  return [
    ...catalogue.team.map((crest) => ({ path: emojiArtPictureOf("team", crest), svg: () => teamCrest(crest) })),
    ...milestoneTierEmojis.map(({ milestone, tier }) => ({ path: emojiArtPictureOf("milestone", milestoneTierArtOf(milestone, tier)), svg: () => milestoneMedal(milestone, tier) })),
    ...catalogue.level.map((level) => ({ path: emojiArtPictureOf("level", level), svg: () => levelEmblem(level) })),
    { path: teamEmblemPicture, svg: teamEmblem },
    { path: hypeEmblemPicture, svg: hypeEmblem },
  ];
}

function teamCrest(crest: string) {
  return square(`<image href="${pngData(brandFolder("crests/full/png"), crest)}" x="0" y="0" width="${size}" height="${size}"/>`);
}

function milestoneMedal(milestone: MilestoneId, tier: MilestoneTier) {
  const metal = metals[tier];
  return square(`
    ${rosette(metal)}
    <clipPath id="face"><circle cx="64" cy="64" r="44"/></clipPath>
    <circle cx="64" cy="64" r="46" fill="#fffaf0" stroke="${metal.dark}" stroke-width="3"/>
    <image href="${pngData(brandFolder("hoggies/png"), milestoneHoggies[milestone])}" x="18" y="24" width="92" height="92" clip-path="url(#face)"/>
    ${sparkled.has(tier) ? `<path d="${sparkle}" fill="${metal.glint}" stroke="${metal.dark}" stroke-width="2.5" stroke-linejoin="round"/>` : ""}`);
}

function levelEmblem(level: string) {
  const colour = levelColours[level] ?? levelGold.dark;
  return square(`
    ${rosette(levelGold)}
    <circle cx="64" cy="64" r="46" fill="${colour}" stroke="#ffffff" stroke-width="4"/>
    <path d="${spark}" transform="translate(52 14) scale(1)" fill="${levelGold.light}"/>
    ${digits(level)}`);
}

function digits(level: string) {
  const digitWidth = 10;
  const gap = 3.5;
  const scale = 3.2;
  const width = (level.length * digitWidth + (level.length - 1) * gap) * scale;
  const strokes = [...level].map((digit, index) => `<path d="${digitStrokes[digit]}" transform="translate(${index * (digitWidth + gap)} 0)"/>`).join("");
  return `<g transform="translate(${64 - width / 2} ${66 - 8 * scale}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${strokes}</g>`;
}

function teamEmblem() {
  return square(`<g transform="scale(2)"><path d="${shield}" fill="#e5e7e0"/><path d="${shield}" fill="none" stroke="#4d4f46" stroke-width="2.5" stroke-linejoin="round"/></g>`);
}

function hypeEmblem() {
  return square(`
    <defs><linearGradient id="hype" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9bd2b"/><stop offset="1" stop-color="#f54e00"/></linearGradient></defs>
    <circle cx="64" cy="64" r="62" fill="url(#hype)"/>
    <path d="${spark}" transform="translate(28 28) scale(3)" fill="#ffffff"/>`);
}

function rosette({ glint, mid, dark }: Metal) {
  return `
    <defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${glint}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
    <polygon points="${rosettePoints}" fill="url(#metal)" stroke="${dark}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function square(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
}

function shareArtFiles() {
  const folder = brandFolder("hoggies/png");
  return sharedHoggies.map((hoggie) => ({ fileName: hoggieSharePictureOf(hoggie).slice(1), source: readFileSync(brandPictureOf(folder, hoggie)) }));
}

function brandPictureOf(folder: string, hoggie: string) {
  const named = join(folder, `${hoggie}.png`);
  return existsSync(named) ? named : join(folder, `${hoggie}-1.png`);
}

function pngData(folder: string, name: string) {
  return `data:image/png;base64,${readFileSync(join(folder, `${name}.png`)).toString("base64")}`;
}

function brandFolder(entry: string) {
  return dirname(createRequire(import.meta.url).resolve(`@posthog/brand/${entry}`));
}
