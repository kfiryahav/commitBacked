# carousel-agent

סוכן שמוצא כל יום קרוסלת אינסטגרם חזקה מפרופילים נבחרים, ומפיק ממנה קרוסלה מקורית בעברית ב-Canva, לפרסום למחרת.
ההוראות המלאות של הסוכן: [`AGENT.md`](./AGENT.md).

## מה בדוק ומה לא (נכון ל-2026-11-14)
- **נבדק:** חוק הבחירה (`scripts/lib/select.mjs`), מנגנון המשיכה מול שרת מדומה מקומי, ועריכת העיצוב ב-Canva על עותק ניסוי.
- **לא נבדק עדיין:** תשובה אמיתית של ScrapeCreators. שם ה-endpoint ושדות הלייקים/תגובות/שקפים הם ניחוש מושכל ב-`config/profiles.json` וב-`scripts/lib/normalize.mjs`, ויאומתו בקריאה חיה אחרי שהמפתח מחובר. בדיקות `normalize` משתמשות במבנים סינתטיים ולא מוכיחות את התגובה האמיתית.

## חוק הבחירה
קרוסלה (3 שקפים לפחות) עוברת אם: לייקים ≥ 1,000 **או** תגובות ≥ 150, **וגם** לייקים ≥ פי 3 מחציון 20 הפוסטים האחרונים של אותו יוצר. חלון 30 יום, מתרחב ל-60 ול-90. הספים לא יורדים.
לייקים מוסתרים: בודקים תגובות בלבד. כיתוב "תגיבו X ואשלח": צריך לעבור גם את רצפת הלייקים.

## הרצה ידנית
```bash
# פעם אחת: הוסף handles ל-config/profiles.json, ומפתח: export SCRAPECREATORS_API_KEY=...
node carousel-agent/scripts/calibrate.mjs          # כמה קרוסלות עוברות? (צריך ~30 בחודש לקרוסלה ביום)
node carousel-agent/scripts/fetch-carousels.mjs    # בוחר מועמדת -> out/candidates.json
node carousel-agent/scripts/download-slides.mjs    # מוריד את השקפים של המועמדת
node --test carousel-agent/test/*.test.mjs         # בדיקות (ב-Node 22 צריך את ה-glob, לא תיקייה)
```
בענן המפתח מוזרק על ידי ה-proxy של הסביבה. אין מפתח בקוד ואין צורך להגדיר משתנה.

## קבצים
- `config/profiles.json`: פרופילים וספים. `config/my-style.md`: הטון והמגבלות. `config/canva.json`: מפת העיצוב (נמדדה בניסוי).
- `lessons.md`, `seen.json`, `decisions-log.md` יושבים ב-Google Drive (תיקייה `Carousel Agent`), לא בריפו.
