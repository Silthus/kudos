import { httpRouter } from "convex/server";
import { slackCommands } from "./slack/commands";
import { slackEvents } from "./slack/events";

const http = httpRouter();

http.route({ path: "/slack/events", method: "POST", handler: slackEvents });
http.route({ path: "/slack/commands", method: "POST", handler: slackCommands });

export default http;
