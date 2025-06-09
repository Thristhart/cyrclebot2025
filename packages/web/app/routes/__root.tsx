import { doesUserWithDiscordIDExist } from "@cyrclebot/data";
import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import type { ReactNode } from "react";
import { useAppSession } from "../session.server";

interface DiscordUser {
  id: string;
  username: string;
  avatar: string;
  accent_color: number;
  global_name: string;
  banner_color: string;
}

const loadUserDataFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useAppSession();
  if (
    session.data.oauth_token &&
    session.data.oauth_token.expires > Date.now()
  ) {
    const userResult = await fetch("https://discord.com/api/users/@me", {
      headers: {
        authorization: `${session.data.oauth_token.token_type} ${session.data.oauth_token.access_token}`,
      },
    });
    const user = (await userResult.json()) as DiscordUser;
    if (doesUserWithDiscordIDExist(user.id)) {
      return {
        user,
      };
    } else {
      setResponseStatus(403);
      throw "No such user";
    }
  } else {
    throw redirect({
      href: `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${process.env.BASE_URL}/oauth&scope=identify&state=${session.id}&prompt=none`,
    });
  }
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "Cyrclebot",
        },
      ],
    }),
    async beforeLoad(ctx) {
      if (ctx.location.pathname !== "/oauth") {
        return loadUserDataFn();
      }
    },
    component: RootComponent,
  }
);

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
