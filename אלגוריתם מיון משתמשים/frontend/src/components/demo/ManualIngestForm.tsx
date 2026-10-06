import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2 } from 'lucide-react';
import { api, type LoginResult } from '../../api/client';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoginResultPanel } from './LoginResultPanel';
import { ROOT_PATH } from '../../lib/orgConstants';
import { parseSharePointProfileJson } from '../../lib/sharePointProfile';

const DEFAULT = {
  personalNumber: 'MANUAL-001',
  firstName: 'דוגמה',
  lastName: 'משתמש',
  rawOrgPath: `${ROOT_PATH}/אגף התקשוב/ענף צפון/מדור תומר/צוות א׳/דוגמה משתמש`,
  profileImageUrl: '',
  source: 'manual_ui',
};

export function ManualIngestForm({
  onSuccess,
}: {
  onSuccess?: (result: LoginResult) => void;
}) {
  const [form, setForm] = useState(DEFAULT);
  const [sharePointJson, setSharePointJson] = useState('');
  const qc = useQueryClient();

  const ingest = useMutation({
    mutationFn: () => {
      const sharePointProfile = parseSharePointProfileJson(sharePointJson);
      return api.ingestLogin(
        sharePointProfile
          ? { sharePointProfile, source: form.source, sourceSystem: form.source }
          : form
      );
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['aiDecisions'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onSuccess?.(data);
    },
  });

  const set =
    (key: keyof typeof DEFAULT) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Ingest ידני" description="POST /api/ingest-login — parse → match → עץ" />
        <CardBody className="space-y-4">
          <Field label="מספר אישי">
            <Input value={form.personalNumber} onChange={set('personalNumber')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="שם פרטי">
              <Input value={form.firstName} onChange={set('firstName')} />
            </Field>
            <Field label="שם משפחה">
              <Input value={form.lastName} onChange={set('lastName')} />
            </Field>
          </div>
          <Field label="נתיב ארגוני גולמי">
            <textarea
              value={form.rawOrgPath}
              onChange={set('rawOrgPath')}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              dir="rtl"
            />
          </Field>
          <Field label="מקור (אופציונלי)">
            <Input value={form.source} onChange={set('source')} />
          </Field>
          <Field label="תמונת פרופיל (אופציונלי)">
            <Input value={form.profileImageUrl} onChange={set('profileImageUrl')} placeholder="/profiles/c9214482.jpg או data:image/..." />
          </Field>
          <Field label="אובייקט SharePoint מלא (אופציונלי)">
            <textarea
              value={sharePointJson}
              onChange={(e) => setSharePointJson(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              dir="ltr"
              placeholder='{"AccountName":"idf\\\\c9214482","FirstName":"...","Department":"..."}'
            />
          </Field>

          {ingest.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">
              {(ingest.error as Error).message}
            </p>
          )}

          <Button
            className="w-full"
            disabled={ingest.isPending || (!sharePointJson.trim() && (!form.personalNumber || !form.rawOrgPath))}
            onClick={() => ingest.mutate()}
          >
            {ingest.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            הרץ ingest
          </Button>
        </CardBody>
      </Card>

      <div>
        {ingest.data ? (
          <LoginResultPanel result={ingest.data} />
        ) : (
          <Card className="border-dashed border-slate-200 bg-slate-50/50 shadow-none">
            <CardBody className="py-16 text-center text-[13px] text-slate-500">
              מלא את הטופס והרץ ingest — התוצאה תופיע כאן
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
