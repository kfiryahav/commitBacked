const Anthropic = require('@anthropic-ai/sdk');

/*
 * Agent 1 - Pain Point & Marketing Angle Generator
 * Takes the raw data pulled off a product page (see productScraper.js) and
 * turns it into: the deepest pain points the product solves, plus 3 distinct
 * marketing angles in Hebrew, each built around one pain point.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `אתה קופירייטר ואסטרטג שיווק דיגיטלי בכיר, מומחה בפרסום מוצרים בפייסבוק/טיקטוק/אינסטגרם עבור קהל ישראלי.
אתה מקבל נתונים גולמיים שנשלפו מדף מוצר (כותרת, תיאור, מפרט, מחיר).
המשימה שלך:
1. לזהות את 3-5 נקודות הכאב (Pain Points) האמיתיות והעמוקות ביותר שהמוצר פותר ללקוח - לא תכונות, אלא רגש/בעיה אמיתית בחיים.
2. לבחור את 3 נקודות הכאב החזקות ביותר מביניהן ולבנות סביב כל אחת "זווית שיווק" (Angle) נפרדת ומובחנת.

לכל זווית ספק:
- name: שם קצר לזווית (2-4 מילים)
- painPoint: נקודת הכאב עליה הזווית מתבססת
- hook: משפט פתיחה (Hook) חד וסקרן, עד 15 מילים, שנועד לעצור את הגלילה
- script: תסריט קצר בעברית (40-70 מילים), כתוב כמו שיידובר בווידאו (טון ישיר, מדבר אל "אתה/את"), שמפתח את נקודת הכאב ומוביל לפתרון שהמוצר נותן. אל תמציא נתונים/מספרים שלא ניתנו לך.

השב אך ורק ב-JSON תקני (בלי טקסט מסביב, בלי Markdown fences), במבנה הבא:
{
  "painPoints": ["...", "..."],
  "angles": [
    { "name": "...", "painPoint": "...", "hook": "...", "script": "..." },
    { "name": "...", "painPoint": "...", "hook": "...", "script": "..." },
    { "name": "...", "painPoint": "...", "hook": "...", "script": "..." }
  ]
}`;

const buildUserPrompt = (productData) => {
    const { title, description, bulletPoints, price, currency, ratingValue, reviewsCount } = productData;

    return [
        `כותרת המוצר: ${title || 'לא ידוע'}`,
        description ? `תיאור: ${description}` : null,
        bulletPoints?.length ? `מפרט/בולטים:\n${bulletPoints.join('\n')}` : null,
        price ? `מחיר: ${price} ${currency || ''}` : null,
        ratingValue ? `דירוג: ${ratingValue} (${reviewsCount || 0} ביקורות)` : null,
    ]
        .filter(Boolean)
        .join('\n\n');
};

const parseJsonResponse = (text) => {
    // Defensive parsing in case the model wraps the JSON in fences or prose
    // despite the instruction not to.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in model response');
    return JSON.parse(jsonMatch[0]);
};

const analyzeProductForMarketing = async (productData) => {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(productData) }],
    });

    const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

    const parsed = parseJsonResponse(text);

    if (!Array.isArray(parsed.angles) || parsed.angles.length !== 3) {
        throw new Error('Model did not return exactly 3 marketing angles');
    }

    return parsed;
};

module.exports = { analyzeProductForMarketing };
