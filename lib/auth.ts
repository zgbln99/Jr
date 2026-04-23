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
  return {
    password,
    cookieName: "jrjr_admin_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
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
