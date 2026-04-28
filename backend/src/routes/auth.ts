import bcrypt from "bcrypt";
import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  ACCESS_COOKIE_NAME,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";
import { toUserDto } from "../utils/userDto.js";

const SALT_ROUNDS = 10;
const router = Router();

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
const asyncHandler = (handler: AsyncRouteHandler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const issueTokens = (userId: string) => {
  const payload = { userId };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
) => {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions());
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE_NAME, getAccessCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
};
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { full_name, email, phone, office_address, password } = req.body ?? {};
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "full_name, email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        fullName: String(full_name).trim(),
        email: normalizedEmail,
        phone: phone ? String(phone).trim() : null,
        officeAddress: office_address ? String(office_address).trim() : null,
        passwordHash,
      },
    });

    const tokens = issueTokens(user.id);
    setAuthCookies(res, tokens);
    return res.status(201).json({ user: toUserDto(user) });
  })
);
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(String(password), user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const tokens = issueTokens(user.id);
    setAuthCookies(res, tokens);
    return res.json({ user: toUserDto(user) });
  })
);
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token is missing" });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const tokens = issueTokens(user.id);
      setAuthCookies(res, tokens);
      return res.json({ user: toUserDto(user) });
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  })
);
router.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  return res.status(204).send();
});

export default router;
