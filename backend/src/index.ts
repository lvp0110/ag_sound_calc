import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiSpec } from "./docs/swagger.js";
import { prisma } from "./lib/prisma.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/api/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(env.port, () => {
  console.log(`Backend API listening on port ${env.port}`);
});

const shutdown = async (): Promise<void> => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
