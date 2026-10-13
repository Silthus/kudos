import { expect } from "vitest";
import type { FakeSlack } from "./fakeSlack";

type TextObject = { type: string; text: string };
type Element = { type: string; text?: TextObject; style?: string; initial_channel?: string };
type Block = { type: string; text?: TextObject; fields?: TextObject[]; elements?: unknown[]; accessory?: Element };
type HomeView = { type: string; blocks: Block[] };

export function publishedHome(slack: FakeSlack, user: string) {
  const view = publishedViews(slack, user).at(-1);
  expect(view?.type).toBe("home");
  return (view?.blocks ?? []).map(readBlock);
}

export function publishedViews(slack: FakeSlack, user: string) {
  return slack
    .callsTo("views.publish")
    .filter((args) => args.user_id === user)
    .map((args) => args.view as HomeView);
}

function readBlock(block: Block) {
  if (block.type === "divider") return "divider";
  if (block.type === "header") return `header: ${plainText(block.text)}`;
  if (block.type === "context") return `context: ${(block.elements as TextObject[]).map(mrkdwn).join(" ")}`;
  if (block.type === "actions") return `actions: ${(block.elements as Element[]).map(readTab).join(" | ")}`;
  if (block.fields) return `${block.type} fields: ${block.fields.map(mrkdwn).join(" | ")}`;
  const accessory = block.accessory ? ` ${readAccessory(block.accessory)}` : "";
  return `${block.type}: ${mrkdwn(block.text)}${accessory}`;
}

function readTab(button: Element) {
  const label = plainText(button.text);
  return button.style === "primary" ? `[${label}]` : label;
}

function readAccessory(element: Element) {
  if (element.type === "button") return `[button: ${plainText(element.text)}]`;
  return `[${element.type}: ${element.initial_channel ?? "none"}]`;
}

function plainText(text: TextObject | undefined) {
  expect(text?.type).toBe("plain_text");
  return text?.text;
}

function mrkdwn(text: TextObject | undefined) {
  expect(text?.type).toBe("mrkdwn");
  return text?.text;
}
