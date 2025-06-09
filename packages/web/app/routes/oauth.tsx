import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAppSession } from "../session.server";

const oauthFn = createServerFn({ method: "GET" })
  .validator((d: { code: string | undefined; state: string | undefined }) => d)
  .handler(async (ctx) => {
    if (!(ctx.data.code && ctx.data.state)) {
      throw "Missing required oauth query params";
    }
    const session = await useAppSession();
    if (ctx.data.state !== session.id) {
      throw "Bad state";
    }
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: new Headers({
        "content-type": "application/x-www-form-urlencoded",
      }),
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_OAUTH_SECRET!,
        code: ctx.data.code,
        redirect_uri: `${process.env.BASE_URL}/oauth`,
      }).toString(),
    });
    const token_response = await response.json();
    if (!token_response.access_token) {
      throw "Bad token response";
    }
    await session.update({
      oauth_token: {
        token_type: token_response.token_type,
        expires: Date.now() + token_response.expires_in,
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token,
      },
    });
  });

export const Route = createFileRoute("/oauth")({
  validateSearch(search) {
    return {
      code: search.code as string | undefined,
      state: search.state as string | undefined,
    };
  },
  loaderDeps(opts) {
    return {
      code: opts.search.code,
      state: opts.search.state,
    };
  },
  async loader(ctx) {
    await oauthFn({ data: ctx.deps });
    throw redirect({
      to: "/",
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/oauth"!</div>;
}
