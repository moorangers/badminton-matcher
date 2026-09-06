'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import {
  ChevronRight,
  HelpCircle,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Newspaper,
  Plus,
  Share2,
  Tv,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { CourtSelector } from '@/components/CourtSelector';
import {
  MatchBoard,
  type Match,
  type MatchStatus,
} from '@/components/MatchBoard';
import { ModeSelector, type Mode } from '@/components/ModeSelector';
import { PlayerList, type Player } from '@/components/PlayerList';
import { QrCode } from '@/components/QrCode';
import { TargetScoreSelector } from '@/components/TargetScoreSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_VERSION } from '@/lib/appVersion';
import {
  buildMatchesFromPlayers,
  getPlayersPerMatch,
  rankCandidates,
  type SessionPlan,
} from '@/lib/matching';
import { cn } from '@/lib/utils';
import {
  ApiError,
  addSessionPlayers,
  changeSessionPin,
  checkInToSession,
  closeCourt as closeCourtApi,
  createMatch,
  createSession,
  deleteSessionPlayer,
  getPartnerHistory,
  getSession,
  listMatches,
  listSessions,
  listSessionPlayers,
  renamePlayer,
  resetSessionStats,
  substituteMatchPlayer,
  undoMatchFinish,
  updateMatchScore,
  updateMatchStatus as updateMatchStatusApi,
  updateSession,
  verifySessionPin,
  type ApiMatch,
  type ApiSession,
  type ApiSessionPlayer,
} from '@/lib/api/sessionApi';

const SESSION_STORAGE_KEY = 'bm_session_id';
const MAX_COURTS = 3;
const PIN_PATTERN = /^\d{4,6}$/;

// The plan editor also lets the admin adjust targetScore for future
// rounds — kept separate from SessionPlan since the pure matching
// algorithm only ever needs mode/courtIds.
type PlanDraft = SessionPlan & { targetScore: number };

type PendingSubstitute = {
  playerId: string;
  playerName: string;
  court: number;
};

type ManagePlayerDraft = {
  sessionPlayerId: string;
  playerId: string | null;
  name: string;
};

type HydratedMatch = Match & {
  matchId: string;
  statsCounted: boolean;
  finishedAt: string | null;
};

type ViewState = 'loading' | 'create' | 'pin' | 'dashboard';

const getCourtIds = (count: number) => {
  return Array.from({ length: count }, (_, index) => index + 1);
};

const formatModeLabel = (sourceMode: Mode) => {
  return sourceMode === 'singles' ? 'Singles (1v1)' : 'Doubles (2v2)';
};

const formatCourtLabel = (courtIds: number[]) => {
  return courtIds.map((courtId) => `Court ${courtId}`).join(', ');
};

const formatSessionDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const toLocalPlayer = (sessionPlayer: ApiSessionPlayer): Player => ({
  id: sessionPlayer.id,
  name: sessionPlayer.name,
  matches: sessionPlayer.matchesPlayedInSession,
  queuedAt: new Date(sessionPlayer.queuedAt).getTime(),
});

// Only 'checked_in'/'resting'/'playing' players are eligible for the
// matching pool — 'registered' means they signed up ahead of time but
// have not confirmed being at the court yet (see Phase 2 check-in flow).
const toEligiblePlayers = (sessionPlayers: ApiSessionPlayer[]): Player[] =>
  sessionPlayers
    .filter((sessionPlayer) => sessionPlayer.status !== 'registered')
    .map(toLocalPlayer);

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
};

export function HomePage() {
  // ---- session bootstrap ----
  const [bootstrapped, setBootstrapped] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [origin, setOrigin] = useState('');

  // ---- create-session form ----
  // Mode/court count/target score are no longer chosen at creation time —
  // create with sensible defaults, then adjust via the dashboard's
  // pre-game section before the first "เริ่มจับคู่" (which already
  // supports changing all three before any match exists).
  const [createName, setCreateName] = useState('');
  const [createPin, setCreatePin] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ---- existing-session history (shown on the create screen) ----
  const [existingSessions, setExistingSessions] = useState<ApiSession[]>([]);
  const [historyPage, setHistoryPage] = useState(0);

  // ---- pin gate ----
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // ---- unlocking a session picked from the "existing sessions" list, as a
  // modal on top of the create screen (see pickExistingSession) ----
  const [unlockingSession, setUnlockingSession] = useState<ApiSession | null>(
    null,
  );
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [unlockPinError, setUnlockPinError] = useState<string | null>(null);
  const [isUnlockingSession, setIsUnlockingSession] = useState(false);

  // ---- server-backed data ----
  const [sessionPlayersRaw, setSessionPlayersRaw] = useState<
    ApiSessionPlayer[]
  >([]);
  const [matchesRaw, setMatchesRaw] = useState<ApiMatch[]>([]);
  const [partnerHistory, setPartnerHistory] = useState<Record<string, number>>(
    {},
  );
  const [nextMatches, setNextMatches] = useState<Match[]>([]);

  // ---- pre-game draft (only used while there are no active matches yet) ----
  const [draftMode, setDraftMode] = useState<Mode>('doubles');
  const [draftCourts, setDraftCourts] = useState(1);
  const [draftTargetScore, setDraftTargetScore] = useState(11);

  // ---- misc UI state (same shape as before) ----
  const [managePlayerDraft, setManagePlayerDraft] =
    useState<ManagePlayerDraft | null>(null);
  const [pendingSubstitute, setPendingSubstitute] =
    useState<PendingSubstitute | null>(null);
  const [pendingCourtClose, setPendingCourtClose] = useState<number | null>(
    null,
  );
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  // header nav links collapse into this on mobile — reused across the
  // 'create' and 'dashboard' headers since only one is ever mounted at once
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const manageNameInputRef = useRef<HTMLInputElement>(null);

  // ---- change PIN ----
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [changePinCurrent, setChangePinCurrent] = useState('');
  const [changePinNew, setChangePinNew] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // ---- private quick-access link (embeds the PIN so opening it skips the
  // PIN gate entirely) — kept separate from the public checkin QR link,
  // which is meant to be shared with every player and must never carry
  // the admin PIN ----
  const [isQuickLinkModalOpen, setIsQuickLinkModalOpen] = useState(false);
  const [quickLinkPin, setQuickLinkPin] = useState('');
  const [quickAccessUrl, setQuickAccessUrl] = useState('');
  const [isGeneratingQuickLink, setIsGeneratingQuickLink] = useState(false);

  // ---- loading state for actions that hit the network (mongo can add a
  // beat of latency, unlike the old localStorage version — show feedback
  // rather than let a button look unresponsive) ----
  const [isGeneratingMatches, setIsGeneratingMatches] = useState(false);
  const [isAddingPlayers, setIsAddingPlayers] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [checkingInPlayerId, setCheckingInPlayerId] = useState<string | null>(
    null,
  );
  const [isSavingPlayerName, setIsSavingPlayerName] = useState(false);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isResettingStats, setIsResettingStats] = useState(false);
  const [pendingCourtAction, setPendingCourtAction] = useState<number | null>(
    null,
  );

  const view: ViewState = !bootstrapped
    ? 'loading'
    : !session
      ? 'create'
      : !isAuthenticated
        ? 'pin'
        : 'dashboard';

  const showSnackbar = ({
    title,
    description,
    variant,
  }: {
    title: string;
    description: string;
    variant: 'success' | 'error' | 'info';
  }) => {
    const options = { description, duration: 3000 };
    if (variant === 'success') {
      toast.success(title, options);
      return;
    }
    if (variant === 'error') {
      toast.error(title, options);
      return;
    }
    toast(title, options);
  };

  // ---- bootstrap: read stored session id, validate it against the server.
  // Also supports a private "quick-access" link (?sid=...&pin=...) that
  // skips the PIN gate entirely — see openQuickLinkModal/generateQuickAccessLink. ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quickSid = params.get('sid');
    const quickPin = params.get('pin');

    if (quickSid && quickPin) {
      // strip immediately: don't leave the PIN sitting in the visible URL,
      // and don't let a later refresh of this same tab keep resubmitting it
      window.history.replaceState(null, '', window.location.pathname);
    }

    const stored = quickSid || window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      setBootstrapped(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const fetched = await getSession(stored);
        if (cancelled) return;
        window.localStorage.setItem(SESSION_STORAGE_KEY, stored);
        setSessionId(stored);
        setSession(fetched);
        setDraftMode(fetched.mode);
        setDraftCourts(fetched.activeCourts.length);
        setDraftTargetScore(fetched.targetScore);

        if (quickSid && quickPin) {
          try {
            await verifySessionPin(stored, quickPin);
            if (!cancelled) setIsAuthenticated(true);
          } catch {
            // stale/wrong PIN embedded in the link — just fall back to the
            // normal PIN gate rather than surfacing an error
          }
        }
      } catch {
        if (cancelled) return;
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- fetch the "pick an existing session" list for the create screen ----
  useEffect(() => {
    if (view !== 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const sessions = await listSessions();
        if (!cancelled) setExistingSessions(sessions);
      } catch {
        // secondary feature — the create form still works without it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view]);

  const refreshAll = async (sid: string) => {
    try {
      const [rawPlayers, rawMatches, rawHistory, freshSession] =
        await Promise.all([
          listSessionPlayers(sid),
          listMatches(sid),
          getPartnerHistory(sid),
          getSession(sid),
        ]);

      const historyMap = Object.fromEntries(
        rawHistory.map((entry) => [entry.pairKey, entry.timesPlayedTogether]),
      );
      const eligiblePlayers = toEligiblePlayers(rawPlayers);
      const activeIds = new Set(
        rawMatches
          .filter((match) => match.status !== 'done')
          .flatMap((match) => [...match.teamA, ...match.teamB]),
      );
      const plan: SessionPlan = {
        mode: freshSession.mode,
        courtIds: freshSession.activeCourts,
      };
      const preview = buildMatchesFromPlayers(
        eligiblePlayers,
        activeIds,
        plan,
        historyMap,
      );

      setSession(freshSession);
      setSessionPlayersRaw(rawPlayers);
      setMatchesRaw(rawMatches);
      setPartnerHistory(historyMap);
      setNextMatches(preview.newMatches);
    } catch (error) {
      showSnackbar({
        title: 'โหลดข้อมูลไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    }
  };

  useEffect(() => {
    if (sessionId && isAuthenticated) {
      refreshAll(sessionId);
    }
  }, [sessionId, isAuthenticated]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!managePlayerDraft) return;
    const input = manageNameInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [managePlayerDraft?.sessionPlayerId]);

  // ---- derived data ----
  // Only checked-in+ players — 'registered' (signed up ahead of time,
  // not yet confirmed at the court) are shown separately below and
  // excluded from the roster/matching pool until they check in.
  const players = useMemo(
    () => toEligiblePlayers(sessionPlayersRaw),
    [sessionPlayersRaw],
  );
  const registeredPlayers = useMemo(
    () =>
      sessionPlayersRaw
        .filter((sessionPlayer) => sessionPlayer.status === 'registered')
        .map(toLocalPlayer),
    [sessionPlayersRaw],
  );
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const activeMatches: HydratedMatch[] = useMemo(() => {
    return matchesRaw
      .filter((match) => match.status !== 'done')
      .map((match) => ({
        matchId: match.id,
        court: match.court,
        mode: match.mode,
        status: match.status,
        statsCounted: match.statsCounted ?? false,
        finishedAt: match.finishedAt ?? null,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        targetScore: match.targetScore,
        gameWinner: match.gameWinner,
        teamA: match.teamA
          .map((playerId) => playerById.get(playerId))
          .filter((player): player is Player => Boolean(player)),
        teamB: match.teamB
          .map((playerId) => playerById.get(playerId))
          .filter((player): player is Player => Boolean(player)),
      }))
      .sort((a, b) => a.court - b.court);
  }, [matchesRaw, playerById]);

  const totalFinishedMatches = useMemo(
    () =>
      matchesRaw.filter(
        (match) => match.status === 'done' && match.statsCounted,
      ).length,
    [matchesRaw],
  );

  const latestFinishedMatch = useMemo(() => {
    const doneWithStats = matchesRaw.filter(
      (match) =>
        match.status === 'done' && match.statsCounted && match.finishedAt,
    );
    if (doneWithStats.length === 0) return null;

    return doneWithStats.reduce((latest, match) =>
      new Date(match.finishedAt!) > new Date(latest.finishedAt!)
        ? match
        : latest,
    );
  }, [matchesRaw]);

  const undoableCourtId = latestFinishedMatch?.court;

  const stats = useMemo(() => {
    const playingCount = activeMatches
      .filter((match) => match.status === 'playing')
      .reduce((sum, match) => sum + match.teamA.length + match.teamB.length, 0);
    const restingRaw = sessionPlayersRaw.filter(
      (sessionPlayer) =>
        sessionPlayer.status !== 'playing' &&
        sessionPlayer.status !== 'registered',
    );

    return {
      playing: playingCount,
      resting: restingRaw.length,
      restingPlayers: restingRaw.map(toLocalPlayer),
    };
  }, [activeMatches, sessionPlayersRaw]);

  const HISTORY_PAGE_SIZE = 8;
  const HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  // Session history only shows sessions created within the last day —
  // older ones are almost certainly not what someone's looking for.
  const recentSessions = useMemo(() => {
    const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
    return existingSessions.filter(
      (existing) =>
        existing.createdAt && new Date(existing.createdAt).getTime() >= cutoff,
    );
  }, [existingSessions]);
  const historyPageCount = Math.max(
    1,
    Math.ceil(recentSessions.length / HISTORY_PAGE_SIZE),
  );
  const historyPageClamped = Math.min(historyPage, historyPageCount - 1);
  const historySessionsPage = recentSessions.slice(
    historyPageClamped * HISTORY_PAGE_SIZE,
    historyPageClamped * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
  );

  const playersPerMatch = getPlayersPerMatch(draftMode);
  const checkinUrl =
    origin && sessionId ? `${origin}/checkin/${sessionId}` : '';
  const displayMode =
    activeMatches.length > 0 ? (session?.mode ?? draftMode) : draftMode;

  // ---- session bootstrap actions ----

  const handleCreateSession = async () => {
    if (!PIN_PATTERN.test(createPin)) {
      showSnackbar({
        title: 'PIN ไม่ถูกต้อง',
        description: 'PIN ต้องเป็นตัวเลข 4-6 หลัก',
        variant: 'error',
      });
      return;
    }

    setIsCreatingSession(true);
    try {
      const name =
        createName.trim() || formatSessionDate(new Date().toISOString());
      const created = await createSession('doubles', createPin, [1], 11, name);
      window.localStorage.setItem(SESSION_STORAGE_KEY, created.id);
      setSessionId(created.id);
      setSession(created);
      setIsAuthenticated(true);
      setDraftMode(created.mode);
      setDraftCourts(created.activeCourts.length);
      setDraftTargetScore(created.targetScore);
      // show the private quick-access link right away, using the PIN we
      // already have on hand — no need to make them re-type it just to
      // confirm, unlike the standalone "ลิงก์ส่วนตัว" flow
      setQuickAccessUrl(`${origin}/?sid=${created.id}&pin=${createPin}`);
      setIsQuickLinkModalOpen(true);
      setCreatePin('');
      setCreateName('');
      setIsCreateModalOpen(false);
    } catch (error) {
      showSnackbar({
        title: 'สร้าง session ไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

  /** Opens the PIN prompt for a session picked from the "existing sessions"
   * list, as a modal on top of the create screen — doesn't touch
   * session/sessionId yet, so the list stays visible/usable behind it and
   * clicking a card never feels like it navigated to a whole new page. */
  const pickExistingSession = (picked: ApiSession) => {
    setUnlockingSession(picked);
    setUnlockPinInput('');
    setUnlockPinError(null);
  };

  const handleUnlockSession = async () => {
    if (!unlockingSession) return;

    setIsUnlockingSession(true);
    setUnlockPinError(null);
    try {
      await verifySessionPin(unlockingSession.id, unlockPinInput);
      window.localStorage.setItem(SESSION_STORAGE_KEY, unlockingSession.id);
      setSessionId(unlockingSession.id);
      setSession(unlockingSession);
      setIsAuthenticated(true);
      setDraftMode(unlockingSession.mode);
      setDraftCourts(unlockingSession.activeCourts.length);
      setDraftTargetScore(unlockingSession.targetScore);
      setUnlockingSession(null);
      setUnlockPinInput('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUnlockPinError('PIN ไม่ถูกต้อง');
      } else {
        setUnlockPinError(getErrorMessage(error));
      }
    } finally {
      setIsUnlockingSession(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!sessionId) return;

    setIsVerifyingPin(true);
    setPinError(null);
    try {
      await verifySessionPin(sessionId, pinInput);
      setIsAuthenticated(true);
      setPinInput('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setPinError('PIN ไม่ถูกต้อง');
      } else {
        setPinError(getErrorMessage(error));
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const openChangePinModal = () => {
    setChangePinCurrent('');
    setChangePinNew('');
    setIsChangePinModalOpen(true);
  };

  const handleChangePin = async () => {
    if (!sessionId) return;
    if (!PIN_PATTERN.test(changePinNew)) {
      showSnackbar({
        title: 'PIN ใหม่ไม่ถูกต้อง',
        description: 'PIN ต้องเป็นตัวเลข 4-6 หลัก',
        variant: 'error',
      });
      return;
    }

    setIsChangingPin(true);
    try {
      await changeSessionPin(sessionId, changePinCurrent, changePinNew);
      setIsChangePinModalOpen(false);
      setChangePinCurrent('');
      setChangePinNew('');
      showSnackbar({
        title: 'เปลี่ยน PIN แล้ว',
        description: 'ใช้ PIN ใหม่ตั้งแต่ครั้งถัดไปที่เข้า session นี้',
        variant: 'success',
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showSnackbar({
          title: 'เปลี่ยน PIN ไม่สำเร็จ',
          description: 'PIN ปัจจุบันไม่ถูกต้อง',
          variant: 'error',
        });
      } else {
        showSnackbar({
          title: 'เปลี่ยน PIN ไม่สำเร็จ',
          description: getErrorMessage(error),
          variant: 'error',
        });
      }
    } finally {
      setIsChangingPin(false);
    }
  };

  const openQuickLinkModal = () => {
    setQuickLinkPin('');
    setQuickAccessUrl('');
    setIsQuickLinkModalOpen(true);
  };

  /** Confirms the PIN (server-side, same as the PIN gate) before embedding
   * it in a URL — the PIN is never kept in state outside this flow, so
   * generating the link is the only way to get it back into plain text. */
  const generateQuickAccessLink = async () => {
    if (!sessionId) return;
    if (!PIN_PATTERN.test(quickLinkPin)) {
      showSnackbar({
        title: 'PIN ไม่ถูกต้อง',
        description: 'PIN ต้องเป็นตัวเลข 4-6 หลัก',
        variant: 'error',
      });
      return;
    }

    setIsGeneratingQuickLink(true);
    try {
      await verifySessionPin(sessionId, quickLinkPin);
      setQuickAccessUrl(`${origin}/?sid=${sessionId}&pin=${quickLinkPin}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showSnackbar({
          title: 'สร้างลิงก์ไม่สำเร็จ',
          description: 'PIN ไม่ถูกต้อง',
          variant: 'error',
        });
      } else {
        showSnackbar({
          title: 'สร้างลิงก์ไม่สำเร็จ',
          description: getErrorMessage(error),
          variant: 'error',
        });
      }
    } finally {
      setIsGeneratingQuickLink(false);
    }
  };

  const forgetSession = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setSession(null);
    setIsAuthenticated(false);
    setSessionPlayersRaw([]);
    setMatchesRaw([]);
    setPartnerHistory({});
    setNextMatches([]);
    setPlanDraft(null);
    setPinInput('');
    setPinError(null);
    toast.dismiss();
  };

  // ---- player management ----

  const addPlayers = async (names: string[]) => {
    if (!sessionId) return;

    setIsAddingPlayers(true);
    try {
      const { accepted, duplicates } = await addSessionPlayers(
        sessionId,
        names,
      );
      await refreshAll(sessionId);

      if (accepted.length > 0 && duplicates.length === 0) {
        toast.dismiss();
        return;
      }
      if (accepted.length === 0) {
        showSnackbar({
          title: 'ชื่อซ้ำ',
          description: `มีผู้เล่นชื่อ "${duplicates[0]}" อยู่แล้ว`,
          variant: 'error',
        });
        return;
      }
      showSnackbar({
        title: `เพิ่มได้ ${accepted.length} คน`,
        description: `ข้ามชื่อซ้ำ ${duplicates.length} คน`,
        variant: 'info',
      });
    } catch (error) {
      showSnackbar({
        title: 'เพิ่มผู้เล่นไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsAddingPlayers(false);
    }
  };

  const removePlayer = async (id: string): Promise<boolean> => {
    if (!sessionId) return false;
    const target = sessionPlayersRaw.find(
      (sessionPlayer) => sessionPlayer.id === id,
    );
    if (!target) return false;

    setDeletingPlayerId(id);
    try {
      await deleteSessionPlayer(sessionId, id);
      await refreshAll(sessionId);
      showSnackbar({
        title: `ลบ ${target.name} แล้ว`,
        description: 'อัปเดตรายการผู้เล่นเรียบร้อย',
        variant: 'info',
      });
      return true;
    } catch (error) {
      showSnackbar({
        title: 'ยังลบผู้เล่นไม่ได้',
        description: getErrorMessage(error),
        variant: 'error',
      });
      return false;
    } finally {
      setDeletingPlayerId(null);
    }
  };

  const checkInPlayerNow = async (id: string) => {
    if (!sessionId) return;
    const target = registeredPlayers.find((player) => player.id === id);
    if (!target) return;

    setCheckingInPlayerId(id);
    try {
      await checkInToSession(sessionId, { sessionPlayerId: id });
      await refreshAll(sessionId);
      showSnackbar({
        title: `เช็คอิน ${target.name} แล้ว`,
        description: 'เข้าคิวสุ่มได้แล้ว',
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'เช็คอินไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setCheckingInPlayerId(null);
    }
  };

  const openManagePlayer = (id: string) => {
    const target = sessionPlayersRaw.find(
      (sessionPlayer) => sessionPlayer.id === id,
    );
    if (!target) return;

    setManagePlayerDraft({
      sessionPlayerId: target.id,
      playerId: target.playerId,
      name: target.name,
    });
  };

  const closeManagePlayer = () => setManagePlayerDraft(null);

  const saveManagedPlayerName = async () => {
    if (!managePlayerDraft || !sessionId) return;

    const trimmedName = managePlayerDraft.name.trim();
    if (!trimmedName) {
      showSnackbar({
        title: 'ชื่อไม่ถูกต้อง',
        description: 'กรุณากรอกชื่อผู้เล่น',
        variant: 'error',
      });
      return;
    }

    if (!managePlayerDraft.playerId) {
      closeManagePlayer();
      return;
    }

    const currentName = sessionPlayersRaw.find(
      (sessionPlayer) => sessionPlayer.id === managePlayerDraft.sessionPlayerId,
    )?.name;
    if (trimmedName === currentName) {
      closeManagePlayer();
      return;
    }

    setIsSavingPlayerName(true);
    try {
      await renamePlayer(managePlayerDraft.playerId, trimmedName);
      await refreshAll(sessionId);
      closeManagePlayer();
      showSnackbar({
        title: 'แก้ชื่อเรียบร้อย',
        description: `${currentName} → ${trimmedName}`,
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'แก้ชื่อไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsSavingPlayerName(false);
    }
  };

  const deleteManagedPlayer = async () => {
    if (!managePlayerDraft) return;
    const didRemove = await removePlayer(managePlayerDraft.sessionPlayerId);
    if (didRemove) closeManagePlayer();
  };

  const requestSubstitutePlayer = (id: string) => {
    const target = players.find((player) => player.id === id);
    if (!target) return;

    const activeMatch = activeMatches.find((match) =>
      [...match.teamA, ...match.teamB].some((player) => player.id === id),
    );
    if (!activeMatch) {
      showSnackbar({
        title: 'เปลี่ยนตัวไม่สำเร็จ',
        description: `${target.name} ไม่ได้อยู่ในแมตช์ปัจจุบัน`,
        variant: 'error',
      });
      return;
    }

    setPendingSubstitute({
      playerId: id,
      playerName: target.name,
      court: activeMatch.court,
    });
  };

  const confirmSubstitute = async () => {
    if (!pendingSubstitute || !sessionId) return;

    const target = pendingSubstitute;
    const activeMatch = activeMatches.find(
      (match) => match.court === target.court,
    );
    if (!activeMatch) {
      setPendingSubstitute(null);
      return;
    }

    const activeIds = new Set(
      activeMatches.flatMap((match) =>
        [...match.teamA, ...match.teamB].map((player) => player.id),
      ),
    );
    const candidatePool = players.filter(
      (player) => !activeIds.has(player.id) && player.id !== target.playerId,
    );
    if (candidatePool.length === 0) {
      setPendingSubstitute(null);
      showSnackbar({
        title: 'ไม่มีคนพักให้แทน',
        description: 'ต้องมีผู้เล่นที่ไม่ได้อยู่ในคอร์ดปัจจุบันอย่างน้อย 1 คน',
        variant: 'error',
      });
      return;
    }

    const replacement = rankCandidates(candidatePool)[0];
    if (!replacement) {
      setPendingSubstitute(null);
      return;
    }

    setIsSubstituting(true);
    try {
      await substituteMatchPlayer(
        sessionId,
        activeMatch.matchId,
        target.playerId,
        replacement.id,
      );
      await refreshAll(sessionId);
      setPendingSubstitute(null);
      showSnackbar({
        title: `แทนผู้เล่น Court ${target.court}`,
        description: `${replacement.name} ลงแทน ${target.playerName} แล้ว (${target.playerName} ไปพัก)`,
        variant: 'success',
      });
    } catch (error) {
      setPendingSubstitute(null);
      showSnackbar({
        title: 'เปลี่ยนตัวไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsSubstituting(false);
    }
  };

  // ---- match lifecycle ----

  const updateMatchStatus = async (court: number, status: MatchStatus) => {
    if (!sessionId) return;
    const activeMatch = activeMatches.find((match) => match.court === court);
    if (!activeMatch) return;

    setPendingCourtAction(court);
    try {
      await updateMatchStatusApi(sessionId, activeMatch.matchId, status);
      await refreshAll(sessionId);
    } catch (error) {
      showSnackbar({
        title: 'อัปเดตสถานะไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setPendingCourtAction(null);
    }
  };

  const changeMatchScore = async (
    court: number,
    team: 'A' | 'B',
    delta: 1 | -1,
  ) => {
    if (!sessionId) return;
    const activeMatch = activeMatches.find((match) => match.court === court);
    if (!activeMatch) return;

    try {
      const updated = await updateMatchScore(
        sessionId,
        activeMatch.matchId,
        team,
        delta,
      );
      // Patch just this match instead of a full refreshAll() so rapid
      // point-by-point tapping stays snappy.
      setMatchesRaw((prev) =>
        prev.map((match) => (match.id === updated.id ? updated : match)),
      );
    } catch (error) {
      showSnackbar({
        title: 'ปรับคะแนนไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    }
  };

  const finishMatch = async (court: number) => {
    if (!sessionId || !session) return;
    const activeMatch = activeMatches.find((match) => match.court === court);
    if (!activeMatch) return;

    setPendingCourtAction(court);
    try {
      await updateMatchStatusApi(sessionId, activeMatch.matchId, 'done');

      if (session.activeCourts.includes(court)) {
        const [freshPlayers, freshMatches, freshHistoryList] =
          await Promise.all([
            listSessionPlayers(sessionId),
            listMatches(sessionId),
            getPartnerHistory(sessionId),
          ]);
        const freshHistory = Object.fromEntries(
          freshHistoryList.map((entry) => [
            entry.pairKey,
            entry.timesPlayedTogether,
          ]),
        );
        const activeIds = new Set(
          freshMatches
            .filter((match) => match.status !== 'done')
            .flatMap((match) => [...match.teamA, ...match.teamB]),
        );
        const localPlayers = toEligiblePlayers(freshPlayers);
        const plan: SessionPlan = { mode: session.mode, courtIds: [court] };
        const { newMatches } = buildMatchesFromPlayers(
          localPlayers,
          activeIds,
          plan,
          freshHistory,
        );
        const nextUp = newMatches.find((match) => match.court === court);

        if (nextUp) {
          await createMatch(sessionId, {
            court,
            mode: session.mode,
            teamAIds: nextUp.teamA.map((player) => player.id),
            teamBIds: nextUp.teamB.map((player) => player.id),
          });
        }
      }

      await refreshAll(sessionId);
      showSnackbar({
        title: `Court ${court} จบแมตช์แล้ว`,
        description: 'อัปเดตสถานะเรียบร้อย',
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'จบแมตช์ไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setPendingCourtAction(null);
    }
  };

  const undoLatestFinishByCourt = async (court: number) => {
    if (
      !sessionId ||
      !latestFinishedMatch ||
      latestFinishedMatch.court !== court
    ) {
      showSnackbar({
        title: 'ยังย้อนกลับคอร์ดนี้ไม่ได้',
        description: 'ย้อนกลับได้เฉพาะคอร์ดที่กดจบล่าสุด',
        variant: 'info',
      });
      return;
    }

    setPendingCourtAction(court);
    try {
      await undoMatchFinish(sessionId, latestFinishedMatch.id);
      await refreshAll(sessionId);
      toast.success('ย้อนกลับคอร์ดแล้ว', { duration: 2500 });
    } catch (error) {
      showSnackbar({
        title: 'ย้อนกลับไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setPendingCourtAction(null);
    }
  };

  const closeCourtNow = async (court: number) => {
    if (!sessionId) return;

    setPendingCourtAction(court);
    try {
      await closeCourtApi(sessionId, court);
      await refreshAll(sessionId);
      showSnackbar({
        title: `ปิด Court ${court} แล้ว`,
        description: 'ย้ายผู้เล่นเข้าคิวรวมกับคอร์ดที่เหลือแล้ว',
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'ปิดคอร์ดไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setPendingCourtAction(null);
    }
  };

  const requestCloseCourt = (court: number) => setPendingCourtClose(court);

  const confirmCloseCourt = async () => {
    if (pendingCourtClose === null) return;
    const court = pendingCourtClose;
    setPendingCourtClose(null);
    await closeCourtNow(court);
  };

  // ---- plan editor ("ปรับรอบถัดไป") ----

  const openPlanEditor = () => {
    if (!session) return;
    setPlanDraft({
      mode: session.mode,
      courtIds: [...session.activeCourts],
      targetScore: session.targetScore,
    });
  };

  const closePlanEditor = () => setPlanDraft(null);

  const setPlanDraftMode = (nextMode: Mode) => {
    setPlanDraft((prev) => (prev ? { ...prev, mode: nextMode } : prev));
  };

  const setPlanDraftTargetScore = (nextTargetScore: number) => {
    setPlanDraft((prev) =>
      prev ? { ...prev, targetScore: nextTargetScore } : prev,
    );
  };

  const togglePlanDraftCourt = (courtId: number) => {
    setPlanDraft((prev) => {
      if (!prev) return prev;
      const nextCourtIds = prev.courtIds.includes(courtId)
        ? prev.courtIds.filter((id) => id !== courtId)
        : [...prev.courtIds, courtId];
      return { ...prev, courtIds: nextCourtIds.toSorted((a, b) => a - b) };
    });
  };

  const saveNextPlan = async () => {
    if (!planDraft || !sessionId) return;

    if (planDraft.courtIds.length === 0) {
      showSnackbar({
        title: 'ยังไม่ได้เลือกคอร์ด',
        description: 'เลือกอย่างน้อย 1 คอร์ดสำหรับรอบถัดไป',
        variant: 'error',
      });
      return;
    }

    const planPlayersPerMatch = getPlayersPerMatch(planDraft.mode);
    const planRequiredPlayers = planPlayersPerMatch * planDraft.courtIds.length;
    if (players.length < planRequiredPlayers) {
      showSnackbar({
        title: 'ผู้เล่นไม่พอสำหรับแผนใหม่',
        description: `ต้องมีอย่างน้อย ${planRequiredPlayers} คนสำหรับ ${formatCourtLabel(planDraft.courtIds)} · ${formatModeLabel(planDraft.mode)}`,
        variant: 'error',
      });
      return;
    }

    setIsSavingPlan(true);
    try {
      await updateSession(sessionId, {
        mode: planDraft.mode,
        activeCourts: planDraft.courtIds,
        targetScore: planDraft.targetScore,
      });

      // A court newly added to the plan has no live match yet — nothing
      // else ever creates one for it (only finishMatch's auto-refill does,
      // and only for a court that already had a match), so it would just
      // sit forever as an empty "next match" preview unless we create one
      // for it right here.
      const existingActiveCourts = new Set(
        activeMatches.map((match) => match.court),
      );
      const emptyCourtIds = planDraft.courtIds.filter(
        (courtId) => !existingActiveCourts.has(courtId),
      );

      if (emptyCourtIds.length > 0) {
        const [freshPlayers, freshMatches, freshHistoryList] =
          await Promise.all([
            listSessionPlayers(sessionId),
            listMatches(sessionId),
            getPartnerHistory(sessionId),
          ]);
        const freshHistory = Object.fromEntries(
          freshHistoryList.map((entry) => [
            entry.pairKey,
            entry.timesPlayedTogether,
          ]),
        );
        const activeIds = new Set(
          freshMatches
            .filter((match) => match.status !== 'done')
            .flatMap((match) => [...match.teamA, ...match.teamB]),
        );
        const localPlayers = toEligiblePlayers(freshPlayers);
        const emptyCourtsPlan: SessionPlan = {
          mode: planDraft.mode,
          courtIds: emptyCourtIds,
        };
        const { newMatches } = buildMatchesFromPlayers(
          localPlayers,
          activeIds,
          emptyCourtsPlan,
          freshHistory,
        );

        for (const match of newMatches) {
          await createMatch(sessionId, {
            court: match.court,
            mode: match.mode,
            teamAIds: match.teamA.map((player) => player.id),
            teamBIds: match.teamB.map((player) => player.id),
          });
        }

        if (newMatches.length < emptyCourtIds.length) {
          await refreshAll(sessionId);
          setPlanDraft(null);
          showSnackbar({
            title: `เปลี่ยนแผนแล้ว แต่จับคู่ได้แค่คอร์ดใหม่ ${newMatches.length}/${emptyCourtIds.length}`,
            description: 'ผู้เล่นที่ว่างไม่พอสำหรับคอร์ดใหม่ทั้งหมด',
            variant: 'info',
          });
          return;
        }
      }

      await refreshAll(sessionId);
      setPlanDraft(null);
      showSnackbar({
        title: 'เปลี่ยนแผนรอบถัดไปแล้ว',
        description: 'คู่ถัดไปเดิมถูกจัดใหม่ตามแผนใหม่แล้ว',
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'เปลี่ยนแผนไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsSavingPlan(false);
    }
  };

  // ---- first round ----

  const handleModeChange = (nextMode: Mode) => setDraftMode(nextMode);

  const handleCourtCountChange = (nextCourts: number) => {
    setDraftCourts(Math.min(Math.max(nextCourts, 1), MAX_COURTS));
  };

  const generateMatches = async () => {
    if (!sessionId) return;

    if (activeMatches.length > 0) {
      showSnackbar({
        title: 'กำลังแข่งขันอยู่',
        description: 'ระบบจะเลื่อนแมตช์ถัดไปให้อัตโนมัติเมื่อจบครบทุกคอร์ด',
        variant: 'info',
      });
      return;
    }

    if (players.length < playersPerMatch) {
      showSnackbar({
        title: 'ผู้เล่นไม่พอ',
        description: `ต้องมีอย่างน้อย ${playersPerMatch} คนสำหรับ ${draftMode === 'singles' ? 'Singles' : 'Doubles'}`,
        variant: 'error',
      });
      return;
    }

    const courtIds = getCourtIds(draftCourts);

    setIsGeneratingMatches(true);
    try {
      await updateSession(sessionId, {
        mode: draftMode,
        activeCourts: courtIds,
        targetScore: draftTargetScore,
      });

      const [freshPlayers, freshHistoryList] = await Promise.all([
        listSessionPlayers(sessionId),
        getPartnerHistory(sessionId),
      ]);
      const freshHistory = Object.fromEntries(
        freshHistoryList.map((entry) => [
          entry.pairKey,
          entry.timesPlayedTogether,
        ]),
      );
      const localPlayers = toEligiblePlayers(freshPlayers);
      const plan: SessionPlan = { mode: draftMode, courtIds };
      const { newMatches } = buildMatchesFromPlayers(
        localPlayers,
        new Set(),
        plan,
        freshHistory,
      );

      if (newMatches.length === 0) {
        showSnackbar({
          title: 'จับคู่ไม่สำเร็จ',
          description: 'ผู้เล่นไม่พอสำหรับคอร์ดที่เลือก',
          variant: 'error',
        });
        return;
      }

      for (const match of newMatches) {
        await createMatch(sessionId, {
          court: match.court,
          mode: match.mode,
          teamAIds: match.teamA.map((player) => player.id),
          teamBIds: match.teamB.map((player) => player.id),
        });
      }

      await refreshAll(sessionId);

      if (newMatches.length < courtIds.length) {
        showSnackbar({
          title: `จับคู่ได้ ${newMatches.length}/${courtIds.length} คอร์ด`,
          description: 'เพิ่มผู้เล่นเพื่อใช้ทุกคอร์ด',
          variant: 'info',
        });
        return;
      }

      toast.dismiss();
    } catch (error) {
      showSnackbar({
        title: 'จับคู่ไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsGeneratingMatches(false);
    }
  };

  const resetStats = async () => {
    if (!sessionId) return;

    setIsResettingStats(true);
    try {
      await resetSessionStats(sessionId);
      await refreshAll(sessionId);
      showSnackbar({
        title: 'รีเซ็ตเรียบร้อย',
        description: 'ล้างสถิติและแมตช์ทั้งหมด',
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'รีเซ็ตไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsResettingStats(false);
    }
  };

  const requestClearAll = () => setIsClearAllConfirmOpen(true);

  const confirmClearAll = () => {
    forgetSession();
    setIsClearAllConfirmOpen(false);
  };

  const managedPlayer = managePlayerDraft
    ? players.find((player) => player.id === managePlayerDraft.sessionPlayerId)
    : null;
  const managedPlayerActiveMatch = managedPlayer
    ? activeMatches.find((match) =>
        [...match.teamA, ...match.teamB].some(
          (player) => player.id === managedPlayer.id,
        ),
      )
    : null;

  // ---- render ----

  if (view === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-surface">
        <Icon
          icon="mdi:badminton"
          width="32"
          height="32"
          className="animate-shuttle text-primary"
        />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-dvh bg-gradient-surface pb-24">
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-foreground">
                  สร้าง session ใหม่
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="ปิด"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-5">
                <div className="space-y-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ตั้งชื่อ session (ไม่บังคับ)
                  </p>
                  <Input
                    value={createName}
                    onChange={(event) =>
                      setCreateName(event.target.value.slice(0, 60))
                    }
                    placeholder="ไม่ตั้งจะใช้วันที่แทน เช่น ซ้อมวันจันทร์"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ตั้ง PIN สำหรับแอดมิน (4-6 หลัก)
                  </p>
                  <Input
                    value={createPin}
                    onChange={(event) =>
                      setCreatePin(
                        event.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleCreateSession();
                      }
                    }}
                    type="password"
                    inputMode="numeric"
                    placeholder="เช่น 1234"
                    className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
                  />
                  <p className="text-xs text-muted-foreground">
                    ใครมี PIN นี้จะจับคู่/จบแมตช์/ปิดคอร์ดได้
                    เก็บไว้ให้ทีมงานเท่านั้น
                  </p>
                </div>

                <Button
                  type="button"
                  data-testid="submit-create-session"
                  onClick={handleCreateSession}
                  disabled={isCreatingSession}
                  className="h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90"
                >
                  {isCreatingSession ? 'กำลังสร้าง...' : 'สร้าง session'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  เลือกรูปแบบการแข่งขัน/จำนวนคอร์ด/คะแนนเป้าหมายได้ทีหลัง
                  ก่อนเริ่มจับคู่ครั้งแรก
                </p>
              </div>
            </div>
          </div>
        )}

        {unlockingSession && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
            onClick={() => setUnlockingSession(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-foreground">
                  ใส่ PIN เพื่อเข้าใช้งาน
                </h3>
                <button
                  type="button"
                  onClick={() => setUnlockingSession(null)}
                  aria-label="ปิด"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {unlockingSession.name}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {`${formatModeLabel(unlockingSession.mode)} · ${formatSessionDate(unlockingSession.createdAt)}`}
              </p>

              <div className="mt-5 space-y-2">
                <Input
                  value={unlockPinInput}
                  onChange={(event) => {
                    setUnlockPinInput(
                      event.target.value.replace(/\D/g, '').slice(0, 6),
                    );
                    setUnlockPinError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleUnlockSession();
                    }
                  }}
                  type="password"
                  inputMode="numeric"
                  placeholder="ใส่ PIN เพื่อเข้าใช้งาน"
                  className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
                />
                {unlockPinError && (
                  <p className="text-xs font-medium text-destructive">
                    {unlockPinError}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleUnlockSession}
                disabled={isUnlockingSession || unlockPinInput.length === 0}
                className="mt-4 h-12 w-full rounded-2xl bg-primary font-display font-extrabold text-primary-foreground hover:bg-primary/90"
              >
                {isUnlockingSession ? 'กำลังตรวจสอบ...' : 'เข้าใช้งาน'}
              </Button>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark">
                <Icon
                  icon="mdi:badminton"
                  width="20"
                  height="20"
                  className="animate-shuttle text-primary"
                />
              </div>
              <div>
                <h1 className="font-display text-base font-extrabold leading-tight text-foreground">
                  Badminton Matcher
                </h1>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Fair · Fast · Fun · {APP_VERSION}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden items-center gap-1.5 sm:flex">
                <Link
                  href="/board"
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                >
                  <Newspaper className="h-3.5 w-3.5" />
                  กระดานข่าว
                </Link>
                <Link
                  href="/how-to-use"
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  วิธีใช้งาน
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                aria-label="เมนู"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground sm:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 font-display text-xs font-bold text-primary-foreground transition-smooth hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">สร้าง session</span>
              </button>
            </div>
          </div>
        </header>

        {/* rendered as a sibling of <header>, not nested inside it — header's
        backdrop-blur-lg makes it a containing block for fixed descendants,
        which would clip a fixed inset-0 backdrop to the header's own box */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30 sm:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed right-3 top-16 z-40 w-48 rounded-2xl border border-border bg-card p-1.5 shadow-dark sm:hidden">
              <Link
                href="/board"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-muted"
              >
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                กระดานข่าว
              </Link>
              <Link
                href="/how-to-use"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-muted"
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                วิธีใช้งาน
              </Link>
            </div>
          </>
        )}

        <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-8">
          <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <h2 className="mb-4 font-display text-base font-extrabold text-foreground">
              Session ล่าสุด
            </h2>

            {recentSessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-xs font-medium text-muted-foreground">
                ยังไม่มี session ที่สร้างภายใน 1 วันที่ผ่านมา — กด &quot;สร้าง
                session&quot; มุมขวาบนเพื่อเริ่มสร้างใหม่
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {historySessionsPage.map((existing) => (
                    <button
                      key={existing.id}
                      type="button"
                      onClick={() => pickExistingSession(existing)}
                      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted/40 p-3 text-center transition-smooth hover:bg-muted"
                    >
                      <p className="line-clamp-2 font-display text-xs font-bold text-foreground">
                        {existing.name || formatSessionDate(existing.createdAt)}
                      </p>
                      <p className="font-display text-[10px] font-semibold text-muted-foreground">
                        {existing.mode === 'singles' ? '1v1' : '2v2'} ·{' '}
                        {existing.activeCourts.length} คอร์ด
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSessionDate(existing.createdAt)}
                        {existing.status === 'closed' ? ' · ปิดแล้ว' : ''}
                      </p>
                    </button>
                  ))}
                </div>

                {historyPageCount > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={historyPageClamped === 0}
                      onClick={() => setHistoryPage((page) => page - 1)}
                      className="h-8 rounded-full px-3 font-display text-xs font-bold"
                    >
                      ก่อนหน้า
                    </Button>
                    <span className="font-display text-[11px] font-medium text-muted-foreground">
                      หน้า {historyPageClamped + 1}/{historyPageCount}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={historyPageClamped >= historyPageCount - 1}
                      onClick={() => setHistoryPage((page) => page + 1)}
                      className="h-8 rounded-full px-3 font-display text-xs font-bold"
                    >
                      ถัดไป
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-md px-4 py-3 pb-4">
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                <span>Powered by</span>
                <span className="ml-1 font-display font-bold text-foreground">
                  MiraLabs.Dev
                </span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (view === 'pin') {
    return (
      <div className="min-h-dvh bg-gradient-surface">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
            <h1 className="font-display text-lg font-extrabold text-foreground">
              ใส่ PIN เพื่อเข้าใช้งาน
            </h1>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {session?.name}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {session
                ? `${formatModeLabel(session.mode)} · ${formatSessionDate(session.createdAt)}`
                : ''}
            </p>

            <div className="mt-5 space-y-2">
              <Input
                value={pinInput}
                onChange={(event) => {
                  setPinInput(
                    event.target.value.replace(/\D/g, '').slice(0, 6),
                  );
                  setPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleVerifyPin();
                  }
                }}
                type="password"
                inputMode="numeric"
                placeholder="PIN"
                className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
              />
              {pinError && (
                <p className="text-xs font-medium text-destructive">
                  {pinError}
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleVerifyPin}
              disabled={isVerifyingPin || pinInput.length === 0}
              className="mt-4 h-12 w-full rounded-2xl bg-primary font-display font-extrabold text-primary-foreground hover:bg-primary/90"
            >
              {isVerifyingPin ? 'กำลังตรวจสอบ...' : 'เข้าใช้งาน'}
            </Button>

            <button
              type="button"
              onClick={forgetSession}
              className="mt-4 w-full text-center text-xs font-medium text-muted-foreground underline underline-offset-2"
            >
              ไม่ใช่ session นี้ เริ่ม session ใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-surface pb-24">
      {managePlayerDraft && managedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={closeManagePlayer}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-foreground">
              จัดการผู้เล่น
            </h3>

            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                แก้ไขชื่อ
              </p>
              <Input
                ref={manageNameInputRef}
                value={managePlayerDraft.name}
                onChange={(event) =>
                  setManagePlayerDraft((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveManagedPlayerName();
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeManagePlayer();
                  }
                }}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closeManagePlayer}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={saveManagedPlayerName}
                disabled={isSavingPlayerName}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                {isSavingPlayerName && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                บันทึกชื่อ
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
              {managedPlayerActiveMatch ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {`${managedPlayer.name} กำลังอยู่ใน Court ${managedPlayerActiveMatch.court} ต้องเปลี่ยนตัวก่อนจึงจะลบได้`}
                </p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  ลบผู้เล่นออกจากรายการถาวร
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={deleteManagedPlayer}
                disabled={
                  Boolean(managedPlayerActiveMatch) ||
                  deletingPlayerId === managePlayerDraft?.sessionPlayerId
                }
                className="mt-2 w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deletingPlayerId === managePlayerDraft?.sessionPlayerId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                ลบผู้เล่น
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingSubstitute && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={() => setPendingSubstitute(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-foreground">
              ยืนยันเปลี่ยนตัวผู้เล่น
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {`${pendingSubstitute.playerName} กำลังอยู่ใน Court ${pendingSubstitute.court} ถ้าดำเนินการต่อ ระบบจะสุ่มผู้เล่นที่กำลังพักมาเปลี่ยนแทนทันที โดยผู้เล่นเดิมจะไปพัก`}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingSubstitute(null)}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={confirmSubstitute}
                disabled={isSubstituting}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                {isSubstituting && <Loader2 className="h-4 w-4 animate-spin" />}
                ยืนยันและสุ่มแทน
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingCourtClose !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={() => setPendingCourtClose(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-foreground">
              ยืนยันปิด Court {pendingCourtClose}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {`ระบบจะจบแมตช์ที่กำลังเล่นอยู่ใน Court ${pendingCourtClose} ทันที ปิดคอร์ดนี้ถาวรสำหรับรอบนี้ และย้ายผู้เล่นทั้งหมดไปรวมคิวกับคอร์ดที่เหลือ`}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingCourtClose(null)}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={confirmCloseCourt}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                ยืนยันปิดคอร์ด
              </Button>
            </div>
          </div>
        </div>
      )}

      {planDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={() => setPlanDraft(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-foreground">
              ปรับรอบถัดไป
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              เกมที่กำลังเล่นอยู่จะไม่เปลี่ยน ระบบจะใช้แผนนี้ตอนเติมคู่ถัดไป
            </p>

            <div className="mt-5 space-y-5">
              <ModeSelector
                value={planDraft.mode}
                onChange={setPlanDraftMode}
              />
              <TargetScoreSelector
                value={planDraft.targetScore}
                onChange={setPlanDraftTargetScore}
              />

              <div className="space-y-2">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  เลือกคอร์ดที่จะใช้ต่อ
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {getCourtIds(MAX_COURTS).map((courtId) => {
                    const active = planDraft.courtIds.includes(courtId);
                    return (
                      <Button
                        key={courtId}
                        type="button"
                        variant="outline"
                        onClick={() => togglePlanDraftCourt(courtId)}
                        className={cn(
                          'h-11 rounded-xl font-display text-xs font-bold',
                          active
                            ? 'border-secondary bg-secondary text-primary hover:bg-secondary hover:text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        Court {courtId}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <p className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>รอบถัดไป:</span>
                <span className="ml-1 font-display font-bold text-foreground">
                  {`${planDraft.courtIds.length > 0 ? formatCourtLabel(planDraft.courtIds) : 'ยังไม่เลือกคอร์ด'} · ${formatModeLabel(planDraft.mode)}`}
                </span>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closePlanEditor}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={saveNextPlan}
                disabled={planDraft.courtIds.length === 0 || isSavingPlan}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                {isSavingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
                บันทึกแผน
              </Button>
            </div>
          </div>
        </div>
      )}

      {isClearAllConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={() => setIsClearAllConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-extrabold text-foreground">
              ยืนยันออกจาก session นี้
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              จะไม่ลบข้อมูลบนเซิร์ฟเวอร์ แค่ลืม session นี้บนเครื่องนี้เท่านั้น
              ครั้งหน้าจะต้องสร้างหรือเข้า session ใหม่
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={confirmClearAll}
                className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                ออกจาก session
              </Button>
            </div>
          </div>
        </div>
      )}

      {isChangePinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={() => setIsChangePinModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-foreground">
                เปลี่ยน PIN
              </h3>
              <button
                type="button"
                onClick={() => setIsChangePinModalOpen(false)}
                aria-label="ปิด"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ใช้เมื่ออยากเปลี่ยน PIN ของ session นี้ ข้อมูลอื่นในนี้ไม่กระทบ
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PIN ปัจจุบัน
                </p>
                <Input
                  value={changePinCurrent}
                  onChange={(event) =>
                    setChangePinCurrent(
                      event.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN ปัจจุบัน"
                  className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
                />
              </div>
              <div className="space-y-2">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PIN ใหม่ (4-6 หลัก)
                </p>
                <Input
                  value={changePinNew}
                  onChange={(event) =>
                    setChangePinNew(
                      event.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleChangePin();
                    }
                  }}
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN ใหม่"
                  className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsChangePinModalOpen(false)}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={handleChangePin}
                disabled={isChangingPin || !changePinCurrent || !changePinNew}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                {isChangingPin ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isChangingPin ? 'กำลังเปลี่ยน...' : 'เปลี่ยน PIN'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isQuickLinkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          onClick={() => setIsQuickLinkModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-foreground">
                ลิงก์เข้าใช้งานส่วนตัว
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickLinkModalOpen(false)}
                aria-label="ปิด"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ลิงก์นี้เปิดแล้วเข้า dashboard ได้เลยโดยไม่ต้องพิมพ์ PIN —
              เก็บไว้ส่วนตัวเท่านั้น (บันทึกในโน้ต/ส่งเข้าแชทตัวเอง)
              ห้ามแชร์ให้ผู้เล่น เพราะมีค่าเหมือนรู้ PIN ของ session นี้
            </p>

            {!quickAccessUrl ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    ยืนยัน PIN ปัจจุบันก่อนสร้างลิงก์
                  </p>
                  <Input
                    value={quickLinkPin}
                    onChange={(event) =>
                      setQuickLinkPin(
                        event.target.value.replace(/\D/g, '').slice(0, 6),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        generateQuickAccessLink();
                      }
                    }}
                    type="password"
                    inputMode="numeric"
                    placeholder="PIN"
                    className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsQuickLinkModalOpen(false)}
                    className="rounded-xl"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    onClick={generateQuickAccessLink}
                    disabled={isGeneratingQuickLink || !quickLinkPin}
                    className="rounded-xl bg-primary text-primary-foreground"
                  >
                    {isGeneratingQuickLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {isGeneratingQuickLink ? 'กำลังสร้าง...' : 'สร้างลิงก์'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Input
                  readOnly
                  value={quickAccessUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-11 rounded-xl text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(quickAccessUrl);
                        toast.success('คัดลอกลิงก์แล้ว');
                      } catch {
                        toast.error('คัดลอกไม่สำเร็จ');
                      }
                    }}
                    className="h-11 flex-1 rounded-xl text-xs font-bold"
                  >
                    คัดลอกลิงก์
                  </Button>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: 'ลิงก์เข้าใช้งานส่วนตัว — Badminton Matcher',
                            url: quickAccessUrl,
                          });
                        } catch {
                          // ผู้ใช้กดยกเลิก share sheet เอง — ไม่ต้องแจ้ง error
                        }
                      }}
                      className="h-11 shrink-0 rounded-xl px-3 text-xs font-bold"
                      aria-label="แชร์ลิงก์"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      แชร์
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark">
              <Icon
                icon="mdi:badminton"
                width="20"
                height="20"
                className="animate-shuttle text-primary"
              />
            </div>
            <div>
              <h1 className="truncate font-display text-base font-extrabold leading-tight text-foreground">
                {session?.name || 'Badminton Matcher'}
              </h1>
              <p className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {session
                  ? formatSessionDate(session.createdAt)
                  : `Fair · Fast · Fun · ${APP_VERSION}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="hidden items-center gap-1.5 sm:flex">
              {sessionId && (
                <Link
                  href={`/scoreboard/${sessionId}`}
                  target="_blank"
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                >
                  <Tv className="h-3.5 w-3.5" />
                  จอคะแนนสด
                </Link>
              )}
              <Link
                href="/board"
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <Newspaper className="h-3.5 w-3.5" />
                กระดานข่าว
              </Link>
              <Link
                href="/how-to-use"
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                วิธีใช้งาน
              </Link>
              <button
                type="button"
                onClick={requestClearAll}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                ออกจาก session
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label="เมนู"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground sm:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* rendered as a sibling of <header>, not nested inside it — header's
      backdrop-blur-lg makes it a containing block for fixed descendants,
      which would clip a fixed inset-0 backdrop to the header's own box */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed right-3 top-16 z-40 w-52 rounded-2xl border border-border bg-card p-1.5 shadow-dark sm:hidden">
            {sessionId && (
              <Link
                href={`/scoreboard/${sessionId}`}
                target="_blank"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-muted"
              >
                <Tv className="h-4 w-4 text-muted-foreground" />
                จอคะแนนสด
              </Link>
            )}
            <Link
              href="/board"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-muted"
            >
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              กระดานข่าว
            </Link>
            <Link
              href="/how-to-use"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-muted"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              วิธีใช้งาน
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                requestClearAll();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-destructive transition-smooth hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              ออกจาก session
            </button>
          </div>
        </>
      )}

      <main className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon
                icon="mdi:qrcode"
                width="16"
                height="16"
                className="text-muted-foreground"
              />
              <h3 className="font-display text-sm font-bold text-foreground">
                ลิงก์ลงชื่อ/เช็คอินด้วยตัวเอง
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openQuickLinkModal}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <Link2 className="h-3 w-3" />
                ลิงก์ส่วนตัว
              </button>
              <button
                type="button"
                onClick={openChangePinModal}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <KeyRound className="h-3 w-3" />
                เปลี่ยน PIN
              </button>
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            ให้ผู้เล่นสแกน QR
            หรือเปิดลิงก์นี้เพื่อลงชื่อล่วงหน้าหรือเช็คอินเองได้ ไม่ต้องมี PIN
          </p>
          {checkinUrl && (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <QrCode
                value={checkinUrl}
                size={140}
                className="rounded-xl border border-border"
              />
              <div className="flex w-full flex-1 flex-col gap-2">
                <Input
                  readOnly
                  value={checkinUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-11 rounded-xl text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(checkinUrl);
                        toast.success('คัดลอกลิงก์แล้ว');
                      } catch {
                        toast.error('คัดลอกไม่สำเร็จ');
                      }
                    }}
                    className="h-11 flex-1 rounded-xl text-xs font-bold"
                  >
                    คัดลอกลิงก์
                  </Button>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: 'ลงชื่อ/เช็คอิน Badminton Matcher',
                            url: checkinUrl,
                          });
                        } catch {
                          // ผู้ใช้กดยกเลิก share sheet เอง — ไม่ต้องแจ้ง error
                        }
                      }}
                      className="h-11 shrink-0 rounded-xl px-3 text-xs font-bold"
                      aria-label="แชร์ลิงก์"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      แชร์
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {activeMatches.length === 0 && (
          <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <div className="space-y-5">
              <p className="text-xs font-medium text-muted-foreground">
                เพิ่มผู้เล่นให้พอสำหรับ 1 แมตช์ก่อน แล้วค่อยเลือก
                Singles/Doubles กับจำนวนคอร์ด
              </p>
              <ModeSelector value={draftMode} onChange={handleModeChange} />
              <CourtSelector
                value={draftCourts}
                onChange={handleCourtCountChange}
              />
              <TargetScoreSelector
                value={draftTargetScore}
                onChange={setDraftTargetScore}
              />
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <PlayerList
            players={players}
            onAddMany={addPlayers}
            onManage={openManagePlayer}
            isAdding={isAddingPlayers}
          />
        </section>

        {registeredPlayers.length > 0 && (
          <section className="rounded-3xl border border-secondary/50 bg-secondary/10 p-4 shadow-soft sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground">
                รอเช็คอิน
              </h3>
              <span className="rounded-full bg-card px-2.5 py-1 font-display text-xs font-semibold text-muted-foreground">
                {registeredPlayers.length} คน
              </span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              ลงชื่อล่วงหน้าไว้ แต่ยังไม่ยืนยันว่าถึงคอร์ดแล้ว —
              ยังไม่เข้าคิวสุ่มจนกว่าจะเช็คอิน
            </p>
            <div className="flex flex-wrap gap-2">
              {registeredPlayers.map((player) => {
                const isCheckingIn = checkingInPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => checkInPlayerNow(player.id)}
                    disabled={isCheckingIn}
                    className="flex items-center gap-1.5 rounded-full bg-card py-1.5 pl-3 pr-2.5 font-display text-sm font-semibold text-foreground shadow-sm transition-smooth hover:bg-secondary/20 disabled:opacity-60"
                  >
                    {player.name}
                    <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      {isCheckingIn && (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      )}
                      เช็คอิน
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeMatches.length === 0 && (
          <Button
            type="button"
            onClick={generateMatches}
            disabled={players.length < playersPerMatch || isGeneratingMatches}
            className="h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90"
          >
            {isGeneratingMatches && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            เริ่มจับคู่
          </Button>
        )}

        {activeMatches.length > 0 && (
          <section className="rounded-3xl border border-border/70 bg-card p-4 sm:p-6">
            <MatchBoard
              matches={activeMatches}
              mode={displayMode}
              nextMatches={nextMatches}
              restingPlayers={stats.restingPlayers}
              onStatusChange={updateMatchStatus}
              onFinish={finishMatch}
              onCloseCourt={requestCloseCourt}
              onSubstitutePlayer={requestSubstitutePlayer}
              onScoreChange={changeMatchScore}
              undoableCourtId={undoableCourtId}
              onUndoCourtFinish={undoLatestFinishByCourt}
              onOpenPlanEditor={openPlanEditor}
              onResetStats={resetStats}
              isResettingStats={isResettingStats}
              pendingCourt={pendingCourtAction}
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-2xl border border-border/60 bg-muted/35 px-3 py-2.5 text-[11px] text-muted-foreground/90">
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-muted-foreground/90">
                  กำลังเล่น:
                </span>
                <span className="font-display font-bold text-foreground/90">
                  {stats.playing}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-muted-foreground/90">
                  พักอยู่:
                </span>
                <span className="font-display font-bold text-foreground/90">
                  {stats.resting}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-muted-foreground/90">
                  จบแล้ว:
                </span>
                <span className="font-display font-bold text-foreground/90">
                  {totalFinishedMatches}
                </span>
              </span>
            </div>
          </section>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-md px-4 py-3 pb-4">
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              <span>Powered by</span>
              <span className="ml-1 font-display font-bold text-foreground">
                MiraLabs.Dev
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
