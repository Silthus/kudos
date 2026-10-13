import { expect } from "vitest";
import type { FakeSlack } from "./fakeSlack";
import type { BlockAction } from "./slackMessages";

type TextObject = { type: string; text: string };
type Element = { type: string; text?: TextObject; style?: string; initial_channel?: string; action_id?: string; value?: string };
export type Block = { type: string; text?: TextObject; fields?: TextObject[]; elements?: unknown[]; accessory?: Element };
type HomeView = { type: string; blocks: Block[] };

export function publishedHome(slack: FakeSlack, user: string) {
  const view = slack.homeShownTo(user) as HomeView | undefined;
  expect(view?.type).toBe("home");
  return readBlocks(view?.blocks ?? []);
}

export function readBlocks(blocks: Block[]) {
  return blocks.map(readBlock);
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

export function buttonInHome(slack: FakeSlack, user: string, label: string): BlockAction {
  return buttonAmong(elementsInHome(slack, user), label, `${user}'s App Home`);
}

export function buttonInBlocks(blocks: Block[], label: string): BlockAction {
  return buttonAmong(elementsOf(blocks), label, "the message");
}

function buttonAmong(elements: Element[], label: string, place: string): BlockAction {
  const button = elements.find((element) => element.type === "button" && element.text?.text === label);
  expect(button, `a ${label} button in ${place}`).toBeDefined();
  return { type: "button", action_id: button!.action_id!, ...(button!.value !== undefined && { value: button!.value }) };
}

export function channelPickerInHome(slack: FakeSlack, user: string, channel: string | null): BlockAction {
  const picker = elementsInHome(slack, user).find((element) => element.type === "channels_select");
  expect(picker, `a channel picker in ${user}'s App Home`).toBeDefined();
  return { type: "channels_select", action_id: picker!.action_id!, selected_channel: channel };
}

function elementsInHome(slack: FakeSlack, user: string) {
  return elementsOf((slack.homeShownTo(user) as HomeView | undefined)?.blocks ?? []);
}

function elementsOf(blocks: Block[]) {
  return blocks.flatMap((block) => [...(block.type === "actions" ? (block.elements as Element[]) : []), ...(block.accessory ? [block.accessory] : [])]);
}
