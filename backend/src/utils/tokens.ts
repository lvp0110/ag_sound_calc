import { type CookieOptions } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

type JwtPayload = {
  userId: string;
};

export const REFRESH_COOKIE_NAME = "refreshToken";

export const signAccessToken = (payload: JwtPayload): string => {
  const options: SignOptions = { expiresIn: env.accessTokenExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.accessTokenSecret, options);
};

export const signRefreshToken = (payload: JwtPayload): string => {
  const options: SignOptions = { expiresIn: env.refreshTokenExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.refreshTokenSecret, options);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.accessTokenSecret);
  if (typeof decoded === "string" || !("userId" in decoded)) {
    throw new Error("Invalid token payload");
  }
  return { userId: String(decoded.userId) };
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.refreshTokenSecret);
  if (typeof decoded === "string" || !("userId" in decoded)) {
    throw new Error("Invalid token payload");
  }
  return { userId: String(decoded.userId) };
};

export const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 1000 * 60 * 60 * 24 * 30,
});
