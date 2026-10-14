import { issuer, MockSlackIssuer } from "./mockSlackIssuer.ts";

await new MockSlackIssuer().start();
console.log(`mock Slack issuer listening on ${issuer}`);
