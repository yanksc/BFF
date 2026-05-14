import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = { userId?: string };

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_PASSWORD ||
    "dev-only-insecure-password-change-me-please-32chars",
  cookieName: "companion_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions);
}

export async function requireUserId(): Promise<string | null> {
  const session = await getSession();
  return session.userId ?? null;
}
