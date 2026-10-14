import { avery, casey, edit, eventsSent, privateChannel, remove } from "./slackEvents.mts";

const [editTs, deleteTs] = [process.env.KUDOS_EDIT_TS, process.env.KUDOS_DELETE_TS];
if (!editTs || !deleteTs) throw new Error("KUDOS_EDIT_TS and KUDOS_DELETE_TS name two of Casey's private kudos to Avery");

await edit({ from: casey, to: [avery], channel: privateChannel, ts: editTs }, "quietly, for turning a vague ticket into three crisp ones, and for the handover doc");
await remove({ from: casey, channel: privateChannel, ts: deleteTs, to: [avery] });

console.log(JSON.stringify({ eventsSent: eventsSent(), edited: editTs, deleted: deleteTs }));
