const { scrapeProductPage } = require('../services/productScraper');
const { analyzeProductForMarketing } = require('../services/creativeAgent');

/* POST /creative/analyzeProduct - Agent 1: read a product page, return pain points + 3 marketing angles */
const analyzeProduct = async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'url is required in the request body' });
    }

    try {
        const productData = await scrapeProductPage(url);
        const marketing = await analyzeProductForMarketing(productData);

        res.json({
            productData,
            painPoints: marketing.painPoints,
            angles: marketing.angles,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    analyzeProduct,
};
