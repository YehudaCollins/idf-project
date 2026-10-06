# מוכנות לרשת סגורה

הפרויקט בנוי לעבוד בלי טעינת משאבים מהאינטרנט בזמן ריצה.

## כללי Runtime

- ה-frontend פונה ל-API דרך נתיב יחסי `/api` כברירת מחדל.
- קבצים מצורפים נפתחים דרך `/uploads/attachments/...`.
- תמונות דמו נוצרות כ-`data:image` מקומי, בלי שירות תמונות חיצוני.
- תמונות פרופיל נשמרות ומוצגות רק אם הן אחת מהאפשרויות:
  - `data:image/...`
  - נתיב יחסי פנימי כמו `/profiles/c9214482.jpg`
  - שרת פנימי שמוגדר ב-`PROFILE_IMAGE_ALLOWED_HOSTS`
  - host פנימי ברור כמו `localhost`, שם שרת בלי נקודה, `.local`, `.internal`, `.corp`, `.idf`, או כתובת פרטית

## הגדרות חשובות

```env
UNITREE_API_BASE_URL=http://localhost:3002/api/v1
PROFILE_IMAGE_ALLOWED_HOSTS=
ALLOW_INTERNAL_PROFILE_IMAGE_URLS=true
```

אם Unitree יושב על שרת אחר ברשת הסגורה, משנים רק את `UNITREE_API_BASE_URL`.
אם SharePoint מחזיר `PictureURL` מלא, מוסיפים את שם השרת ל-`PROFILE_IMAGE_ALLOWED_HOSTS`.

## בדיקת הלבנה

יש לסרוק את קוד המקור ותוצרי הבנייה ולוודא שאין דומיינים ציבוריים, CDN, פונטים חיצוניים או שירותי תמונות חיצוניים.
מותרות כתובות פנימיות בלבד, וכן namespace של SVG שאינו גורם לבקשת רשת.
