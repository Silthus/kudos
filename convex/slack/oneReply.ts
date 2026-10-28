import type { OneReply, OneReplyButton } from "../feedback/oneReply";
import type { Line } from "../feedback/segments";
import type { SettingsFooter } from "../feedback/settingsFooter";
import { settingsFooterText } from "./appHomeLinks";
import { mrkdwn, urlButtonOf } from "./blocks";
import { checklistBlockOf } from "./checklist";
import { slackTextOf } from "./delivery";

export function oneReplyContentOf(workspace: string, { headline, gains, context, quests, items, buttons }: OneReply, footer: SettingsFooter | null) {
  const said = slackTextOf([headline]);
  const gained = gains === null ? "" : ` · ${slackTextOf([gains])}`;
  return {
    text: `${said}${gained}`,
    blocks: [
      { type: "section", text: mrkdwn(`*${said}*${gained}`) },
      contextOf(context),
      ...(quests.length > 0 ? [checklistBlockOf(quests)] : []),
      ...(items.length > 0 ? [{ type: "section", text: mrkdwn(items.join("\n")) }] : []),
      ...(buttons.length > 0 ? [{ type: "actions", elements: buttons.map(buttonOf) }] : []),
      ...(footer === null ? [] : [contextOf([[{ text: settingsFooterText(workspace, footer) }]])]),
    ],
  };
}

function contextOf(lines: Line[]) {
  return { type: "context", elements: [mrkdwn(slackTextOf(lines))] };
}

function buttonOf({ label, url, destination, primary }: OneReplyButton) {
  return { ...urlButtonOf({ label, url, actionId: `dm-link:kudos-reply:${destination}` }), ...(primary && { style: "primary" }) };
}
