import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";
import { auth } from "./auth";
import { slackCommands } from "./slack/commands";
import { slackEvents } from "./slack/events";

const http = httpRouter();

http.route({ path: "/slack/events", method: "POST", handler: slackEvents });
http.route({ path: "/slack/commands", method: "POST", handler: slackCommands });
auth.addHttpRoutes(http);
registerStaticRoutes(http, components.staticHosting);

export default http;
