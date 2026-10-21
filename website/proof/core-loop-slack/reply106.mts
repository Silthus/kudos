import { writeFileSync } from "node:fs";
import { join, pause, required, slackRead, storedShapeOf, thanks, type Person, type Sent } from "./slack.mts";

const workspace = required("KUDOS_WORKSPACE");
const channel = required("KUDOS_PUBLIC_CHANNEL");
const cast = required("KUDOS_CAST");
const out = process.env.KUDOS_OUT ?? "/tmp/slack-proof/reply-106.json";

const juniper: Person = { id: `U0PRFSLKJUN${cast}`, name: "Juniper Ashdown", workspace };
const tobias: Person = { id: `U0PRFSLKTOB${cast}`, name: "Tobias Fenwick", workspace };
const lark: Person = { id: `U0PRFSLKLRK${cast}`, name: "Lark Ellery", workspace };

async function botRepliesTo(kudos: Sent, wanted: number) {
  for (let tries = 0; tries < 30; tries += 1) {
    const thread = await slackRead("conversations.replies", { channel: kudos.channel, ts: kudos.ts });
    const replies = (thread.messages ?? []).filter(({ bot_id, ts }) => bot_id !== undefined && ts !== kudos.ts);
    if (!thread.ok || replies.length >= wanted) return { ok: thread.ok, error: thread.error, kudosTs: kudos.ts, replies: replies.map(storedShapeOf) };
    await pause(4_000);
  }
  return { ok: false, error: "no bot reply within two minutes", kudosTs: kudos.ts, replies: [] };
}

for (const person of [juniper, tobias, lark]) console.log(`team_join ${person.id} answered ${await join(person)}`);
await pause(8_000);

const both = await thanks(juniper, [tobias, lark], "thank you for pairing on the flaky release checks all afternoon and writing down every step for the next person", { channel });
console.log(`kudos to two recipients at ts ${both.ts}`);
await pause(6_000);
const again = await thanks(juniper, [tobias], "and thank you again for staying on to double-check the rollback notes before the release went out", { channel });
console.log(`second kudos to one recipient at ts ${again.ts}`);

const first = await botRepliesTo(both, 1);
const second = await botRepliesTo(again, 1);
const proof = { workspace, channel, people: [juniper, tobias, lark].map(({ id, name }) => ({ id, name })), readAt: new Date().toISOString(), firstKudos: first, secondKudos: second };
writeFileSync(out, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(proof, null, 2));
