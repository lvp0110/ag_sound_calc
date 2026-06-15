import { type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "../utils/tokens.js";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).userId;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Блокировка действует мгновенно: проверяем флаг на каждом запросе.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBlocked: true },
  });
  if (!user || user.isBlocked) {
    return res.status(403).json({ error: "Account is blocked" });
  }

  req.auth = { userId };
  return next();
};
