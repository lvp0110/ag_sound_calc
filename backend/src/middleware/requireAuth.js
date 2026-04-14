import { verifyAccessToken } from "../utils/tokens.js";

const parseBearerToken = (headerValue) => {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

export const requireAuth = (req, res, next) => {
  const token = parseBearerToken(req.headers.authorization);
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
