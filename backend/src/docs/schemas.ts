import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi("ErrorResponse");

export const UserSchema = z
  .object({
    id: z.string().uuid(),
    full_name: z.string(),
    phone: z.string().nullable(),
    email: z.string().email(),
    office_address: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("User");

export const AuthSuccessSchema = z
  .object({
    access_token: z.string(),
    user: UserSchema,
  })
  .openapi("AuthSuccess");

export const RegisterRequestSchema = z
  .object({
    full_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    office_address: z.string().optional(),
    password: z.string().min(6),
  })
  .openapi("RegisterRequest");

export const LoginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .openapi("LoginRequest");

export const UpdateMeRequestSchema = z
  .object({
    full_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    office_address: z.string().optional(),
  })
  .openapi("UpdateMeRequest");

export const HealthResponseSchema = z
  .object({
    ok: z.boolean(),
  })
  .openapi("HealthResponse");
