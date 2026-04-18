import { type NextFunction, type Request, type Response } from "express";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "../utils/tokens.js";

export const requireAuth = (req: Request, res: Response, next: NextFunction): Response | void => {
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
