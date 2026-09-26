import { describe, expect, test } from "vitest";
import { alreadySent, everydayEmoji, guidance, reactionFor } from "./guidance";

const limit = (people: number, amountEach: number, remaining: number) =>
  guidance({ kind: "limit", people, amountEach, remaining, limit: 5 }, "🌮");

describe("over-allowance guidance shows the math and a fix that fits", () => {
  test("the spec's example: 2 people × 2 🌮 with 3 left", () => {
    expect(limit(2, 2, 3)).toBe(
      "Every 🌮 goes to every person you mention: 2 people × 2 🌮 = 4 🌮, but you have 3 left today. " +
        "Nothing was sent. To fix it, edit your message: use 1 🌮 so each of them gets 1 (2 in total), or mention just 1 person.",
    );
  });

  test("one person: how many still fit", () => {
    expect(limit(1, 4, 3)).toBe("That's 4 🌮, but you have 3 left today. Nothing was sent. Edit your message down to 3 🌮 to send it.");
    expect(limit(1, 2, 1)).toMatch(/Edit your message down to 1 🌮 to send it\.$/);
  });

  test("too many people for even one each: mention fewer", () => {
    expect(limit(3, 1, 2)).toMatch(/3 people × 1 🌮 = 3 🌮, but you have 2 left today\. Nothing was sent\. To fix it, edit your message: mention at most 2 people\.$/);
  });

  test("neither fewer 🌮 each nor fewer people at this amount fit: thank one person", () => {
    expect(limit(3, 3, 2)).toMatch(/To fix it, edit your message: thank one person with up to 2 🌮\.$/);
  });

  test("nothing left: when the allowance comes back, no math", () => {
    expect(limit(2, 1, 0)).toBe("You've given all 5 🌮 you have for today, so nothing was sent. Your allowance resets at midnight.");
  });
});

test("every invalid attempt shows a valid example and says an edit fixes it", () => {
  for (const kind of ["no_mention", "group", "self", "bots", "inactive"] as const) {
    expect(guidance({ kind }, ":taco:")).toMatch(/like “@alex :taco: thanks for the review!” Edit your message to fix it\.$/);
  }
});

test("an edit can't change kudos already sent", () => {
  expect(alreadySent("tacos")).toBe("Your edit didn't change anything, because the tacos in this message were already sent.");
});

test("each outcome has its reaction; given uses the workspace's kudos emoji", () => {
  expect([reactionFor("given", "taco"), reactionFor("limit", "taco"), reactionFor("invalid", "taco")]).toEqual(["taco", "hourglass_flowing_sand", "x"]);
});

test("everyday emoji are the ones people type in chat without thanking anyone (#168)", () => {
  expect(["seedling", "heart", "tada", "+1"].filter(everydayEmoji)).toEqual(["seedling", "heart", "tada", "+1"]);
  // A kudos convention (HeyTaco's taco) or a custom emoji is typed on purpose.
  expect(["taco", "kudos", "lumen-star"].filter(everydayEmoji)).toEqual([]);
});
