import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = {
  isAdmin?: boolean;
  username?: string;
};

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET environment variable is required and must be at least 32 characters. See .env.example.",
    );
  }
  // Only mark the cookie Secure when the site itself is served over HTTPS.
  // On a fresh VPS before certbot, admins reach /admin over plain HTTP
  // (http://<vps-ip>:8010), and a Secure cookie silently gets dropped by
  // the browser — login "succeeds" on the wire but no session ever sticks,
  // so /admin redirects them right back to /admin/login. Looks like a page
  // refresh doing nothing. By keying off NEXT_PUBLIC_SITE_URL we stay safe
  // once the real domain is wired up (https://jrjr.pl) while letting HTTP
  // setup work too. COOKIE_INSECURE=true forces the non-secure path if you
  // ever need to override (e.g. local dev served from next start).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const secureCookie =
    process.env.COOKIE_INSECURE === "true"
      ? false
      : siteUrl.startsWith("https://");
  return {
    password,
    cookieName: "jrjr_admin_session",
    cookieOptions: {
      secure: secureCookie,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<AdminSession>(cookies(), sessionOptions());
}

export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session.isAdmin) return null;
  return session;
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  if (username.length !== expectedUser.length) return false;
  if (password.length !== expectedPass.length) return false;
  let diff = 0;
  for (let i = 0; i < username.length; i++) {
    diff |= username.charCodeAt(i) ^ expectedUser.charCodeAt(i);
  }
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ expectedPass.charCodeAt(i);
  }
  return diff === 0;
}
