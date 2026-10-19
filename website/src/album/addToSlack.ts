import { hypeEmblemPicture, teamEmblemPicture } from "../../../convex/album/emojiCatalogue";
import type { AlbumEmoji } from "./answer";
import { initialsOf } from "./emojiShelf";

export type SlackBound = Pick<AlbumEmoji, "kind" | "name" | "picture" | "from">;

export type AddedToSlack = { file: string; copied: boolean; pageOpened: boolean };

const emojiSize = 128;

const frameWidth = 7;

const pictureWaitMs = 5_000;

const frameColours = ["#F54E00", "#F7A501"] as const;

const facelessColours = ["#E25A12", "#A33A0C"] as const;

export async function addToSlack(emoji: SlackBound, emojiPage: string | null): Promise<AddedToSlack> {
  const copied = copyToClipboard(`:${emoji.name}:`);
  const pageOpened = emojiPage !== null && openInANewTab(emojiPage);
  const file = fileNameOf(emoji);
  await downloadPictureOf(emoji, file);
  return { file, copied: await copied, pageOpened };
}

export function fileNameOf({ name }: Pick<AlbumEmoji, "name">) {
  return `${name}.png`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function openInANewTab(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}

async function downloadPictureOf(emoji: SlackBound, file: string) {
  if (emoji.kind === "hype") return saveBlob(await hypePictureOf(emoji), file);
  if (isOwnFile(emoji.picture)) return saveHref(emoji.picture, file);
  const drawn = await drawnOrNull((context) => drawWhole(context, emoji.picture));
  return drawn === null ? saveHref(teamEmblemPicture, file) : saveBlob(drawn, file);
}

async function hypePictureOf(emoji: SlackBound): Promise<Blob> {
  const framed = emoji.picture === hypeEmblemPicture ? null : await drawnOrNull((context) => drawFramedFace(context, emoji.picture));
  return framed ?? (await drawn((context) => drawEmblemWithInitials(context, initialsOf(emoji.from))));
}

function isOwnFile(picture: string) {
  return picture.startsWith("/") && !picture.startsWith("//");
}

type Drawing = (context: CanvasRenderingContext2D) => Promise<void>;

async function drawnOrNull(draw: Drawing): Promise<Blob | null> {
  try {
    return await drawn(draw);
  } catch {
    return null;
  }
}

async function drawn(draw: Drawing): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = emojiSize;
  canvas.height = emojiSize;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("This browser can't draw the emoji.");
  await draw(context);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob === null ? reject(new Error("The emoji couldn't be saved.")) : resolve(blob)), "image/png"));
}

async function drawWhole(context: CanvasRenderingContext2D, picture: string) {
  drawFitted(context, await pictureAt(picture), { at: 0, size: emojiSize }, "contain");
}

async function drawFramedFace(context: CanvasRenderingContext2D, picture: string) {
  const face = await pictureAt(picture);
  const centre = emojiSize / 2;
  const ring = context.createLinearGradient(0, 0, emojiSize, emojiSize);
  ring.addColorStop(0, frameColours[0]);
  ring.addColorStop(1, frameColours[1]);
  context.fillStyle = ring;
  context.beginPath();
  context.arc(centre, centre, centre, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.beginPath();
  context.arc(centre, centre, centre - frameWidth, 0, Math.PI * 2);
  context.clip();
  drawFitted(context, face, { at: frameWidth, size: emojiSize - 2 * frameWidth }, "cover");
  context.restore();
}

async function drawEmblemWithInitials(context: CanvasRenderingContext2D, initials: string) {
  const centre = emojiSize / 2;
  const disc = context.createLinearGradient(0, 0, emojiSize, emojiSize);
  disc.addColorStop(0, facelessColours[0]);
  disc.addColorStop(1, facelessColours[1]);
  context.fillStyle = disc;
  context.beginPath();
  context.arc(centre, centre, centre, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#FFFFFF";
  context.font = `800 ${Math.round(emojiSize * 0.38)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(initials, centre, centre + 2);
  drawStar(context, emojiSize * 0.8, emojiSize * 0.2, emojiSize * 0.13);
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.fillStyle = "#FFD23F";
  context.beginPath();
  for (let point = 0; point < 10; point++) {
    const reach = point % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.closePath();
  context.fill();
}

type Square = { at: number; size: number };

function drawFitted(context: CanvasRenderingContext2D, image: HTMLImageElement, square: Square, fit: "contain" | "cover") {
  const width = image.naturalWidth || square.size;
  const height = image.naturalHeight || square.size;
  const scale = (fit === "contain" ? Math.min : Math.max)(square.size / width, square.size / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  context.drawImage(image, square.at + (square.size - drawnWidth) / 2, square.at + (square.size - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function pictureAt(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const giveUp = window.setTimeout(() => reject(new Error("The picture took too long.")), pictureWaitMs);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      window.clearTimeout(giveUp);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(giveUp);
      reject(new Error("The picture didn't load."));
    };
    image.src = src;
  });
}

function saveBlob(blob: Blob, file: string) {
  const href = URL.createObjectURL(blob);
  saveHref(href, file);
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

function saveHref(href: string, file: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = file;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}
