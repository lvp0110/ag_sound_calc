import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.accessTokenSecret, { expiresIn: env.accessTokenExpiresIn });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.refreshTokenSecret, { expiresIn: env.refreshTokenExpiresIn });

export const verifyAccessToken = (token) => jwt.verify(token, env.accessTokenSecret);

export const verifyRefreshToken = (token) => jwt.verify(token, env.refreshTokenSecret);

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 1000 * 60 * 60 * 24 * 30,
});
