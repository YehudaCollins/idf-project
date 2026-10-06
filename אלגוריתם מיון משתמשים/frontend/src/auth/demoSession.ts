export type AccessRole = 'admin' | 'regular';
export type DemoActorId = 'admin' | 'regular';
export type SessionSource = 'demo' | 'sharepoint';

export interface SessionActor {
  id: DemoActorId | 'session';
  personalNumber: string;
  fullName: string;
  accessRole: AccessRole;
  label: string;
  source: SessionSource;
  description?: string;
  rank?: string;
  role?: string;
  profileImageUrl?: string;
  currentOrgPathText?: string;
}

/** תאימות לאחור */
export type DemoActor = SessionActor;

export const DEMO_ACTORS: SessionActor[] = [
  {
    id: 'admin',
    personalNumber: 'DEMO-2001',
    fullName: 'יונתן הררי',
    accessRole: 'admin',
    label: 'מנהל',
    source: 'demo',
    description: 'רואה הכל ומנהל הרשאות',
    rank: 'סרן',
    role: 'קמ"ד דיגיטל',
  },
  {
    id: 'regular',
    personalNumber: 'DEMO-2004',
    fullName: 'נדב שפירא',
    accessRole: 'regular',
    label: 'רגיל',
    source: 'demo',
    description: 'עץ + פרופיל אישי',
    rank: 'סרן',
    role: 'מפקד צוות ב׳',
  },
];

const ACTOR_STORAGE_KEY = 'unitree.demoActor';
const SESSION_STORAGE_KEY = 'unitree.sessionActor';

export function getDemoActorId(): DemoActorId {
  let stored: string | null = null;
  try {
    stored = typeof window !== 'undefined' ? window.localStorage?.getItem(ACTOR_STORAGE_KEY) ?? null : null;
  } catch {
    stored = null;
  }
  return stored === 'regular' ? 'regular' : 'admin';
}

export function setDemoActorId(id: DemoActorId) {
  try {
    if (typeof window !== 'undefined') window.localStorage?.setItem(ACTOR_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function getDemoActorById(id: DemoActorId): SessionActor {
  return DEMO_ACTORS.find((actor) => actor.id === id) ?? DEMO_ACTORS[0];
}

export function getDemoActor(): SessionActor {
  return getDemoActorById(getDemoActorId());
}

export function readStoredSessionActor(): SessionActor | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(SESSION_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionActor;
    if (!parsed?.personalNumber) return null;
    return {
      ...parsed,
      accessRole: parsed.accessRole === 'admin' ? 'admin' : 'regular',
      source: parsed.source === 'sharepoint' ? 'sharepoint' : 'demo',
      id: parsed.id === 'admin' || parsed.id === 'regular' ? parsed.id : 'session',
    };
  } catch {
    return null;
  }
}

export function writeStoredSessionActor(actor: SessionActor | null) {
  try {
    if (typeof window === 'undefined') return;
    if (!actor) {
      window.localStorage?.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(actor));
  } catch {
    // ignore
  }
}

export function getActiveActor(): SessionActor {
  return readStoredSessionActor() ?? getDemoActor();
}

export function getAuthRequestHeaders(): Record<string, string> {
  const actor = getActiveActor();
  const headers: Record<string, string> = {
    'X-Session-Personal-Number': actor.personalNumber,
    'X-Demo-Personal-Number': actor.personalNumber,
  };
  if (actor.source === 'demo' && (actor.id === 'admin' || actor.id === 'regular')) {
    headers['X-Demo-Actor'] = actor.id;
  }
  return headers;
}

/** @deprecated use getAuthRequestHeaders */
export function getDemoRequestHeaders(): Record<string, string> {
  return getAuthRequestHeaders();
}

export function allowDemoAuthFallback(): boolean {
  const flag = String(import.meta.env.VITE_ALLOW_DEMO_AUTH ?? '').toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return true;
  return Boolean(import.meta.env.DEV);
}
