import { httpRouter } from "convex/server";
import { slackEvents } from "./slack/events";

const http = httpRouter();

http.route({ path: "/slack/events", method: "POST", handler: slackEvents });

export default http;
