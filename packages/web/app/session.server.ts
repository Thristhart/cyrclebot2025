import { useSession } from "@tanstack/react-start/server";
import assert from "node:assert";

type SessionUser = {
  oauth_token?: {
    access_token: string;
    expires: number;
    refresh_token: string;
    token_type: string;
  };
  redirectUrl?: string;
};

export function useAppSession() {
  assert(
    process.env.SESSION_SECRET,
    "Must specify SESSION_SECRET env variable"
  );
  const password = process.env.SESSION_SECRET;
  return useSession<SessionUser>({
    password,
  });
}
