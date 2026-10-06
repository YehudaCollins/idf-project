import { Code2, Download, Key, Send, ShieldCheck } from 'lucide-react';
import { Page, Card, CardHeader, CardBody, Badge, CodeBlock } from '../ui/primitives';

export function ApiDocsPage() {
  const base = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1';

  return (
    <Page
      wide
      title="תיעוד API"
      description="ממשק לשילוב מערכות חיצוניות — שליחת משתמשים ומשיכת מידע."
    >
      <Card className="mb-6">
        <CardHeader
          title="אימות"
          description="כל בקשה חיצונית עוברת עם מפתח API קבוע."
          action={<ShieldCheck className="h-4 w-4 text-muted" />}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-muted">
            <Key className="h-4 w-4" />
            הגדר <code className="border border-border bg-elevated px-2 py-0.5 font-mono text-[12px] text-foreground">EXTERNAL_API_KEY</code> ב-backend/.env
          </div>
          <CodeBlock>{`X-API-Key: your-api-key
Authorization: Bearer your-api-key
X-Source-System: SAP-HR`}</CodeBlock>
          <p className="text-[14px] leading-relaxed text-muted">
            ב-POST של משתמש חובה לשלוח שם מערכת מקור, דרך <code>sourceSystem</code> בגוף הבקשה או דרך <code>X-Source-System</code>. כך נשמר מי רשם את המשתמש ומי עדכן אותו לאחרונה.
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="שליחת משתמש"
            description="POST /api/v1/users"
            action={<Badge variant="accent"><Send className="ml-1 h-3 w-3" />POST</Badge>}
          />
          <CardBody>
            <p className="mb-4 text-[14px] leading-relaxed text-muted">
              פירוק נתיב, התאמה לעץ, שמירה ועדכון מבנה ארגוני. אפשר לשלוח פורמט פנימי או אובייקט SharePoint מלא.
            </p>
            <CodeBlock>{`curl -X POST ${base}/users \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-key" \\
  -H "X-Source-System: SAP-HR" \\
  -d '{
    "personalNumber": "1234567",
    "firstName": "יוסי",
    "lastName": "כהן",
    "rawOrgPath": "מפקדת חיל היבשה (דמו)/אגף התקשוב/...",
    "source": "hr-system",
    "rank": "רס\\"ר",
    "role": "מפתח",
    "email": "yossi@idf.local",
    "phone": "050-0000000",
    "attributes": { "unitCode": "A-12" }
  }'`}</CodeBlock>
            <CodeBlock>{`curl -X POST ${base}/users \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-key" \\
  -H "X-Source-System: SharePoint" \\
  -d '{
    "UserProfile_GUID": "7f0...",
    "AccountName": "idf\\\\c9214482",
    "FirstName": "נדב",
    "LastName": "שפירא",
    "PreferredName": "נדב שפירא",
    "Department": "מפקדת חיל היבשה (דמו)/אגף התקשוב/ענף צפון/מדור תומר/צוות ב׳/c9214482",
    "Title": "סרן מפקד צוות ב׳",
    "SPS-Department": "מפקדת חיל היבשה (דמו)/אגף התקשוב/ענף צפון/מדור תומר/צוות ב׳/c9214482",
    "Manager": "idf\\\\c9000001",
    "PictureURL": "/profiles/c9214482.jpg",
    "SPS-DataSource": "SharePoint",
    "WorkEmail": "c9214482@idf.local",
    "CellPhone": "050-0000000"
  }'`}</CodeBlock>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="משיכת משתמש"
            description="GET /api/v1/users/:personalNumber"
            action={<Badge><Download className="ml-1 h-3 w-3" />GET</Badge>}
          />
          <CardBody>
            <p className="mb-4 text-[14px] leading-relaxed text-muted">
              פרופיל, נתיב ארגוני, היסטוריה והחלטות AI.
            </p>
            <CodeBlock>{`curl ${base}/users/1234567 \\
  -H "X-API-Key: your-key"

# ?history=false  ?decisions=false`}</CodeBlock>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="חיפוש"
            description="GET /api/v1/users?q=&sourceSystem="
            action={<Badge><Code2 className="ml-1 h-3 w-3" />GET</Badge>}
          />
          <CardBody>
            <CodeBlock>{`curl "${base}/users?q=כהן&limit=20" \\
  -H "X-API-Key: your-key"

curl "${base}/users?sourceSystem=SAP-HR&sourceMatch=registered" \\
  -H "X-API-Key: your-key"`}</CodeBlock>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="מערכות מקור"
            description="GET /api/v1/source-systems"
            action={<Badge><Code2 className="ml-1 h-3 w-3" />GET</Badge>}
          />
          <CardBody>
            <CodeBlock>{`curl "${base}/source-systems" \\
  -H "X-API-Key: your-key"

curl "${base}/source-systems/SAP-HR/users?match=any&limit=100" \\
  -H "X-API-Key: your-key"`}</CodeBlock>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="לוגי קליטה"
            description="GET /api/v1/source-systems/:sourceSystem/ingest-events"
            action={<Badge><Code2 className="ml-1 h-3 w-3" />GET</Badge>}
          />
          <CardBody>
            <CodeBlock>{`curl "${base}/source-systems/SAP-HR/ingest-events?personalNumber=1234567" \\
  -H "X-API-Key: your-key"

# אפשר גם:
# ?from=2026-07-01&to=2026-07-22&limit=200`}</CodeBlock>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="זיהוי משתמש מ-SharePoint"
            description="POST /api/auth/microsoft-profile"
            action={<Badge variant="accent"><Send className="ml-1 h-3 w-3" />POST</Badge>}
          />
          <CardBody>
            <p className="mb-4 text-[14px] leading-relaxed text-muted">
              הלקוח קורא את פרופיל המשתמש המחובר מ-SharePoint ושולח לשרת. אם המשתמש חדש — נשמר אוטומטית; אם קיים — מתעדכן ומתחבר עם ההרשאה שלו.
            </p>
            <CodeBlock>{`curl -X POST /api/auth/microsoft-profile \\
  -H "Content-Type: application/json" \\
  -d '{
    "sharePointProfile": {
      "AccountName": "i:0#.w|domain\\\\1234567",
      "PreferredName": "יוסי כהן",
      "FirstName": "יוסי",
      "LastName": "כהן",
      "Department": "מפקדת חיל היבשה/אגף התקשוב/...",
      "SPS-DataSource": "Microsoft SharePoint"
    }
  }'`}</CodeBlock>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Active Directory"
            description="בדיקת מספר אישי מול LDAP / AD"
            action={<Badge><Code2 className="ml-1 h-3 w-3" />GET/POST</Badge>}
          />
          <CardBody>
            <p className="mb-4 text-[14px] leading-relaxed text-muted">
              דורש הגדרת `ACTIVE_DIRECTORY_*` בשרת. החיפוש מחזיר פרופיל ממופה, וניתן גם להכניס את המשתמש לעץ דרך אותו ingest.
            </p>
            <CodeBlock>{`curl "${base}/directory/status" \\
  -H "X-API-Key: your-key"

curl "${base}/directory/users/c9214482" \\
  -H "X-API-Key: your-key"

curl -X POST "${base}/directory/users/c9214482/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-key" \\
  -d '{ "source": "ad-manual-check" }'`}</CodeBlock>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="ingest מחדש (פנימי)"
            description="POST /api/users/:personalNumber/reingest"
            action={<Badge variant="accent"><Send className="ml-1 h-3 w-3" />POST</Badge>}
          />
          <CardBody>
            <p className="mb-4 text-[14px] leading-relaxed text-muted">
              מריץ שוב את pipeline ה-ingest לפי הנתיב הגולמי האחרון של המשתמש, או לפי נתיב שמועבר בגוף הבקשה.
            </p>
            <CodeBlock>{`curl -X POST /api/users/1234567/reingest \\
  -H "Content-Type: application/json" \\
  -d '{ "rawOrgPath": "מפקדת חיל היבשה/..." }'`}</CodeBlock>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
