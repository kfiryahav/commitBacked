#!/usr/bin/env node
require('dotenv').config();

const { scrapeProductPage } = require('../services/productScraper');
const { analyzeProductForMarketing } = require('../services/creativeAgent');

/*
 * CLI runner for Agent 1 - useful for running the scrape+analyze step
 * on a machine that has open network access (this does NOT need MongoDB,
 * it does not touch app.js/the Express server at all).
 *
 * Usage:
 *   node scripts/analyzeProduct.js <product-url> [--save output.json]
 */

const parseArgs = (argv) => {
    const [url, ...rest] = argv;
    const saveIndex = rest.indexOf('--save');
    const savePath = saveIndex !== -1 ? rest[saveIndex + 1] : null;
    return { url, savePath };
};

const printReport = ({ productData, painPoints, angles }) => {
    console.log('\n=== נתוני מוצר ===');
    console.log(`כותרת: ${productData.title}`);
    if (productData.price) console.log(`מחיר: ${productData.price} ${productData.currency || ''}`);
    if (productData.description) console.log(`תיאור: ${productData.description}`);

    console.log('\n=== נקודות כאב ===');
    painPoints.forEach((p, i) => console.log(`${i + 1}. ${p}`));

    console.log('\n=== 3 זוויות שיווק ===');
    angles.forEach((angle, i) => {
        console.log(`\n--- זווית ${i + 1}: ${angle.name} ---`);
        console.log(`נקודת כאב: ${angle.painPoint}`);
        console.log(`Hook: ${angle.hook}`);
        console.log(`תסריט: ${angle.script}`);
    });
    console.log('');
};

const main = async () => {
    const { url, savePath } = parseArgs(process.argv.slice(2));

    if (!url) {
        console.error('Usage: node scripts/analyzeProduct.js <product-url> [--save output.json]');
        process.exit(1);
    }

    console.log(`קורא את דף המוצר: ${url}`);
    const productData = await scrapeProductPage(url);

    console.log('מנתח נקודות כאב ובונה זוויות שיווק...');
    const marketing = await analyzeProductForMarketing(productData);

    const result = { productData, painPoints: marketing.painPoints, angles: marketing.angles };
    printReport(result);

    if (savePath) {
        const fs = require('fs');
        fs.writeFileSync(savePath, JSON.stringify(result, null, 2), 'utf8');
        console.log(`נשמר ל: ${savePath}`);
    }
};

main().catch((error) => {
    console.error('שגיאה:', error.message);
    process.exit(1);
});
