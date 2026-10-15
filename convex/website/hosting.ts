import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpActionGeneric, type GenericActionCtx, type GenericDataModel, type HttpRouter, type PublicHttpAction } from "convex/server";
import { components } from "../_generated/api";

type HttpHandler = (ctx: GenericActionCtx<GenericDataModel>, request: Request) => Promise<Response>;

const slackPictures = ["https://avatars.slack-edge.com", "https://secure.gravatar.com", "https://emoji.slack-edge.com", "https://a.slack-edge.com"].join(" ");
const companyProfileImages = "https://res.cloudinary.com";
const builtAsset = /^\/assets\/[^/]+\.[A-Za-z0-9]+$/;
const immutable = "public, max-age=31536000, immutable";

export function registerWebsite(http: HttpRouter) {
  const withPolicy: Pick<HttpRouter, "route"> = {
    route: (spec) => http.route({ ...spec, handler: withWebsiteHeaders(spec.handler) }),
  };
  registerStaticRoutes(withPolicy as HttpRouter, components.staticHosting);
}

function withWebsiteHeaders(staticFiles: PublicHttpAction) {
  const serve = handlerOf(staticFiles);
  return httpActionGeneric(async (ctx, request) => {
    const response = await serve(ctx, request);
    const headers = new Headers(response.headers);
    if (isHtml(response)) headers.set("Content-Security-Policy", contentSecurityPolicy(process.env.CONVEX_CLOUD_URL));
    else if (isBuiltAsset(request, response)) headers.set("Cache-Control", immutable);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}

function handlerOf(action: PublicHttpAction): HttpHandler {
  const handler = (action as unknown as { _handler?: HttpHandler })._handler;
  if (!handler) throw new Error("The static hosting route has no handler to wrap.");
  return handler;
}

function isBuiltAsset(request: Request, response: Response) {
  const served = response.status === 200 || response.status === 304;
  return served && builtAsset.test(new URL(request.url).pathname);
}

function isHtml(response: Response) {
  return response.headers.get("Content-Type")?.startsWith("text/html") ?? false;
}

export function contentSecurityPolicy(deploymentUrl: string | undefined) {
  const deployment = deploymentUrl ? [deploymentUrl, socketUrlOf(deploymentUrl)] : [];
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `connect-src ${["'self'", ...deployment].join(" ")}`,
    `img-src 'self' ${slackPictures} ${companyProfileImages}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function socketUrlOf(deploymentUrl: string) {
  return deploymentUrl.replace(/^http/, "ws");
}
