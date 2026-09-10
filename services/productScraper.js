const { chromium } = require('playwright');

/*
 * Agent 1 - Product Reader
 * Opens a product page with a real (headless) browser and pulls out the
 * raw data we need for creative generation: title, description, bullet
 * points/specs, price and images.
 *
 * NOTE on AliExpress specifically: the site aggressively fingerprints bots
 * and can show a CAPTCHA/verification wall instead of the product data.
 * For reliable production use you will likely need to add:
 *   - a stealth plugin (e.g. playwright-extra + puppeteer-extra-plugin-stealth)
 *   - a residential/rotating proxy
 *   - retries with backoff
 * This scraper is written defensively (multiple extraction strategies +
 * a clear error when a CAPTCHA wall is detected) so it fails loudly
 * instead of silently returning garbage.
 */

const DEFAULT_TIMEOUT_MS = 30000;

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const looksLikeCaptchaWall = (html) => {
    return /punish|captcha|verify.{0,20}human|slider.{0,20}verify/i.test(html);
};

const extractRunParams = (html) => {
    // AliExpress product pages embed a `window.runParams = {...}` blob with
    // the structured product data used to render the page client-side.
    const match = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        return null;
    }
};

const extractJsonLd = (html) => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const block of blocks) {
        try {
            const parsed = JSON.parse(block[1]);
            if (parsed['@type'] === 'Product' || parsed.name) return parsed;
        } catch (error) {
            // ignore malformed blocks and keep looking
        }
    }
    return null;
};

const extractMeta = (html, property) => {
    const match = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'));
    return match ? match[1] : null;
};

const scrapeProductPage = async (url) => {
    if (!url) throw new Error('url is required');

    // PLAYWRIGHT_EXECUTABLE_PATH lets you point at a specific Chromium build
    // (e.g. one already pre-installed on the host) instead of the one
    // Playwright would normally auto-download for the installed npm version.
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    });

    try {
        const context = await browser.newContext({
            locale: 'he-IL',
            userAgent: USER_AGENT,
            viewport: { width: 1366, height: 900 },
        });

        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS });

        // Give client-side rendered content (price, bullet points, gallery) a
        // moment to settle before we read the DOM.
        await page.waitForTimeout(2500);

        const html = await page.content();

        if (looksLikeCaptchaWall(html)) {
            throw new Error(
                'AliExpress returned a verification/CAPTCHA wall instead of the product page. ' +
                'Retry with a stealth browser context and/or a residential proxy.'
            );
        }

        const runParams = extractRunParams(html);
        const jsonLd = extractJsonLd(html);

        const title =
            runParams?.data?.pageModule?.title ||
            jsonLd?.name ||
            extractMeta(html, 'og:title') ||
            (await page.title());

        const description =
            runParams?.data?.descriptionModule?.description ||
            jsonLd?.description ||
            extractMeta(html, 'og:description') ||
            null;

        const images =
            runParams?.data?.imageModule?.imagePathList ||
            (jsonLd?.image ? [].concat(jsonLd.image) : []) ||
            [extractMeta(html, 'og:image')].filter(Boolean);

        const priceInfo = runParams?.data?.priceModule || null;
        const price = priceInfo?.formatedActivityPrice || priceInfo?.formatedPrice || jsonLd?.offers?.price || null;
        const currency = priceInfo?.currencyCode || jsonLd?.offers?.priceCurrency || null;

        const bulletPoints =
            runParams?.data?.specsModule?.props?.map((p) => `${p.attrName}: ${p.attrValue}`) || [];

        const ratingValue =
            runParams?.data?.titleModule?.feedbackRating?.averageStar ||
            jsonLd?.aggregateRating?.ratingValue ||
            null;

        const reviewsCount =
            runParams?.data?.titleModule?.feedbackRating?.totalValidNum ||
            jsonLd?.aggregateRating?.reviewCount ||
            null;

        return {
            url,
            title: title ? title.trim() : null,
            description,
            bulletPoints,
            price,
            currency,
            images,
            ratingValue,
            reviewsCount,
            scrapedAt: new Date().toISOString(),
        };
    } finally {
        await browser.close();
    }
};

module.exports = { scrapeProductPage };
