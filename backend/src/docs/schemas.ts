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

export const CalcOpeningSchema = z
  .object({
    lenX: z.number(),
    lenZ: z.number(),
    Type: z.string(),
  })
  .openapi("CalcOpening");

export const CalcParamsSchema = z
  .object({
    Code: z.string(),
    LenX: z.number(),
    LenY: z.number(),
    LenZ: z.number(),
    AddCeilShift: z.number(),
    step: z.number(),
    dframe: z.boolean(),
    Area: z.number(),
    Perimeter: z.number(),
    Openings: z.array(CalcOpeningSchema),
  })
  .openapi("CalcParams");

export const CalcMaterialSchema = z
  .object({
    articul: z.string().optional(),
    name: z.string(),
    count: z.number(),
    unit: z.string(),
    pricePerSquareMeter: z.number().optional(),
    pricePerUnit: z.number().optional(),
  })
  .openapi("CalcMaterial");

export const CalcByProductRequestSchema = z
  .array(CalcParamsSchema)
  .openapi("CalcByProductRequest");

export const CalcByProductResponseSchema = z
  .object({
    code: z.number().optional(),
    data: z.array(z.array(CalcMaterialSchema)).optional(),
  })
  .passthrough()
  .openapi("CalcByProductResponse");

export const IsolationConstructionSchema = z
  .object({
    Code: z.string(),
    Name: z.string().optional(),
    Description: z.string().optional(),
    Img: z.string().optional(),
  })
  .passthrough()
  .openapi("IsolationConstruction");

export const AllIsolationConstrResponseSchema = z
  .object({
    code: z.number().optional(),
    data: z.array(IsolationConstructionSchema).optional(),
  })
  .passthrough()
  .openapi("AllIsolationConstrResponse");

export const IsolationConstrMaterialsResponseSchema = z
  .object({
    code: z.number().optional(),
    data: z.unknown().optional(),
  })
  .passthrough()
  .openapi("IsolationConstrMaterialsResponse");

export const ConstructionPropsResponseSchema = z
  .object({
    code: z.number().optional(),
    data: z.unknown().optional(),
  })
  .passthrough()
  .openapi("ConstructionPropsResponse");
