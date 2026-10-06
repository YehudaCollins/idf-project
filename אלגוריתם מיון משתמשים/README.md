# Unitree — MVP עץ ארגוני חכם (דמו)

מערכת דמו לניהול עץ ארגוני מנתוני התחברות מדומים. **אין שימוש בנתונים אמיתיים, Microsoft, SharePoint או AI חיצוני.**

## דרישות

- Node.js 18+
- MongoDB מקומי (`mongodb://127.0.0.1:27017`)

## התקנה והרצה

```bash
# מהשורש
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# העתק משתני סביבה (אופציונלי)
cp backend/.env.example backend/.env

# הפעל MongoDB, ואז:
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:3002 (ברירת מחדל; ניתן לשנות ב-`backend/.env`)

## עץ בסיס + ניקוי DB

```bash
npm run seed
```

יוצר עץ ארגוני בעברית (**~150+ יחידות**, **35 משתמשים** מראש) תחת `מפקדת חיל היבשה (דמו)`:
- 6 אגפים: התקשוב, לוגיסטיקה, מודיעין, הדרכה, טכנולוגיה, משאבי אנוש, מבצעים
- ענפים, מדורים, מחלקות, צוותים, תת-צוותים, תאים (+ כינויים לבדיקת AI)

**50 משתמשי דמו להתחברות** (`DEMO-2001+`) עם תרחישי AI: נתיב נקי, טעויות, כינויים, רמה חסרה, יחידה חדשה, מעבר (`DEMO-1001`…).

```bash
npm run seed   # חובה לפני בדיקות AI
npm run dev
```

## API עיקרי

| Method | Path | תיאור |
|--------|------|--------|
| POST | `/api/demo/login` | התחברות דמו |
| POST | `/api/ingest-login` | עיבוד התחברות |
| GET | `/api/demo/users` | רשימת משתמשי דמו |
| GET | `/api/org/tree` | עץ ארגוני |
| GET | `/api/reviews` | ביקורות ממתינות |

## זרימת דמו מומלצת

1. **התחברות דמו** — `demo-1` (נתיב נקי) לבניית העץ.
2. `demo-4`–`demo-6` — אותה שגיאת כתיב 3 פעמים ללמידת כינוי.
3. `demo-7` — רמה חסרה (Branch) — לא נוצרת רמה מומצאת.
4. **מרכז ביקורת** — אישור/דחיית פריטים.

## מבנה

```
backend/src/modules/  ingest, parser, matcher, ai-decisions, reviews
backend/src/models/   User, OrgUnit, ...
frontend/src/pages/   Dashboard, DemoLogin, OrgTree, ...
```

## החלפה עתידית

הלוגיקה מופרדת: `ingestLogin` → `parseOrgPath` → `buildOrgPath` / `matchOrgSegment`. ניתן להחליף את מקור הנתונים ב-adapter ל-SP/Microsoft בלי לשנות את ה-UI.
