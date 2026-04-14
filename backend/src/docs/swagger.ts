import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { env } from "../config/env.js";
import {
  AuthSuccessSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  UpdateMeRequestSchema,
  UserSchema,
} from "./schemas.js";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Register user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "User created",
      content: {
        "application/json": {
          schema: AuthSuccessSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "User already exists",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Login user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Successful login",
      content: { "application/json": { schema: AuthSuccessSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh access token",
  responses: {
    200: {
      description: "New tokens issued",
      content: { "application/json": { schema: AuthSuccessSchema } },
    },
    401: {
      description: "Refresh token invalid or missing",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Logout user",
  responses: {
    204: {
      description: "Logged out",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/users/me",
  tags: ["Users"],
  summary: "Get current user",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Current user profile",
      content: { "application/json": { schema: UserSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/users/me",
  tags: ["Users"],
  summary: "Update current user",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateMeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated user profile",
      content: { "application/json": { schema: UserSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Duplicate email",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
export const openApiSpec = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "ag_sound_calc Backend API",
    version: "1.0.0",
    description: "API for authentication and offer management",
  },
  servers: [{ url: `http://localhost:${env.port}` }],
});
