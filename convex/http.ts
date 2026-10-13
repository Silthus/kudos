import { httpRouter } from "convex/server";
import { slackCommands } from "./slack/commands";
import { slackEvents } from "./slack/events";
import { slackInteractivity } from "./slack/interactivity";

const http = httpRouter();

http.route({ path: "/slack/events", method: "POST", handler: slackEvents });
http.route({ path: "/slack/commands", method: "POST", handler: slackCommands });
http.route({ path: "/slack/interactivity", method: "POST", handler: slackInteractivity });

export default http;
