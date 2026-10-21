import { useRef, useState } from "react";
import type { MappingTarget } from "../../../convex/album/emojiMappings";
import type { SlackEmojiMatchesRead } from "../emojiWizardReads";
import type { ShellActions } from "../shell";
import type { HypePickReply } from "./answer";
import { SlackEmojiWizard, type WizardEmoji, type WizardPick } from "./SlackEmojiWizard";

export type HypePicker = { useSlackEmojiMatches: SlackEmojiMatchesRead; pickMyHypeEmoji: ShellActions["pickMyHypeEmoji"] };

type OwnHypePickProps = HypePicker & { emoji: WizardEmoji & { inSlack: boolean }; emojiPage: string | null };

const holderWordsOf: Record<MappingTarget["kind"], string> = {
  team: "a team's emoji",
  milestone: "a medal's emoji",
  level: "a level's emoji",
  random: "a random drop",
  hype: "someone else's hype emoji",
};

export function OwnHypePick({ emoji, emojiPage, useSlackEmojiMatches, pickMyHypeEmoji }: OwnHypePickProps) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };
  return (
    <>
      <button ref={opener} type="button" className="al-add-to-slack-button ph-no-capture" aria-label={`${emoji.inSlack ? "Change" : "Pick"} your hype emoji`} onClick={() => setOpen(true)}>
        {emoji.inSlack ? "Change" : "Pick in Slack"}
      </button>
      {open && <SlackEmojiWizard emoji={emoji} whose="your" inUse="asks" changes={emoji.inSlack} named="your hype emoji" emojiPage={emojiPage} useSlackEmojiMatches={useSlackEmojiMatches} pick={async (name) => wizardPickOf(await pickMyHypeEmoji(name))} onClose={close} />}
    </>
  );
}

function wizardPickOf(reply: HypePickReply): WizardPick {
  if (reply.kind === "picked") return "mapped";
  if (reply.kind === "taken") return { refused: `That one is already ${holderWordsOf[reply.by]}. Pick another one.` };
  if (reply.kind === "refused") return { refused: "That didn't save. The Slack emoji may be gone from Slack. Pick another one." };
  return "unreachable";
}
