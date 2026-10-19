import { useState } from "react";
import type { AlbumEmoji } from "./answer";
import { addToSlack, type AddedToSlack } from "./addToSlack";

type Adding = { kind: "idle" } | { kind: "adding" } | { kind: "added"; added: AddedToSlack } | { kind: "failed" };

export function AddToSlackButton({ emoji, emojiPage }: { emoji: Pick<AlbumEmoji, "kind" | "name" | "picture" | "from">; emojiPage: string | null }) {
  const [adding, setAdding] = useState<Adding>({ kind: "idle" });
  const add = () => {
    setAdding({ kind: "adding" });
    addToSlack(emoji, emojiPage).then(
      (added) => setAdding({ kind: "added", added }),
      () => setAdding({ kind: "failed" }),
    );
  };
  return (
    <span className="al-add-to-slack">
      <button type="button" className="al-add-to-slack-button ph-no-capture" onClick={add} disabled={adding.kind === "adding"} aria-label={`Add :${emoji.name}: to Slack`}>
        {adding.kind === "adding" ? "Saving…" : "Add to Slack"}
      </button>
      <span role="status" className="al-add-to-slack-said ph-no-capture">
        {saidOf(adding, emoji.name)}
      </span>
    </span>
  );
}

function saidOf(adding: Adding, name: string) {
  if (adding.kind === "failed") return "The picture couldn't be saved. Try again.";
  if (adding.kind !== "added") return "";
  const { file, copied, pageOpened } = adding.added;
  if (!pageOpened) return `Saved ${file}. In Slack, add it as :${name}: under Customize workspace, Emoji.`;
  return copied ? `Saved ${file} and copied :${name}:. Add it on Slack's emoji page under that name.` : `Saved ${file}. Add it on Slack's emoji page as :${name}:.`;
}
