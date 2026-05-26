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
 *
 * Chromium иногда падает (Connection closed) — тогда сбрасываем singleton
 * и при следующем запросе поднимаем браузер заново.
 */

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
let shutdownHooksInstalled = false;

const resetBrowserState = (): void => {
  browserInstance = null;
  browserLaunchPromise = null;
};

const isBrowserConnectionError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "ConnectionClosedError" ||
    msg.includes("connection closed") ||
    msg.includes("target closed") ||
    msg.includes("session closed") ||
    msg.includes("browser has disconnected")
  );
};

const installShutdownHooks = () => {
  if (shutdownHooksInstalled) return;
  shutdownHooksInstalled = true;
  const close = () => {
    void closeBrowser();
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
};

const launchBrowser = async (): Promise<Browser> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });
  browserInstance = browser;
  browser.on("disconnected", () => {
    if (browserInstance === browser) {
      resetBrowserState();
    }
  });
  return browser;
};

const getBrowser = async (): Promise<Browser> => {
  if (browserInstance?.connected) return browserInstance;

  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {
      // ignore — процесс уже мог завершиться
    }
    resetBrowserState();
  }

  if (!browserLaunchPromise) {
    installShutdownHooks();
    browserLaunchPromise = launchBrowser().catch((err) => {
      resetBrowserState();
      throw err;
    });
  }

  return browserLaunchPromise;
};

export const closeBrowser = async (): Promise<void> => {
  const browser = browserInstance;
  resetBrowserState();
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    // ignore — процесс завершается
  }
};

export class OfferPdfError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OfferPdfError";
  }
}

const renderPdfFromHtml = async (html: string): Promise<Buffer> => {
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
  } finally {
    await page.close().catch(() => {
      // ignore
    });
  }
};

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

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await renderPdfFromHtml(html);
    } catch (err) {
      lastError = err;
      if (attempt === 0 && isBrowserConnectionError(err)) {
        await closeBrowser();
        continue;
      }
      break;
    }
  }

  throw new OfferPdfError(
    lastError instanceof Error
      ? `Puppeteer failed: ${lastError.message}`
      : "Puppeteer failed",
    lastError
  );
};
