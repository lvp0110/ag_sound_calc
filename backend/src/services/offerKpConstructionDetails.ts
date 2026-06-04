import type { ConstructionCatalogEntry } from "./catalogData.js";
import { loadCompositionMaterialNames } from "./constructionComposition.js";
import {
  constructionKpCardHeading,
  constructionTypeFromCalcParams,
  resolveDisplayCipher,
  shouldOmitConstructionInfoInPdf,
} from "../utils/constructionKpDisplay.js";
import { resolveConstrImageFetchUrl } from "../utils/constrImageUrl.js";
import { fetchImageAsDataUri } from "../utils/fetchImageDataUri.js";
import { zipsCeilingCadFilename } from "../utils/zipsCeilingCad.js";
import type { OfferForRender } from "../templates/offerKp.js";

const esc = (s: unknown): string => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const specRow = (label: string, value: string): string => {
  if (!value.trim()) return "";
  return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
};

const resolveCadImageRef = (
  cipher: string,
  entry: ConstructionCatalogEntry | undefined,
  calcParams: Record<string, unknown> | null
): string | null => {
  const sectionType = constructionTypeFromCalcParams(calcParams);
  if (sectionType === "ПОТОЛОК") {
    const zips = zipsCeilingCadFilename(cipher);
    if (zips) return zips;
  }
  return entry?.cadImg ?? null;
};

type ConstructionBlockInput = {
  heading: string;
  cipher: string;
  entry: ConstructionCatalogEntry | undefined;
  calcParams: Record<string, unknown> | null;
  composition: string[];
};

const buildOneConstructionBlock = async (input: ConstructionBlockInput): Promise<string> => {
  const { heading, cipher, entry, calcParams, composition } = input;
  const specification = entry?.specification?.trim() ?? "";

  const specsHtml = [
    specRow("Шифр конструкции", cipher),
    specRow("Толщина, мм", entry?.thickness ?? ""),
    specRow("Индекс звукоизоляции воздушного шума, Rw", entry?.soundIndex ?? ""),
    entry?.impactNoiseIndex != null
      ? specRow("Индекс звукоизоляции ударного шума, Lnw", String(entry.impactNoiseIndex))
      : "",
    specRow("Характеристики и применение", specification),
  ]
    .filter(Boolean)
    .join("");

  const compositionHtml =
    composition.length > 0
      ? `<h4 class="construction-info__subtitle">Состав конструкции</h4><ul class="construction-info__composition">${composition
          .map((name) => `<li>${esc(name)}</li>`)
          .join("")}</ul>`
      : "";

  const imgRef = entry?.img ?? null;
  const cadRef = resolveCadImageRef(cipher, entry, calcParams);

  const previewUrl = imgRef ? resolveConstrImageFetchUrl(imgRef) : null;
  const cadUrl = cadRef ? resolveConstrImageFetchUrl(cadRef) : null;
  const [previewUri, cadUri] = await Promise.all([
    previewUrl ? fetchImageAsDataUri(previewUrl) : null,
    cadUrl ? fetchImageAsDataUri(cadUrl) : null,
  ]);

  const figure = (uri: string | null, caption: string): string => {
    if (!uri) return "";
    return `<figure class="construction-info__figure"><img src="${uri}" alt="${esc(caption)}" /><figcaption>${esc(caption)}</figcaption></figure>`;
  };

  const imagesHtml = [figure(previewUri, "Изображение"), figure(cadUri, "Чертёж")]
    .filter(Boolean)
    .join("");

  const hasSpecs = specsHtml.length > 0;
  const hasBody = hasSpecs || compositionHtml || imagesHtml;
  if (!hasBody) return "";

  return `
  <section class="construction-info">
    <h3 class="construction-info__heading">${esc(heading)}</h3>
    <div class="construction-info__layout">
      <div class="construction-info__text">
        ${hasSpecs ? `<table class="construction-info__specs"><tbody>${specsHtml}</tbody></table>` : ""}
        ${compositionHtml}
      </div>
      ${imagesHtml ? `<div class="construction-info__images">${imagesHtml}</div>` : ""}
    </div>
  </section>`;
};

/**
 * HTML-блок «Информация о конструкциях» для PDF (характеристики, состав, фото, чертёж).
 */
export const buildConstructionDetailsHtml = async (
  offer: OfferForRender,
  catalog: Map<string, ConstructionCatalogEntry>
): Promise<string> => {
  const constructions = [...(offer.constructions || [])].sort((a, b) => a.position - b.position);
  if (constructions.length === 0) return "";

  const cipherById = new Map<string, string>();
  const uniqueCiphers = new Set<string>();
  for (const c of constructions) {
    if (shouldOmitConstructionInfoInPdf(c.calc_params, catalog)) continue;
    const calcCode =
      typeof c.calc_params?.Code === "string" ? c.calc_params.Code.trim() : "";
    const cipher = resolveDisplayCipher(calcCode, catalog);
    if (cipher) {
      cipherById.set(c.id, cipher);
      uniqueCiphers.add(cipher);
    }
  }

  const compositionByCipher = new Map<string, string[]>();
  await Promise.all(
    [...uniqueCiphers].map(async (cipher) => {
      const list = await loadCompositionMaterialNames(cipher);
      compositionByCipher.set(cipher, list);
    })
  );

  const blocks = await Promise.all(
    constructions.map(async (c) => {
      if (shouldOmitConstructionInfoInPdf(c.calc_params, catalog)) return "";
      const cipher = cipherById.get(c.id) ?? "";
      const entry = cipher ? catalog.get(cipher) : undefined;
      const heading = constructionKpCardHeading(c.calc_params, catalog);
      return buildOneConstructionBlock({
        heading,
        cipher,
        entry,
        calcParams: c.calc_params,
        composition: cipher ? compositionByCipher.get(cipher) ?? [] : [],
      });
    })
  );

  const inner = blocks.filter(Boolean).join("");
  if (!inner) return "";

  return `<div class="construction-info-wrap"><div class="construction-info-wrap__rules" aria-hidden="true"><hr /><hr /></div><h2 class="construction-info-wrap__title">Информация о конструкциях</h2>${inner}</div>`;
};
