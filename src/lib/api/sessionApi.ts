export type ApiMode = 'singles' | 'doubles';
export type SessionPlayerStatus =
  | 'registered'
  | 'checked_in'
  | 'resting'
  | 'playing';
export type MatchStatus = 'ready' | 'playing' | 'done';

export interface ApiSession {
  id: string;
  mode: ApiMode;
  status: 'open' | 'closed';
  activeCourts: number[];
  createdAt?: string | null;
}

export interface ApiSessionPlayer {
  id: string;
  playerId: string | null;
  name: string;
  status: SessionPlayerStatus;
  registeredAt: string;
  checkedInAt: string | null;
  matchesPlayedInSession: number;
  queuedAt: string;
}

export interface ApiMatch {
  id: string;
  court: number;
  mode: ApiMode;
  teamA: string[];
  teamB: string[];
  status: MatchStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  statsCounted?: boolean;
}

export interface ApiPartnerHistoryEntry {
  pairKey: string;
  players: [string, string];
  timesPlayedTogether: number;
  lastPlayedAt: string | null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return data as T;
}

export const createSession = (
  mode: ApiMode,
  pin: string,
  activeCourts: number[],
) =>
  request<ApiSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ mode, pin, activeCourts }),
  });

export const getSession = (sessionId: string) =>
  request<ApiSession>(`/sessions/${sessionId}`);

export const updateSession = (
  sessionId: string,
  patch: Partial<Pick<ApiSession, 'mode' | 'activeCourts' | 'status'>>,
) =>
  request<ApiSession>(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const verifySessionPin = (sessionId: string, pin: string) =>
  request<{ ok: boolean }>(`/sessions/${sessionId}/verify-pin`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });

export const resetSessionStats = (sessionId: string) =>
  request<{ ok: true }>(`/sessions/${sessionId}/reset-stats`, {
    method: 'POST',
  });

export const listSessionPlayers = (sessionId: string) =>
  request<ApiSessionPlayer[]>(`/sessions/${sessionId}/players`);

export const addSessionPlayers = (sessionId: string, names: string[]) =>
  request<{ accepted: ApiSessionPlayer[]; duplicates: string[] }>(
    `/sessions/${sessionId}/players`,
    { method: 'POST', body: JSON.stringify({ names }) },
  );

/** Public — no PIN required. Pre-registers names for a session ahead of
 * time; they still need to check in at the court before being eligible
 * for the matching pool. */
export const registerForSession = (sessionId: string, names: string[]) =>
  request<{ accepted: ApiSessionPlayer[]; duplicates: string[] }>(
    `/sessions/${sessionId}/register`,
    { method: 'POST', body: JSON.stringify({ names }) },
  );

/** Public — no PIN required. Confirms someone is at the court: moves a
 * pre-registered player to 'checked_in', or creates a fresh checked-in
 * entry for a walk-in who never pre-registered. Idempotent if already
 * checked in. Pass exactly one of sessionPlayerId or name. */
export const checkInToSession = (
  sessionId: string,
  target: { sessionPlayerId: string } | { name: string },
) =>
  request<ApiSessionPlayer>(`/sessions/${sessionId}/checkin`, {
    method: 'POST',
    body: JSON.stringify(target),
  });

export const deleteSessionPlayer = (
  sessionId: string,
  sessionPlayerId: string,
) =>
  request<{ ok: true }>(
    `/sessions/${sessionId}/players/${sessionPlayerId}`,
    { method: 'DELETE' },
  );

export const renamePlayer = (playerId: string, name: string) =>
  request<{ id: string; name: string }>(`/players/${playerId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });

export const listMatches = (sessionId: string) =>
  request<ApiMatch[]>(`/sessions/${sessionId}/matches`);

export const createMatch = (
  sessionId: string,
  input: {
    court: number;
    mode: ApiMode;
    teamAIds: string[];
    teamBIds: string[];
  },
) =>
  request<ApiMatch>(`/sessions/${sessionId}/matches`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateMatchStatus = (
  sessionId: string,
  matchId: string,
  status: MatchStatus,
) =>
  request<ApiMatch>(`/sessions/${sessionId}/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const undoMatchFinish = (sessionId: string, matchId: string) =>
  request<ApiMatch>(
    `/sessions/${sessionId}/matches/${matchId}/undo-finish`,
    { method: 'POST' },
  );

export const substituteMatchPlayer = (
  sessionId: string,
  matchId: string,
  outSessionPlayerId: string,
  inSessionPlayerId: string,
) =>
  request<ApiMatch>(
    `/sessions/${sessionId}/matches/${matchId}/substitute`,
    {
      method: 'POST',
      body: JSON.stringify({ outSessionPlayerId, inSessionPlayerId }),
    },
  );

export const closeCourt = (sessionId: string, court: number) =>
  request<{ session: ApiSession; closedMatchId: string | null }>(
    `/sessions/${sessionId}/close-court`,
    { method: 'POST', body: JSON.stringify({ court }) },
  );

export const getPartnerHistory = (sessionId: string) =>
  request<ApiPartnerHistoryEntry[]>(`/sessions/${sessionId}/partner-history`);
