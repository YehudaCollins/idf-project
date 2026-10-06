import { getAuthRequestHeaders } from '../auth/demoSession';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthRequestHeaders(), ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  dashboardStats: () => request<DashboardStats>('/dashboard/stats'),
  aiStatus: () => request<AiStatus>('/ai/status'),
  aiStats: () => request<AiStats>('/ai/stats'),
  demoUsers: () => request<DemoUser[]>('/demo/users'),
  currentActor: () => request<DemoActorResponse>('/auth/me'),
  demoActors: () => request<DemoActorResponse[]>('/auth/demo-actors'),
  loginMicrosoftProfile: (sharePointProfile: Record<string, unknown>) =>
    request<MicrosoftProfileLoginResponse>('/auth/microsoft-profile', {
      method: 'POST',
      body: JSON.stringify({ sharePointProfile }),
    }),
  demoLogin: (demoUserId: string) =>
    request<LoginResult>('/demo/login', {
      method: 'POST',
      body: JSON.stringify({ demoUserId }),
    }),
  demoBulkLogin: (demoUserIds?: string[]) =>
    request<DemoBulkLoginResult>('/demo/bulk-login', {
      method: 'POST',
      body: JSON.stringify({ demoUserIds }),
    }),
  ingestLogin: (body: IngestLoginBody) =>
    request<LoginResult>('/ingest-login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  users: (q?: string) => {
    const sp = new URLSearchParams({ limit: '500' });
    if (q) sp.set('q', q);
    return request<UserRecord[]>(`/users?${sp.toString()}`);
  },
  user: (pn: string) =>
    request<{ user: UserRecord; history: OrgHistory[]; decisions: AiDecision[] }>(`/users/${pn}`),
  updateUserProfile: (pn: string, body: Partial<Pick<UserRecord, 'firstName' | 'lastName' | 'rank' | 'role' | 'email' | 'phone' | 'profileImageUrl'>>) =>
    request<UserRecord>(`/users/${encodeURIComponent(pn)}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  updateUserAccessRole: (pn: string, accessRole: AccessRole) =>
    request<UserRecord>(`/users/${encodeURIComponent(pn)}/access-role`, {
      method: 'PATCH',
      body: JSON.stringify({ accessRole }),
    }),
  reingestUser: (pn: string, rawOrgPath?: string) =>
    request<LoginResult>(`/users/${encodeURIComponent(pn)}/reingest`, {
      method: 'POST',
      body: JSON.stringify(rawOrgPath ? { rawOrgPath } : {}),
    }),
  directoryStatus: () => request<ApiEnvelope<DirectoryStatus>>('/v1/directory/status'),
  directoryLookup: (personalNumber: string, raw = false) =>
    request<ApiEnvelope<DirectoryLookupResponse>>(`/v1/directory/users/${encodeURIComponent(personalNumber)}${raw ? '?raw=true' : ''}`),
  directoryIngest: (personalNumber: string, body?: { rawOrgPath?: string; source?: string; sourceSystem?: string }) =>
    request<ApiEnvelope<{ directory: DirectoryLookupResponse; ingest: DirectoryIngestResponse }>>(
      `/v1/directory/users/${encodeURIComponent(personalNumber)}/ingest`,
      {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }
    ),
  orgTree: () =>
    request<{ tree: OrgTreeNode[]; total: number; pendingReviewCount?: number; orphanRootCount?: number; viewScope?: OrgTreeScope | null }>('/org/tree'),
  repairOrphanRoots: () =>
    request<{ ok: boolean; repaired: number; primaryRoot: string | null }>('/org/repair-orphans', { method: 'POST' }),
  orgUnit: (id: string) => request<OrgUnitDetail>(`/org/units/${id}`),
  updateOrgUnit: (id: string, body: { canonicalName?: string; type?: string }) =>
    request<StructureMutationResult>(`/org/units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createOrgChildUnit: (id: string, body: { canonicalName: string; type?: string }) =>
    request<StructureMutationResult>(`/org/units/${id}/children`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  proposeAlias: (unitId: string, aliasValue: string, proposedBy?: string) =>
    request<ReviewItem>(`/org/units/${unitId}/propose-alias`, {
      method: 'POST',
      body: JSON.stringify({ aliasValue, proposedBy }),
    }),
  aiDecisions: (params?: { action?: string; q?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.action) sp.set('action', params.action);
    if (params?.q) sp.set('q', params.q);
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return request<AiDecision[]>(`/ai-decisions${qs ? `?${qs}` : ''}`);
  },
  aiDecision: (id: string) => request<AiDecision>(`/ai-decisions/${id}`),
  reviews: (status = 'needs_review') =>
    request<ReviewItem[]>(`/reviews?status=${encodeURIComponent(status)}`),
  approveReview: (id: string, body?: { selectedUnitId?: string; note?: string; resolution?: 'existing' | 'create_new' }) =>
    request<ReviewItem>(`/reviews/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  rejectReview: (id: string, body?: { note?: string }) =>
    request<ReviewItem>(`/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
};

export type AccessRole = 'admin' | 'regular';

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

export type DirectoryIngestResponse = {
  user: {
    personalNumber: string;
    fullName: string;
    orgPathText: string;
    orgPathIds: string[];
    rank?: string;
    role?: string;
    email?: string;
    profileImageUrl?: string;
    sourceSystem?: string;
    registeredSourceSystem?: string;
    registeredVia?: string;
    sourceSystems?: string[];
    loginCount?: number;
    created: boolean;
    updated: boolean;
  };
  ingest: {
    pathText: string;
    segments: string[];
    userNameRemoved: boolean;
    suspectedMissingLevel: boolean;
    decisions: LoginResult['decisions'];
    reviewIds: string[];
    orgHistoryCreated: boolean;
    newOrgUnits: number;
    treeGrowth: LoginResult['treeGrowth'];
    warnings: string[];
  };
  enrichment: ProfileChange[];
  ai: LoginResult['ai'];
};

export interface DirectoryStatus {
  enabled: boolean;
  configured: boolean;
  sourceSystem: string;
  url?: string;
  baseDN?: string;
  personalNumberAttributes: string[];
  userAttributes: string[];
  missing: string[];
}

export interface DirectoryLookupResponse {
  found: boolean;
  personalNumber: string;
  sourceSystem: string;
  strategy: 'findUser' | 'attribute-search' | 'none';
  sharePointProfile?: Record<string, unknown>;
  mapped?: {
    personalNumber?: string;
    firstName?: string;
    lastName?: string;
    rawOrgPath?: string;
    source?: string;
    rank?: string;
    role?: string;
    email?: string;
    phone?: string;
    profileImageUrl?: string;
    sourceSystem?: string;
    missing: string[];
  };
  rawUser?: Record<string, unknown>;
}

export interface DemoActorResponse {
  id: 'admin' | 'regular' | 'session';
  personalNumber: string;
  fullName: string;
  accessRole: AccessRole;
  label: string;
  source?: 'demo' | 'sharepoint';
  rank?: string;
  role?: string;
  profileImageUrl?: string;
  currentOrgPathText?: string;
}

export interface MicrosoftProfileLoginResponse {
  ok: boolean;
  actor: DemoActorResponse;
  created: boolean;
  updated: boolean;
  ingest?: {
    pathText: string;
    warnings: string[];
    user: {
      personalNumber: string;
      fullName: string;
      created: boolean;
      updated: boolean;
    };
  };
}

export interface AiStatus {
  provider: 'mock' | 'openai' | 'azure-openai';
  model: string;
  enabled: boolean;
  ready: boolean;
  connected?: boolean;
  message: string;
  features: {
    semanticMatch: boolean;
    patternLearning: boolean;
    humanReview: boolean;
    llmExplain: boolean;
  };
}

export interface AiStats {
  provider: AiStatus;
  totalDecisions: number;
  decisionsToday: number;
  pendingReviews: number;
  byAction: { action: string; count: number }[];
}

export interface DashboardStats {
  totalUsers: number;
  totalOrgUnits: number;
  orgUnitsToday: number;
  loginsToday: number;
  aiDecisionsToday: number;
  pendingReviews: number;
  totalAliases?: number;
  recentLogins: {
    personalNumber: string;
    firstName: string;
    lastName: string;
    rawOrgPath: string;
    source?: string;
    sourceSystem?: string;
    profileImageUrl?: string;
    pathText?: string;
    newOrgUnits?: number;
    created?: boolean;
    enrichmentCount?: number;
    createdAt: string;
  }[];
  recentDecisions: AiDecision[];
}

export interface IngestLoginBody {
  personalNumber?: string;
  firstName?: string;
  lastName?: string;
  rawOrgPath?: string;
  source?: string;
  rank?: string;
  role?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  sourceSystem?: string;
  sharePointProfile?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export interface ProfileChange {
  field: string;
  action: 'added' | 'updated' | 'unchanged';
  value?: unknown;
  previous?: unknown;
}

export interface DemoUser {
  id: string;
  personalNumber: string;
  firstName: string;
  lastName: string;
  rank?: string;
  role?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  sourceSystem?: string;
  sharePointProfile?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  accessRole?: AccessRole;
  rawOrgPath: string;
  description: string;
  category?: string;
}

export interface LoginResult {
  demo?: DemoUser;
  user: {
    personalNumber: string;
    fullName: string;
    currentOrgPathText: string;
    rank?: string;
    role?: string;
    email?: string;
    profileImageUrl?: string;
    sourceSystem?: string;
    registeredSourceSystem?: string;
    registeredVia?: string;
    sourceSystems?: string[];
    loginCount?: number;
    created: boolean;
    updated: boolean;
  };
  parsed: { segments: string[]; userNameRemoved: boolean; suspectedMissingLevel: boolean };
  pathText: string;
  pathIds: string[];
  decisions: {
    segment: string;
    action: string;
    confidence: number;
    created: boolean;
    reviewId?: string;
    unitId?: string;
  }[];
  orgHistoryCreated: boolean;
  reviewIds: string[];
  enrichment?: ProfileChange[];
  newOrgUnits?: number;
  treeGrowth?: { segment: string; unitId: string; action: string; created: boolean }[];
  warnings?: string[];
  ai: {
    provider: string;
    model: string;
    ready: boolean;
    needsReview: boolean;
  };
}

export interface DemoBulkLoginResult {
  requested: number;
  succeeded: number;
  failed: number;
  newOrgUnits: number;
  reviews: number;
  results: {
    demoUserId: string;
    personalNumber: string;
    fullName: string;
    created: boolean;
    updated: boolean;
    newOrgUnits: number;
    reviewCount: number;
    error?: string;
  }[];
}

export interface UserRecord {
  personalNumber: string;
  accessRole?: AccessRole;
  firstName: string;
  lastName: string;
  fullName: string;
  currentOrgPathText: string;
  currentOrgUnitId?: string;
  currentOrgPathIds?: string[];
  rawPaths: string[];
  knownNames?: string[];
  sources?: string[];
  loginCount?: number;
  rank?: string;
  role?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  sourceSystem?: string;
  registeredSourceSystem?: string;
  registeredVia?: string;
  sourceSystems?: string[];
  attributes?: Record<string, unknown>;
  lastSeenAt: string;
  firstSeenAt?: string;
}

export interface OrgHistory {
  rawPath: string;
  changedAt: string;
  fromPathIds: string[];
  toPathIds: string[];
  fromPathText?: string;
  toPathText?: string;
}

export interface OrgTreeNode {
  _id: string;
  canonicalName: string;
  pathText: string;
  isVerified: boolean;
  stats: { userCount: number; aliasCount: number };
  aliases: { value: string; status: string }[];
  pendingReviews?: number;
  dataQuality?: { suspicious: boolean; reasons: string[] };
  commander?: CommanderSummary | null;
  detachedRoot?: boolean;
  children?: OrgTreeNode[];
}

export interface OrgTreeScope {
  focusUnitId?: string;
  scopeUnitIds: string[];
  scopePathIds: string[];
}

export interface CommanderSummary {
  personalNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  rank?: string;
  role?: string;
  profileImageUrl?: string;
  confidence: number;
  reason: string;
}

export type CommanderSnapshot = Omit<CommanderSummary, 'confidence' | 'reason'> & {
  confidence?: number;
  reason?: string;
};

export interface OrgUnitDetail {
  unit: OrgTreeNode & { pathIds: string[]; verificationStatus: string; type?: string };
  parent: OrgTreeNode | null;
  children: OrgTreeNode[];
  users: UserRecord[];
  commander?: CommanderSummary | null;
  decisions: AiDecision[];
  reviews: ReviewItem[];
  permissions?: {
    actorRole: AccessRole;
    canViewUsers: boolean;
    canEditStructure: boolean;
    reason: string;
  };
}

export interface StructureMutationResult {
  status: 'created' | 'updated' | 'needs_review';
  unit?: OrgTreeNode;
  review?: ReviewItem;
  reasons?: string[];
}

export interface AiDecision {
  _id: string;
  decisionType: string;
  rawValue: string;
  normalizedRawValue?: string;
  matchedCanonicalName?: string;
  parentId?: string;
  confidence: number;
  action: string;
  reason: string;
  signals?: Record<string, unknown>;
  source?: string;
  modelVersion?: string;
  personalNumber?: string;
  createdAt: string;
}

export interface ReviewItem {
  _id: string;
  changeType: string;
  rawValue?: string;
  targetCanonicalName?: string;
  targetUnitId?: string;
  proposedType?: string;
  proposedAlias?: string;
  confidence?: number;
  reason: string;
  conflict?: {
    rawValue: string;
    candidates: { unitId: string; canonicalName: string; confidence: number }[];
  };
  commanderChange?: {
    unitId: string;
    unitName: string;
    previousCommander?: CommanderSnapshot;
    proposedCommander: CommanderSnapshot;
  };
  affectedUsersCount?: number;
  status: string;
  createdAt: string;
  proposedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  selectedUnitId?: string;
  aliasAdded?: boolean;
  aliasValue?: string;
  aliasAlreadyExisted?: boolean;
  createdNew?: boolean;
  noteActions?: string[];
  reingestedUser?: {
    personalNumber?: string;
    fullName?: string;
    pathText?: string;
    reviewIds?: string[];
    expectedUnitApplied?: boolean;
    forcedSelectedUnit?: {
      applied?: boolean;
      skipped?: boolean;
      reason?: string;
      pathText?: string;
      unitId?: string;
      selectedUnitId?: string;
      placementWarning?: string;
    } | null;
    error?: string;
  } | null;
}
