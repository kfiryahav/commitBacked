# Higgsfield API — מה למדנו (נבדק ב-9.11.2026)

- **כתובת:** `https://platform.higgsfield.ai`. המפתח נשמר כ-Network secret בסביבה ומוזרק אוטומטית
  (`Authorization: Key KEY_ID:SECRET`). אף פעם לא לכתוב אותו בקוד או בצ'אט.
- **רשימת מודלים:** `GET /models`. ב-API אין GPT Image. GPT Image זמין רק דרך האפליקציה וה-MCP.
- **יצירה:** `POST /<model-slug>` עם JSON. מחזיר `request_id`.
- **סטטוס:** `GET https://platform.higgsfield.ai/requests/<id>/status`.
  ה-`status_url` שהתשובה מחזירה מצביע על `api.higgsfield.ai`, אבל המפתח שמור רק ל-platform.
  סטטוסים: `queued` ← `in_progress` ← `completed`. תוצאה ב-`images[].url` (CloudFront). הקישור תקף 7 ימים.
- **גילוי פרמטרים בחינם:** שליחת ערך לא תקין מחזירה 400 עם הערכים המותרים, בלי חיוב.

## marketing-studio/image
- `prompt` (חובה), `image_urls` (מערך של קישורי רפרנס), `aspect_ratio`, `resolution`, `quality`
- `aspect_ratio`: auto, 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9. **אין 4:5.** לפיד משתמשים ב-3:4.
- `resolution`: 1k / 2k / 4k. `quality`: low / medium / high
- זמן יצירה: כ-95 שניות (2K, high).
- מחיר לפי דף המודל: ‎$0.016 (1K low) עד ‎$0.72 (4K high). מחיר בפועל ל-2K high: `[להשלים לפי הבאלאנס]`

## היסטוריה
| תאריך | מודל | הגדרות | request_id | מחיר בפועל | הערות |
|---|---|---|---|---|---|
| 2026-11-09 | marketing-studio/image | 3:4, 2k, high, רפרנס: שרשרת אם ותינוק | 01a1bf21-56cb-790e-9974-a85a5b486bab | `[להשלים]` | בדיקה ראשונה |
