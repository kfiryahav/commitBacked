# carousel-agent

סוכן שמוצא כל יום קרוסלת אינסטגרם חזקה מפרופילים נבחרים, ומפיק ממנה קרוסלה מקורית בעברית ב-Canva, לפרסום למחרת.
ההוראות המלאות של הסוכן: [`AGENT.md`](./AGENT.md).

## מה בדוק ומה לא (נכון ל-2026-11-14)
- **אומת בקריאה חיה (nick_saraev):** `GET /v2/instagram/user/posts?handle=` מחזיר 12 פוסטים בעמוד (קרדיט אחד לעמוד), `user.follower_count`, `like_count`, `comment_count`, `taken_at`, `caption.text`, `carousel_media[]`, וסמן עמוד `next_max_id`. **אין שיתופים ושמירות בתגובה.** הקובץ `test/fixtures/real-posts.json` הוא עותק מקוצר של התגובה האמיתית.
- **קרדיטים:** החשבון נראה כבעל כ-100 קרדיטים חינם (לא 10,000). כל עמוד פוסטים עולה קרדיט, והסקריפטים מדפדפים רק עד שהחלון מכוסה. יוצר שמפרסם כל יום עולה ~3 קרדיטים ל-30 יום ו-~7 ל-90 יום.
- **רשת:** `fetch` של Node מתעלם מ-`HTTPS_PROXY` בלי `NODE_USE_ENV_PROXY=1`. כל סקריפט מריץ את עצמו מחדש עם הדגל כשיש proxy (`scripts/lib/ensure-proxy.mjs`). הורדת תמונות השקפים מ-`*.cdninstagram.com` חסומה ברשת המוגבלת של הסביבה עד שמתירים את ה-host.
- **עוד לא נבדק:** תזמון, הצ'אט הייעודי, והרצה אוטומטית ללא אישורים.

## חוק הבחירה
קרוסלה (3 שקפים לפחות) עוברת אם: לייקים ≥ 1,000 **או** תגובות ≥ 150, **וגם** לייקים ≥ פי 3 מחציון 20 הפוסטים האחרונים של אותו יוצר. חלון 30 יום, מתרחב ל-60 ול-90. הספים לא יורדים.
לייקים מוסתרים: בודקים תגובות בלבד. כיתוב "תגיבו X ואשלח": צריך לעבור גם את רצפת הלייקים.

## הרצה ידנית
```bash
# פעם אחת: handles ב-config/profiles.json. בענן המפתח מוזרק; מקומית: export SCRAPECREATORS_API_KEY=...
# לפיתוח, כדי לא לבזבז קרדיטים: export SC_CACHE_DIR=/path/to/cache
node carousel-agent/scripts/calibrate.mjs          # כמה קרוסלות עוברות? (צריך ~30 בחודש לקרוסלה ביום)
node carousel-agent/scripts/fetch-carousels.mjs    # בוחר מועמדת -> out/candidates.json
node carousel-agent/scripts/download-slides.mjs    # מוריד את השקפים של המועמדת
node --test carousel-agent/test/*.test.mjs         # בדיקות (ב-Node 22 צריך את ה-glob, לא תיקייה)
```
בענן המפתח מוזרק על ידי ה-proxy של הסביבה. אין מפתח בקוד ואין צורך להגדיר משתנה.

## קבצים
- `config/profiles.json`: פרופילים וספים. `config/my-style.md`: הטון והמגבלות. `config/canva.json`: מפת העיצוב (נמדדה בניסוי).
- `lessons.md`, `seen.json`, `decisions-log.md` יושבים ב-Google Drive (תיקייה `Carousel Agent`), לא בריפו.
