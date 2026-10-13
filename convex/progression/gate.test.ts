import { expect, test } from "vitest";
import { annotationsOf } from "../parser/parser";

test.each([
  ["five words", "thanks for fixing the build", 5, true],
  ["four words", "thanks for the fix", 4, false],
  ["no words", "", 0, false],
  ["runs of punctuation", "thanks ! — for the fix", 4, false],
  ["words around punctuation", "thanks, for the fix!", 4, false],
  ["digits", "shipped 3 releases in 2 days", 6, true],
  ["letters of any script", "danke für die schnelle hilfe", 5, true],
  ["any whitespace", "thanks\nfor\tthe   quick fix", 5, true],
])("P11: %s", (_, text, words, thoughtful) => {
  const annotations = annotationsOf({ mentions: [{ kind: "person", user: "U_BOB" }], emoji: ["taco"], text }, { workspace: "T1", giver: undefined });

  expect(annotations.gate).toEqual({ version: 1, thoughtful, words });
});
