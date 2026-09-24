import { describe, expect, test } from "vitest";
import { baseEmojiName, countEmoji, countNoteWords, mentionedUsers, previewText } from "./parse";

describe("parsing a kudos message", () => {
  test("every emoji is one kudos for every mentioned person", () => {
    const text = "<@U1> <@U2> :taco: :taco: thanks!";
    expect([countEmoji(text, "taco"), mentionedUsers(text)]).toEqual([2, ["U1", "U2"]]);
  });

  test("only the configured emoji makes a message a kudos attempt, mentions or not", () => {
    expect(countEmoji("<@U1> thanks!", "taco")).toBe(0);
    expect(countEmoji("<@U1> :burrito:", "taco")).toBe(0);
    expect(countEmoji(":taco: for everyone", "taco")).toBe(1);
  });

  test("counts adjacent emojis and skin-tone variants", () => {
    expect(countEmoji(":taco::taco::taco::skin-tone-3:", "taco")).toBe(3);
  });

  test("does not match emojis that merely contain the name", () => {
    expect(countEmoji(":taco-party: :tacos:", "taco")).toBe(0);
  });

  test("supports emoji names with regex characters", () => {
    expect(countEmoji(":+1: :+1:", "+1")).toBe(2);
  });

  test("deduplicates mentions and understands labelled mentions", () => {
    expect(mentionedUsers("<@U1|ana> <@U1> <@W2>")).toEqual(["U1", "W2"]);
  });
});

test("baseEmojiName strips skin tones from reaction names", () => {
  expect(baseEmojiName("taco::skin-tone-2")).toBe("taco");
  expect(baseEmojiName("taco")).toBe("taco");
});

describe("previewText", () => {
  const names = (id: string) => ({ U1: "Ana" })[id];

  test("resolves mentions, channels, links and entities", () => {
    expect(previewText("<@U1> in <#C1|general> &amp; <https://x.io|docs>", names)).toBe("@Ana in #general & docs");
  });

  test("falls back for unknown users and truncates long text", () => {
    expect(previewText("<@U9> hi", names)).toBe("@someone hi");
    expect(previewText("a".repeat(20), names, 10)).toBe(`${"a".repeat(9)}…`);
  });
});

test("only Slack-shaped user ids count as mentions", () => {
  expect(mentionedUsers("<@UDEMOPRIYA> <@U_NOT_SLACK> <@here>")).toEqual(["UDEMOPRIYA"]);
});

describe("countNoteWords", () => {
  const words = (text: string) => countNoteWords(text, "taco", "🌮");

  test("counts only the words of the Note", () => {
    expect(words("<@U1> :taco: thanks for the review")).toBe(4);
    expect(words("<@U1|ana> <@U2> :taco::taco:")).toBe(0);
  });

  test("strips mentions, channel links, specials, URLs, shortcodes, skin tones and the glyph", () => {
    expect(words("<#C1|general> <!here> <https://x.io|the docs> <mailto:a@b.c> :taco::skin-tone-3: :tada: 🌮 🎉 nice one")).toBe(2);
    expect(words("see https://example.com/a-b now")).toBe(2);
  });

  test("punctuation isn't a word; apostrophes and hyphens stay inside words", () => {
    expect(words("<@U1> :taco: — you're a life-saver!!! ... &amp; thanks’n’all")).toBe(4);
  });

  test("letters and digits in any script count", () => {
    expect(words("danke für 2 Stunden Hilfe, 谢谢")).toBe(6);
    // Combining marks stay inside their word.
    expect(words("धन्यवाद बहुत अच्छा")).toBe(3);
  });
});
