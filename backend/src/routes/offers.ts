import type { Offer, OfferConstruction, Prisma } from "@prisma/client";
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import {
  CreateOfferRequestSchema,
  UpdateOfferRequestSchema,
} from "../docs/schemas.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { CalcServiceError, calculateByProduct } from "../services/calcService.js";
import { recalcConstructionsMaterials } from "../services/offerRecalc.js";

const router = Router();

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<Response | void>;
const asyncHandler =
  (handler: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);

router.use(requireAuth);

// ─── helpers ────────────────────────────────────────────────────────────────

const decimalToNumber = (v: Prisma.Decimal | null): number | null =>
  v === null || v === undefined ? null : Number(v.toString());

const toForm = (parsed: z.infer<typeof CreateOfferRequestSchema>["form"]) => {
  const form = parsed ?? {};
  return {
    title: form.title ?? null,
    managerName: form.manager_name ?? null,
    phone: form.phone ?? null,
    email: form.email ?? null,
    officeAddress: form.office_address ?? null,
    kpDate: form.kp_date ?? null,
    objectName: form.object_name ?? null,
    logoUrl: form.logo_url ?? null,
    region: form.region ?? null,
    markupPercent: form.markup_percent ?? null,
    discountPercent: form.discount_percent ?? null,
  };
};

const toOfferSummary = (offer: Offer) => ({
  id: offer.id,
  title: offer.title,
  object_name: offer.objectName,
  region: offer.region,
  kp_date: offer.kpDate,
  created_at: offer.createdAt.toISOString(),
  updated_at: offer.updatedAt.toISOString(),
});

interface ConstructionForDto {
  id: string;
  position: number;
  calcParams: unknown;
  materials: unknown;
  montage: unknown;
}

const toOfferDto = (offer: Offer, constructions: ConstructionForDto[]) => ({
  id: offer.id,
  user_id: offer.userId,
  title: offer.title,
  manager_name: offer.managerName,
  phone: offer.phone,
  email: offer.email,
  office_address: offer.officeAddress,
  kp_date: offer.kpDate,
  object_name: offer.objectName,
  logo_url: offer.logoUrl,
  region: offer.region,
  markup_percent: decimalToNumber(offer.markupPercent),
  discount_percent: decimalToNumber(offer.discountPercent),
  services: offer.services ?? null,
  constructions: constructions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      position: c.position,
      calc_params: c.calcParams,
      materials: c.materials ?? [],
      montage: c.montage ?? null,
    })),
  created_at: offer.createdAt.toISOString(),
  updated_at: offer.updatedAt.toISOString(),
});

// ─── routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/offers
 * Создаёт оффер + конструкции. Один раз вызывает внешний calc для инициализации materials.
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = CreateOfferRequestSchema.parse(req.body ?? {});
    const form = toForm(parsed.form);
    const constructionInputs = parsed.offerDraft.constructions;

    // Свежий расчёт материалов по всем конструкциям одним запросом.
    const calcParamsList = constructionInputs.map((c) => c.calc_params);
    const freshMaterials = await calculateByProduct(calcParamsList);

    const created = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          userId,
          ...form,
          services: (parsed.offerDraft.services ?? []) as unknown as Prisma.InputJsonValue,
        },
      });

      const constructions = await Promise.all(
        constructionInputs.map((c, index) =>
          tx.offerConstruction.create({
            data: {
              offerId: offer.id,
              position: index,
              calcParams: c.calc_params as unknown as Prisma.InputJsonValue,
              materials: (freshMaterials[index] ?? []) as unknown as Prisma.InputJsonValue,
              montage: (c.montage ?? []) as unknown as Prisma.InputJsonValue,
            },
          })
        )
      );

      return { offer, constructions };
    });

    return res.status(201).json(toOfferDto(created.offer, created.constructions));
  })
);

/**
 * GET /api/offers — список офферов текущего пользователя (только метаданные).
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const offers = await prisma.offer.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(offers.map(toOfferSummary));
  })
);

/**
 * GET /api/offers/:id — загрузить оффер, пересчитать материалы, наложить override.
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const offer = await prisma.offer.findFirst({
      where: { id: req.params.id, userId },
      include: { constructions: true },
    });
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    const recalc = await recalcConstructionsMaterials(
      offer.constructions.map((c) => ({
        id: c.id,
        position: c.position,
        calcParams: c.calcParams,
        materials: c.materials,
      }))
    );
    const materialsById = new Map(recalc.map((r) => [r.id, r.materials]));

    const constructionsWithFreshMaterials = offer.constructions.map((c) => ({
      ...c,
      materials: (materialsById.get(c.id) ?? c.materials ?? []) as unknown,
    }));

    return res.json(toOfferDto(offer, constructionsWithFreshMaterials));
  })
);

/**
 * PATCH /api/offers/:id — сохранить правки формы, services, constructions.
 * Конструкции перезаписываются полностью (по плану: удалить старые и пересоздать).
 * total_cost принимается для совместимости и игнорируется (не хранится в БД).
 */
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = UpdateOfferRequestSchema.parse(req.body ?? {});

    const existing = await prisma.offer.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Offer not found" });

    const formData = parsed.form ? toForm(parsed.form) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.update({
        where: { id: existing.id },
        data: {
          ...formData,
          ...(parsed.services !== undefined
            ? { services: parsed.services as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });

      let constructions: OfferConstruction[];
      if (parsed.constructions !== undefined) {
        await tx.offerConstruction.deleteMany({ where: { offerId: offer.id } });
        constructions = await Promise.all(
          parsed.constructions.map((c, index) =>
            tx.offerConstruction.create({
              data: {
                offerId: offer.id,
                position: index,
                calcParams: c.calc_params as unknown as Prisma.InputJsonValue,
                materials: (c.materials ?? []) as unknown as Prisma.InputJsonValue,
                montage: (c.montage ?? []) as unknown as Prisma.InputJsonValue,
              },
            })
          )
        );
      } else {
        constructions = await tx.offerConstruction.findMany({
          where: { offerId: offer.id },
        });
      }

      return { offer, constructions };
    });

    return res.json(toOfferDto(updated.offer, updated.constructions));
  })
);

/**
 * POST /api/offers/:id/clone — глубокое копирование, возвращает { id } нового оффера.
 */
router.post(
  "/:id/clone",
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const source = await prisma.offer.findFirst({
      where: { id: req.params.id, userId },
      include: { constructions: true },
    });
    if (!source) return res.status(404).json({ error: "Offer not found" });

    const newOffer = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          userId,
          title: source.title,
          managerName: source.managerName,
          phone: source.phone,
          email: source.email,
          officeAddress: source.officeAddress,
          kpDate: source.kpDate,
          objectName: source.objectName,
          logoUrl: source.logoUrl,
          region: source.region,
          markupPercent: source.markupPercent,
          discountPercent: source.discountPercent,
          services: (source.services ?? []) as unknown as Prisma.InputJsonValue,
        },
      });

      await Promise.all(
        source.constructions
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((c, index) =>
            tx.offerConstruction.create({
              data: {
                offerId: offer.id,
                position: index,
                calcParams: c.calcParams as unknown as Prisma.InputJsonValue,
                materials: (c.materials ?? []) as unknown as Prisma.InputJsonValue,
                montage: (c.montage ?? []) as unknown as Prisma.InputJsonValue,
              },
            })
          )
      );

      return offer;
    });

    return res.status(201).json({ id: newOffer.id });
  })
);

// ─── error handler (local to this router) ───────────────────────────────────

router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
  }
  if (err instanceof CalcServiceError) {
    const status = err.status && err.status >= 500 ? 502 : 502;
    return res.status(status).json({ error: err.message });
  }
  return next(err);
});

export default router;
