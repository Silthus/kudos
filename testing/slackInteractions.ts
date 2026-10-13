import { expect } from "vitest";
import type { FakeSlack } from "./fakeSlack";

export type TextObject = { type: string; text: string };
export type Button = { type: "button"; action_id: string; value: string; text: TextObject; style?: string };
export type Block = { type: string; block_id?: string; text?: TextObject; fields?: TextObject[]; elements?: Array<TextObject | Button> };
type HomeView = { type: string; blocks: Block[] };

export function publishedHomeBlocks(slack: FakeSlack, user: string): Block[] {
  const published = slack.callsTo("views.publish").filter((args) => args.user_id === user);
  const view = published.at(-1)?.view as HomeView | undefined;
  expect(view?.type).toBe("home");
  return view?.blocks ?? [];
}

export function publishedHome(slack: FakeSlack, user: string) {
  return publishedHomeBlocks(slack, user).map(readBlock);
}

export function buttonIn(blocks: Block[], label: string): { block: Block; button: Button } {
  for (const block of blocks) {
    const button = (block.elements ?? []).find((element): element is Button => element.type === "button" && (element as Button).text.text === label);
    if (button) return { block, button };
  }
  throw new Error(`App Home shows no ${label} button`);
}

export function blockActions(user: string, { block, button }: { block: Block; button: Button }, options: { team?: string } = {}) {
  const team = options.team ?? "T1";
  const payload = {
    type: "block_actions",
    team: { id: team },
    user: { id: user, team_id: team },
    api_app_id: "A_KUDOS",
    trigger_id: "1.2.3",
    container: { type: "view", view_id: "V1" },
    view: { id: "V1", type: "home" },
    actions: [{ type: "button", block_id: block.block_id, action_id: button.action_id, value: button.value, text: button.text, action_ts: "1760349600.000300" }],
  };
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
}

function readBlock(block: Block) {
  if (block.type === "divider") return "divider";
  if (block.type === "header") return `header: ${plainText(block.text)}`;
  if (block.type === "actions") return `actions: ${(block.elements as Button[]).map(readButton).join(" | ")}`;
  if (block.type === "context") return `context: ${(block.elements as TextObject[]).map(mrkdwn).join(" ")}`;
  if (block.fields) return `${block.type} fields: ${block.fields.map(mrkdwn).join(" | ")}`;
  return `${block.type}: ${mrkdwn(block.text)}`;
}

function readButton(button: Button) {
  const label = plainText(button.text);
  return button.style === "primary" ? `[${label}]` : label;
}

function plainText(text: TextObject | undefined) {
  expect(text?.type).toBe("plain_text");
  return text?.text;
}

function mrkdwn(text: TextObject | undefined) {
  expect(text?.type).toBe("mrkdwn");
  return text?.text;
}
