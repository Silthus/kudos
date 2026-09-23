import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// The static site and our own routes (Slack webhooks, auth) share the
// deployment's .convex.site origin; http.ts registers exact routes first.
const app = defineApp();
app.use(staticHosting);

export default app;
