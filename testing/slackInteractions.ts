import { expect } from "vitest";
import type { FakeSlack } from "./fakeSlack";

export type TextObject = { type: string; text: string };
type SelectOption = { text: TextObject; value: string };
type Element = { type: string; text?: TextObject; style?: string; initial_channel?: string; action_id?: string; value?: string; url?: string; options?: SelectOption[]; initial_option?: SelectOption };
export type Block = { type: string; block_id?: string; text?: TextObject; fields?: TextObject[]; elements?: Array<TextObject | Element>; accessory?: Element };
type HomeView = { type: string; blocks: Block[] };

export type BlockAction =
  | { type: "button"; action_id: string; value?: string; block_id?: string }
  | { type: "channels_select"; action_id: string; selected_channel: string | null; block_id?: string }
  | { type: "static_select"; action_id: string; selected_option: { value: string }; block_id?: string };

export function publishedHomeBlocks(slack: FakeSlack, user: string): Block[] {
  const view = slack.homeShownTo(user) as HomeView | undefined;
  expect(view?.type).toBe("home");
  return view?.blocks ?? [];
}

export function publishedHome(slack: FakeSlack, user: string) {
  return readBlocks(publishedHomeBlocks(slack, user));
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

export function buttonIn(blocks: Block[], label: string): BlockAction {
  for (const block of blocks) {
    const button = elementsOf(block).find((element) => element.type === "button" && element.text?.text === label);
    if (button) return { type: "button", action_id: button.action_id!, ...(button.value !== undefined && { value: button.value }), ...(block.block_id && { block_id: block.block_id }) };
  }
  throw new Error(`no ${label} button among the blocks`);
}

export function staleButtonOf(command: unknown): BlockAction {
  const encoded = JSON.stringify(command);
  return { type: "button", action_id: encoded, value: encoded };
}

export function buttonInHome(slack: FakeSlack, user: string, label: string): BlockAction {
  return buttonIn(publishedHomeBlocks(slack, user), label);
}

export function channelPickerInHome(slack: FakeSlack, user: string, channel: string | null): BlockAction {
  const picker = publishedHomeBlocks(slack, user)
    .flatMap(elementsOf)
    .find((element) => element.type === "channels_select");
  expect(picker, `a channel picker in ${user}'s App Home`).toBeDefined();
  return { type: "channels_select", action_id: picker!.action_id!, selected_channel: channel };
}

export function optionPickedInHome(slack: FakeSlack, user: string, row: string, option: string): BlockAction {
  const picker = publishedHomeBlocks(slack, user).find((block) => block.text?.text.startsWith(`*${row}*`))?.accessory;
  const picked = picker?.options?.find(({ text }) => text.text === option);
  expect(picked, `${option} in the ${row} picker in ${user}'s App Home`).toBeDefined();
  return { type: "static_select", action_id: picker!.action_id!, selected_option: { value: picked!.value } };
}

let interactions = 0;

export type ClickedMessage = { channel: string; ts: string; ephemeral?: boolean; threadTs?: string };

export function blockActions(user: string, action: BlockAction, options: { team?: string; inMessage?: ClickedMessage } = {}) {
  const team = options.team ?? "T1";
  interactions += 1;
  const payload = {
    type: "block_actions",
    team: { id: team, domain: "kudos" },
    user: { id: user, team_id: team },
    api_app_id: "A_KUDOS",
    trigger_id: `${interactions}.1760349600.trigger`,
    ...(options.inMessage === undefined ? homeContainer() : messageContainer(options.inMessage)),
    actions: [{ block_id: "b1", ...action, action_ts: "1760349600.000300" }],
  };
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
}

function homeContainer() {
  return { container: { type: "view", view_id: "V_HOME" }, view: { id: "V_HOME", type: "home" } };
}

function messageContainer({ channel, ts, ephemeral = false, threadTs }: ClickedMessage) {
  const container = { type: "message", message_ts: ts, channel_id: channel, is_ephemeral: ephemeral, ...(threadTs && { thread_ts: threadTs }) };
  return { container, channel: { id: channel }, ...(!ephemeral && { message: { type: "message", ts } }) };
}

function elementsOf(block: Block): Element[] {
  const elements = block.type === "actions" ? (block.elements as Element[]) : [];
  return [...elements, ...(block.accessory ? [block.accessory] : [])];
}

function readBlock(block: Block) {
  if (block.type === "divider") return "divider";
  if (block.type === "header") return `header: ${plainText(block.text)}`;
  if (block.type === "actions") return `actions: ${(block.elements as Element[]).map(readButton).join(" | ")}`;
  if (block.type === "context") return `context: ${(block.elements as TextObject[]).map(mrkdwn).join(" ")}`;
  if (block.fields) return `${block.type} fields: ${block.fields.map(mrkdwn).join(" | ")}`;
  const accessory = block.accessory ? ` ${readAccessory(block.accessory)}` : "";
  return `${block.type}: ${mrkdwn(block.text)}${accessory}`;
}

function readButton(button: Element) {
  const label = plainText(button.text);
  return button.style === "primary" ? `[${label}]` : label;
}

function readAccessory(element: Element) {
  if (element.type === "button" && element.url !== undefined) return `[link: ${plainText(element.text)} ${element.url}]`;
  if (element.type === "button") return `[button: ${plainText(element.text)}]`;
  if (element.type === "static_select") return `[select: ${plainText(element.initial_option?.text)}]`;
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
