import puppeteer, { type Browser } from "puppeteer";
import { buildTitleByCode } from "./catalogData.js";
import { buildPriceLookup } from "./priceData.js";
import {
  KP_FOOTER_TEMPLATE,
  KP_HEADER_TEMPLATE,
  renderOfferKpHtml,
  type OfferForRender,
} from "../templates/offerKp.js";

/**
 * Singleton Puppeteer-браузер на процесс backend'а. Запуск Chromium —
 * самая дорогая операция (200-500ms холодный старт), на каждой генерации
 * PDF делать заново не имеет смысла. Закрываем на SIGTERM / SIGINT.
 */

let browserPromise: Promise<Browser> | null = null;
let shutdownHooksInstalled = false;

const installShutdownHooks = () => {
  if (shutdownHooksInstalled) return;
  shutdownHooksInstalled = true;
  const close = () => {
    void closeBrowser();
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
};

const getBrowser = async (): Promise<Browser> => {
  if (browserPromise) return browserPromise;
  installShutdownHooks();
  browserPromise = puppeteer
    .launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });
  return browserPromise;
};

export const closeBrowser = async (): Promise<void> => {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // ignore — процесс завершается
  } finally {
    browserPromise = null;
  }
};

export class OfferPdfError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OfferPdfError";
  }
}

/**
 * Генерирует PDF-байты КП для уже загруженного оффер-DTO. Подгружает
 * каталог конструкций и прайс из внешнего calc-сервиса (через общий
 * upstreamCache — повторные запросы не бьют по dev3).
 */
export const renderOfferPdf = async (offer: OfferForRender): Promise<Buffer> => {
  const [catalog, priceLookup] = await Promise.all([
    buildTitleByCode().catch(() => new Map()),
    buildPriceLookup(offer.region).catch(() => (() => ({}))),
  ]);

  const html = renderOfferKpHtml({ offer, priceLookup, catalog });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "25mm", bottom: "32mm", left: "28mm", right: "28mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: KP_HEADER_TEMPLATE,
      footerTemplate: KP_FOOTER_TEMPLATE,
    });
    return Buffer.from(pdf);
  } catch (err) {
    throw new OfferPdfError(
      err instanceof Error ? `Puppeteer failed: ${err.message}` : "Puppeteer failed",
      err
    );
  } finally {
    await page.close().catch(() => {
      // ignore
    });
  }
};
