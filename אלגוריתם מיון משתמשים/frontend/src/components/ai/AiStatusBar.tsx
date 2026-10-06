import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

const PROVIDER_LABEL: Record<string, string> = {
  mock: 'מנוע כללים',
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
};

export function AiStatusBar({ compact }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey: ['aiStatus'],
    queryFn: api.aiStatus,
    staleTime: 60_000,
  });

  if (!data) return null;

  const isLive = data.provider !== 'mock' && data.ready && data.connected;
  const isPending = data.provider !== 'mock' && data.ready && !data.connected;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5',
        isLive && 'border-teal-200 bg-accent-soft/70',
        isPending && 'border-amber-200 bg-amber-50/50',
        data.provider === 'mock' && 'border-slate-200 bg-white'
      )}
    >
      {isLive ? (
        <Sparkles className="h-4 w-4 text-accent" />
      ) : isPending ? (
        <AlertCircle className="h-4 w-4 text-amber-600" />
      ) : (
        <BrainCircuit className="h-4 w-4 text-slate-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-800">
          {PROVIDER_LABEL[data.provider] ?? data.provider}
          <span className="mx-1.5 font-normal text-slate-400">·</span>
          <span className="font-mono text-[12px] font-medium">{data.model}</span>
          {isLive && (
            <span className="mr-2 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              מחובר
            </span>
          )}
        </p>
        {!compact && <p className="text-[11px] text-slate-500">{data.message}</p>}
      </div>
      {!compact && data.features.semanticMatch && (
        <span className="text-[11px] font-medium text-slate-500">semantic match</span>
      )}
    </div>
  );
}
