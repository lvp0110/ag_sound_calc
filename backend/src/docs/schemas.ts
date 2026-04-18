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

export const ServiceSchema = z
  .object({
    name: z.string(),
    price: z.number(),
    count: z.number(),
    unit: z.string(),
  })
  .openapi("Service");

export const OfferFormSchema = z
  .object({
    title: z.string().nullish(),
    manager_name: z.string().nullish(),
    phone: z.string().nullish(),
    email: z.string().nullish(),
    office_address: z.string().nullish(),
    kp_date: z.string().nullish(),
    object_name: z.string().nullish(),
    logo_url: z.string().nullish(),
    region: z.string().nullish(),
    markup_percent: z.number().nullish(),
    discount_percent: z.number().nullish(),
  })
  .openapi("OfferForm");

export const OfferConstructionInputSchema = z
  .object({
    calc_params: CalcParamsSchema,
    materials: z.array(CalcMaterialSchema).nullish(),
    montage: z.array(ServiceSchema).nullish(),
  })
  .openapi("OfferConstructionInput");

export const OfferDraftSchema = z
  .object({
    constructions: z.array(OfferConstructionInputSchema).min(1),
    services: z.array(ServiceSchema).optional(),
  })
  .openapi("OfferDraft");

export const CreateOfferRequestSchema = z
  .object({
    form: OfferFormSchema.optional(),
    offerDraft: OfferDraftSchema,
  })
  .openapi("CreateOfferRequest");

export const UpdateOfferRequestSchema = z
  .object({
    form: OfferFormSchema.optional(),
    services: z.array(ServiceSchema).optional(),
    constructions: z.array(OfferConstructionInputSchema).optional(),
    total_cost: z.number().optional(),
  })
  .openapi("UpdateOfferRequest");

export const OfferConstructionSchema = z
  .object({
    id: z.string().uuid(),
    position: z.number().int(),
    calc_params: CalcParamsSchema,
    materials: z.array(CalcMaterialSchema),
    montage: z.array(ServiceSchema).nullable(),
  })
  .openapi("OfferConstruction");

export const OfferSummarySchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().nullable(),
    object_name: z.string().nullable(),
    region: z.string().nullable(),
    kp_date: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("OfferSummary");

export const OfferSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string().nullable(),
    manager_name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    office_address: z.string().nullable(),
    kp_date: z.string().nullable(),
    object_name: z.string().nullable(),
    logo_url: z.string().nullable(),
    region: z.string().nullable(),
    markup_percent: z.number().nullable(),
    discount_percent: z.number().nullable(),
    services: z.array(ServiceSchema).nullable(),
    constructions: z.array(OfferConstructionSchema),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("Offer");

export const CloneOfferResponseSchema = z
  .object({
    id: z.string().uuid(),
  })
  .openapi("CloneOfferResponse");
