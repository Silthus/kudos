export type KudosCommandResult = "joined" | "already-in" | "private-channel" | "direct-message";

const replies: Record<KudosCommandResult, string> = {
  joined: "I'm in now. Mention teammates with a kudos emoji here and I'll pass the kudos on.",
  "already-in": "I'm already in this channel. Mention teammates with a kudos emoji to give kudos.",
  "private-channel": "I can't join private channels by myself. Type `/invite @Kudos` here and I'll start counting kudos.",
  "direct-message": "I only count kudos in channels. Run /kudos in the channel you want me in.",
};

export function renderKudosCommandReply(result: KudosCommandResult): string {
  return replies[result];
}
