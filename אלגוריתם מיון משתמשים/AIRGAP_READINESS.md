# מוכנות לרשת סגורה

Unitree מוגדר לעבוד ברשת מנותקת בלי משאבים ציבוריים בזמן ריצה.

## כללי Runtime

- ה-frontend פונה לשרת דרך `/api`.
- מצב AI ברשת סגורה צריך להיות `AI_PROVIDER=mock` או ספק פנימי בלבד.
- חיבור AD נעשה דרך `activedirectory2` וכתובת LDAP פנימית בלבד.
- תמונות דמו נוצרות כ-`data:image` מקומי.
- תמונות פרופיל מ-AD / SharePoint / API נשמרות ומוצגות רק אם הן אחת מהאפשרויות:
  - `data:image/...`
  - נתיב יחסי פנימי כמו `/profiles/c9214482.jpg`
  - שרת פנימי שמוגדר ב-`PROFILE_IMAGE_ALLOWED_HOSTS`
  - host פנימי ברור כמו `localhost`, שם שרת בלי נקודה, `.local`, `.internal`, `.corp`, `.idf`, או כתובת פרטית

## הגדרות חשובות

```env
AI_PROVIDER=mock
ACTIVE_DIRECTORY_URL=ldap://dc.domain.local
PROFILE_IMAGE_ALLOWED_HOSTS=
ALLOW_INTERNAL_PROFILE_IMAGE_URLS=true
```

אם בהמשך מחברים מנוע AI פנימי, משאירים את ההגדרות על endpoint פנימי בלבד.
אם SharePoint מחזיר `PictureURL` מלא, מוסיפים את שם השרת ל-`PROFILE_IMAGE_ALLOWED_HOSTS`.

## בדיקת הלבנה

יש לסרוק את קוד המקור ותוצרי הבנייה ולוודא שאין דומיינים ציבוריים, CDN, פונטים חיצוניים או שירותי תמונות חיצוניים.
מותרות כתובות פנימיות בלבד, וכן namespace של SVG שאינו גורם לבקשת רשת.

ה-build של ה-frontend מריץ ניקוי אוטומטי אחרי `vite build` כדי להסיר גם טקסטי עזר של ספריות צד שלישי מתוך `dist`.

## בדיקות שבוצעו

- `backend`: build TypeScript עבר.
- `frontend`: build TypeScript + Vite עבר, כולל ניקוי `dist`.
- סריקת קוד מקור ותוצרי build לא מצאה קישורי runtime ציבוריים.
- בדיקת תמונות פרופיל מאשרת חסימה של שירות תמונות חיצוני ואישור נתיב פנימי.
- סטטוס Active Directory נטען ללא חשיפת סיסמה או ערכים רגישים.

## לפני חיבור אמיתי ל-AD

יש להזין בסביבת השרת את הערכים האמיתיים של:

```env
ACTIVE_DIRECTORY_URL=
ACTIVE_DIRECTORY_BASE_DN=
ACTIVE_DIRECTORY_USERNAME=
ACTIVE_DIRECTORY_PASSWORD=
```

בלי הערכים האלה המערכת מוכנה בקוד, אבל תחזיר שהחיבור ל-AD עדיין לא מוגדר.
