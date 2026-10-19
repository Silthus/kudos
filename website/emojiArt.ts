import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Plugin } from "vite";
import { emojiArt as catalogue, emojiArtPictureOf, hypeEmblemPicture, teamEmblemPicture } from "../convex/album/emojiCatalogue";
import type { MilestoneId } from "../convex/album/milestoneCatalogue";

type Picture = { path: string; svg: () => string };

const size = 128;

const gold = { light: "#fff1b8", mid: "#e4b520", dark: "#c99400", glint: "#f8e39a" };

const milestoneHoggies: Record<MilestoneId, string> = {
  people: "hand-clasp",
  teams: "coding-group",
  reach: "explorer",
  hoggies: "organized",
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
  rendered ??= pictures().map(({ path, svg }) => ({ fileName: path.slice(1), source: new Resvg(svg(), { fitTo: { mode: "width", value: size } }).render().asPng() }));
  return rendered;
}

function pictures(): Picture[] {
  return [
    ...catalogue.team.map((crest) => ({ path: emojiArtPictureOf("team", crest), svg: () => teamCrest(crest) })),
    ...catalogue.milestone.map((milestone) => ({ path: emojiArtPictureOf("milestone", milestone), svg: () => milestoneEmblem(milestone) })),
    ...catalogue.level.map((level) => ({ path: emojiArtPictureOf("level", level), svg: () => levelBadge(level) })),
    { path: teamEmblemPicture, svg: teamEmblem },
    { path: hypeEmblemPicture, svg: hypeEmblem },
  ];
}

function teamCrest(crest: string) {
  return square(`<image href="${pngData(brandFolder("crests/full/png"), crest)}" x="0" y="0" width="${size}" height="${size}"/>`);
}

function milestoneEmblem(milestone: MilestoneId) {
  return square(`
    ${goldRosette()}
    <clipPath id="face"><circle cx="64" cy="64" r="44"/></clipPath>
    <circle cx="64" cy="64" r="46" fill="#fffaf0" stroke="${gold.dark}" stroke-width="3"/>
    <image href="${pngData(brandFolder("hoggies/png"), milestoneHoggies[milestone])}" x="18" y="24" width="92" height="92" clip-path="url(#face)"/>`);
}

function levelBadge(level: string) {
  const colour = levelColours[level] ?? gold.dark;
  return square(`
    ${goldRosette()}
    <circle cx="64" cy="64" r="46" fill="${colour}" stroke="#ffffff" stroke-width="4"/>
    <path d="${spark}" transform="translate(52 14) scale(1)" fill="${gold.light}"/>
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

function goldRosette() {
  return `
    <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold.glint}"/><stop offset=".5" stop-color="${gold.mid}"/><stop offset="1" stop-color="${gold.dark}"/></linearGradient></defs>
    <polygon points="${rosettePoints}" fill="url(#gold)" stroke="${gold.dark}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function square(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
}

function pngData(folder: string, name: string) {
  return `data:image/png;base64,${readFileSync(join(folder, `${name}.png`)).toString("base64")}`;
}

function brandFolder(entry: string) {
  return dirname(createRequire(import.meta.url).resolve(`@posthog/brand/${entry}`));
}
