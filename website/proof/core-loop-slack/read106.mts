import { writeFileSync } from "node:fs";
import { required, slackRead, storedShapeOf } from "./slack.mts";

const channel = required("KUDOS_PUBLIC_CHANNEL");
const [firstKudosTs, secondKudosTs] = process.argv.slice(2);
if (!firstKudosTs || !secondKudosTs) throw new Error("usage: read106.mts <first kudos ts> <second kudos ts>");
const out = process.env.KUDOS_OUT ?? "/tmp/slack-proof/reply-106.json";

const thread = await slackRead("conversations.replies", { channel, ts: firstKudosTs });
const history = await slackRead("conversations.history", { channel, oldest: firstKudosTs, limit: "20" });
const botPosts = (history.messages ?? []).filter(({ bot_id }) => bot_id !== undefined).reverse();

const proof = {
  channel,
  readAt: new Date().toISOString(),
  note: "The kudos were signed by hand and have no real Slack message, so conversations.replies on their ts answers thread_not_found and Slack stored the bot's replies (posted with that thread_ts) at the channel's top level. They are read back with conversations.history from the first kudos ts.",
  kudos: { firstToTwoRecipients: firstKudosTs, secondToTobiasAgain: secondKudosTs },
  repliesOnTheKudosTs: { ok: thread.ok, error: thread.error },
  history: { ok: history.ok, error: history.error },
  botPosts: botPosts.map(storedShapeOf),
};
writeFileSync(out, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(proof, null, 2));
