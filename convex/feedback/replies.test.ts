import { describe, expect, test } from "vitest";
import type { Mention } from "../engine/messageEvent";
import { renderReply, type Line, type SkippedMention } from "./replies";

describe("R36 R37: the copy", () => {
  test("Given names three recipients as A, B and C", () => {
    const lines = renderReply({ kind: "given", outcome: { recipients: ["U_BOB", "U_CAROL", "U_DAN"], perRecipient: 2, left: 0, skipped: [] }, base: 10 });

    expect(plain(lines)).toEqual(["@U_BOB, @U_CAROL and @U_DAN got 2 kudos from you. That was your last kudos for today, and you'll have 10 more at midnight."]);
  });

  test("Over allowance for one person", () => {
    const lines = renderReply({ kind: "over-allowance", outcome: { cost: 4, recipients: 1, perRecipient: 4, left: 0 }, base: 3 });

    expect(plain(lines)).toEqual([
      "This needs 4 kudos (1 person × 4 kudos emoji), but you have 0 left today. Edit the message to give fewer and I'll try again, or edit it after midnight when you have 3 again.",
    ]);
  });

  test("Invalid with one reason, given once however many mentions share it", () => {
    const lines = renderReply({ kind: "invalid", outcome: { skipped: [skipped(person("U_BOT"), "bot"), skipped(person("U_OTHER_BOT"), "bot")] } });

    expect(plain(lines)).toEqual(["Nobody in this message can receive kudos: bots don't receive kudos. Tag a teammate and edit the message to try again."]);
  });

  test("Invalid names each person who isn't an active member", () => {
    const lines = renderReply({ kind: "invalid", outcome: { skipped: [skipped(person("U_DAVE"), "not-a-member"), skipped(person("U_ERIN"), "not-a-member")] } });

    expect(plain(lines)).toEqual([
      "Nobody in this message can receive kudos: @U_DAVE isn't an active member of this workspace and @U_ERIN isn't an active member of this workspace. Tag a teammate and edit the message to try again.",
    ]);
  });
});

describe("R38: the extras line", () => {
  const extras: Line = [{ text: "+4 🪙 · New sticker: " }, { mention: person("U_BOB") }];

  test("a Given reply renders its extras line once, after the skipped mentions", () => {
    const lines = renderReply({
      kind: "given",
      outcome: { recipients: ["U_BOB"], perRecipient: 1, left: 2, skipped: [skipped(person("U_ALICE"), "self")] },
      base: 3,
      extras,
    });

    expect(plain(lines)).toEqual([
      "@U_BOB got 1 kudos from you. You have 2 kudos left today.",
      "I skipped @U_ALICE: you can't give kudos to yourself.",
      "+4 🪙 · New sticker: @U_BOB",
    ]);
  });

  test("a Given reply without extras ends with the Given line", () => {
    const lines = renderReply({ kind: "given", outcome: { recipients: ["U_BOB"], perRecipient: 1, left: 2, skipped: [] }, base: 3 });

    expect(plain(lines)).toEqual(["@U_BOB got 1 kudos from you. You have 2 kudos left today."]);
  });
});

function person(user: string): Mention {
  return { kind: "person", user };
}

function skipped(mention: Mention, reason: SkippedMention["reason"]): SkippedMention {
  return { mention, reason };
}

function plain(lines: Line[]) {
  return lines.map((line) => line.map((segment) => ("text" in segment ? segment.text : `@${mentionName(segment.mention)}`)).join(""));
}

function mentionName(mention: Mention) {
  if (mention.kind === "person") return mention.user;
  return mention.kind === "group" ? mention.group : mention.range;
}
