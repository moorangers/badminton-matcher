'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import {
  HelpCircle,
  ImagePlus,
  Newspaper,
  RefreshCw,
  Trash2,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_VERSION } from '@/lib/appVersion';
import { cn } from '@/lib/utils';
import {
  ApiError,
  addSessionPlayers,
  checkInToSession,
  closeCourt as closeCourtApi,
  createMatch,
  createSession,
  deleteSessionPlayer,
  getPartnerHistory,
  getSession,
  listMatches,
  listSessionPlayers,
  renamePlayer,
  resetSessionStats,
  substituteMatchPlayer,
  undoMatchFinish,
  updateMatchStatus as updateMatchStatusApi,
  updateSession,
  verifySessionPin,
  type ApiMatch,
  type ApiSession,
  type ApiSessionPlayer,
} from '@/lib/api/sessionApi';
import {
  createPost,
  deletePost,
  listPosts,
  uploadPostPhoto,
  type ApiPost,
} from '@/lib/api/postsApi';

const SESSION_STORAGE_KEY = 'bm_session_id';
const MAX_COURTS = 3;
const PIN_PATTERN = /^\d{4,6}$/;

type SessionPlan = { mode: Mode; courtIds: number[] };

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

const getPlayersPerMatch = (sourceMode: Mode) => {
  return sourceMode === 'singles' ? 2 : 4;
};

const formatModeLabel = (sourceMode: Mode) => {
  return sourceMode === 'singles' ? 'Singles (1v1)' : 'Doubles (2v2)';
};

const formatCourtLabel = (courtIds: number[]) => {
  return courtIds.map((courtId) => `Court ${courtId}`).join(', ');
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

// ---- pure matching algorithm (unchanged from Phase 1, just no longer reads component state via closure) ----

const shufflePlayers = (sourcePlayers: Player[]) => {
  const output = [...sourcePlayers];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
};

const rankCandidates = (sourcePlayers: Player[]) => {
  return shufflePlayers(sourcePlayers).sort((a, b) => {
    if (a.matches !== b.matches) return a.matches - b.matches;
    return (a.queuedAt ?? 0) - (b.queuedAt ?? 0);
  });
};

const getPairKey = (idA: string, idB: string) => [idA, idB].sort().join('_');

const DOUBLES_PARTNER_COMBOS: [[number, number], [number, number]][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

const assignTeams = (slice: Player[], history: Record<string, number>) => {
  const half = slice.length / 2;

  if (slice.length !== 4) {
    return { teamA: slice.slice(0, half), teamB: slice.slice(half) };
  }

  const options = DOUBLES_PARTNER_COMBOS.map(([teamAIdx, teamBIdx]) => {
    const teamA = teamAIdx.map((i) => slice[i]);
    const teamB = teamBIdx.map((i) => slice[i]);
    const score =
      (history[getPairKey(teamA[0].id, teamA[1].id)] ?? 0) +
      (history[getPairKey(teamB[0].id, teamB[1].id)] ?? 0);

    return { teamA, teamB, score };
  });

  const lowestScore = Math.min(...options.map((option) => option.score));
  const bestOptions = options.filter((option) => option.score === lowestScore);
  const picked = bestOptions[Math.floor(Math.random() * bestOptions.length)];

  return { teamA: picked.teamA, teamB: picked.teamB };
};

const buildMatchesFromPlayers = (
  sourcePlayers: Player[],
  blockedIds: Set<string>,
  plan: SessionPlan,
  history: Record<string, number>,
) => {
  const planPlayersPerMatch = getPlayersPerMatch(plan.mode);
  const availablePlayers = sourcePlayers.filter(
    (player) => !blockedIds.has(player.id),
  );
  const pool = rankCandidates(availablePlayers);

  const newMatches: Match[] = [];
  const used = new Set<string>();

  for (const courtId of plan.courtIds) {
    const slice = pool
      .filter((player) => !used.has(player.id))
      .slice(0, planPlayersPerMatch);
    if (slice.length < planPlayersPerMatch) {
      break;
    }

    slice.forEach((player) => used.add(player.id));

    const { teamA, teamB } = assignTeams(slice, history);
    newMatches.push({ court: courtId, mode: plan.mode, teamA, teamB, status: 'ready' });
  }

  return { newMatches, used };
};

export function HomePage() {
  // ---- session bootstrap ----
  const [bootstrapped, setBootstrapped] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [origin, setOrigin] = useState('');

  // ---- create-session form ----
  const [createMode, setCreateMode] = useState<Mode>('doubles');
  const [createCourts, setCreateCourts] = useState(1);
  const [createPin, setCreatePin] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // ---- pin gate ----
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // ---- server-backed data ----
  const [sessionPlayersRaw, setSessionPlayersRaw] = useState<
    ApiSessionPlayer[]
  >([]);
  const [matchesRaw, setMatchesRaw] = useState<ApiMatch[]>([]);
  const [partnerHistory, setPartnerHistory] = useState<Record<string, number>>(
    {},
  );
  const [nextMatches, setNextMatches] = useState<Match[]>([]);

  // ---- webboard (Phase 3) ----
  const [recentPosts, setRecentPosts] = useState<ApiPost[]>([]);
  const [postText, setPostText] = useState('');
  const [postPhotoFiles, setPostPhotoFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  // ---- pre-game draft (only used while there are no active matches yet) ----
  const [draftMode, setDraftMode] = useState<Mode>('doubles');
  const [draftCourts, setDraftCourts] = useState(1);

  // ---- misc UI state (same shape as before) ----
  const [managePlayerDraft, setManagePlayerDraft] =
    useState<ManagePlayerDraft | null>(null);
  const [pendingSubstitute, setPendingSubstitute] =
    useState<PendingSubstitute | null>(null);
  const [pendingCourtClose, setPendingCourtClose] = useState<number | null>(
    null,
  );
  const [planDraft, setPlanDraft] = useState<SessionPlan | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const manageNameInputRef = useRef<HTMLInputElement>(null);

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

  // ---- bootstrap: read stored session id, validate it against the server ----
  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      setBootstrapped(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const fetched = await getSession(stored);
        if (cancelled) return;
        setSessionId(stored);
        setSession(fetched);
        setDraftMode(fetched.mode);
        setDraftCourts(fetched.activeCourts.length);
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

  const refreshPosts = async () => {
    try {
      const { posts } = await listPosts();
      setRecentPosts(posts.slice(0, 5));
    } catch {
      // webboard is a secondary feature — fail quietly, main dashboard
      // still works without it
    }
  };

  useEffect(() => {
    if (sessionId && isAuthenticated) {
      refreshAll(sessionId);
      refreshPosts();
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
      matchesRaw.filter((match) => match.status === 'done' && match.statsCounted)
        .length,
    [matchesRaw],
  );

  const latestFinishedMatch = useMemo(() => {
    const doneWithStats = matchesRaw.filter(
      (match) => match.status === 'done' && match.statsCounted && match.finishedAt,
    );
    if (doneWithStats.length === 0) return null;

    return doneWithStats.reduce((latest, match) =>
      new Date(match.finishedAt!) > new Date(latest.finishedAt!) ? match : latest,
    );
  }, [matchesRaw]);

  const undoableCourtId = latestFinishedMatch?.court;

  const currentSessionSummary = useMemo(() => {
    if (activeMatches.length === 0) return undefined;

    const courtIds = Array.from(
      new Set(activeMatches.map((match) => match.court)),
    ).sort((a, b) => a - b);
    const modes = Array.from(new Set(activeMatches.map((match) => match.mode)));
    const modeLabel =
      modes.length === 1 ? formatModeLabel(modes[0]) : 'Mixed mode';

    return `${formatCourtLabel(courtIds)} · ${modeLabel}`;
  }, [activeMatches]);

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

  const playersPerMatch = getPlayersPerMatch(draftMode);
  const checkinUrl = origin && sessionId ? `${origin}/checkin/${sessionId}` : '';
  const displayMode =
    activeMatches.length > 0 ? (session?.mode ?? draftMode) : draftMode;
  const displayCourts =
    activeMatches.length > 0
      ? (session?.activeCourts.length ?? draftCourts)
      : draftCourts;

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
      const courtIds = getCourtIds(createCourts);
      const created = await createSession(createMode, createPin, courtIds);
      window.localStorage.setItem(SESSION_STORAGE_KEY, created.id);
      setSessionId(created.id);
      setSession(created);
      setIsAuthenticated(true);
      setDraftMode(created.mode);
      setDraftCourts(created.activeCourts.length);
      setCreatePin('');
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

    try {
      const { accepted, duplicates } = await addSessionPlayers(sessionId, names);
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
    }
  };

  const removePlayer = async (id: string): Promise<boolean> => {
    if (!sessionId) return false;
    const target = sessionPlayersRaw.find((sessionPlayer) => sessionPlayer.id === id);
    if (!target) return false;

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
    }
  };

  const checkInPlayerNow = async (id: string) => {
    if (!sessionId) return;
    const target = registeredPlayers.find((player) => player.id === id);
    if (!target) return;

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
    }
  };

  const openManagePlayer = (id: string) => {
    const target = sessionPlayersRaw.find((sessionPlayer) => sessionPlayer.id === id);
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
    const activeMatch = activeMatches.find((match) => match.court === target.court);
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
    }
  };

  // ---- match lifecycle ----

  const updateMatchStatus = async (court: number, status: MatchStatus) => {
    if (!sessionId) return;
    const activeMatch = activeMatches.find((match) => match.court === court);
    if (!activeMatch) return;

    try {
      await updateMatchStatusApi(sessionId, activeMatch.matchId, status);
      await refreshAll(sessionId);
    } catch (error) {
      showSnackbar({
        title: 'อัปเดตสถานะไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    }
  };

  const finishMatch = async (court: number) => {
    if (!sessionId || !session) return;
    const activeMatch = activeMatches.find((match) => match.court === court);
    if (!activeMatch) return;

    try {
      await updateMatchStatusApi(sessionId, activeMatch.matchId, 'done');

      if (session.activeCourts.includes(court)) {
        const [freshPlayers, freshMatches, freshHistoryList] = await Promise.all([
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
    }
  };

  const undoLatestFinishByCourt = async (court: number) => {
    if (!sessionId || !latestFinishedMatch || latestFinishedMatch.court !== court) {
      showSnackbar({
        title: 'ยังย้อนกลับคอร์ดนี้ไม่ได้',
        description: 'ย้อนกลับได้เฉพาะคอร์ดที่กดจบล่าสุด',
        variant: 'info',
      });
      return;
    }

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
    }
  };

  const closeCourtNow = async (court: number) => {
    if (!sessionId) return;

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
    setPlanDraft({ mode: session.mode, courtIds: [...session.activeCourts] });
  };

  const closePlanEditor = () => setPlanDraft(null);

  const setPlanDraftMode = (nextMode: Mode) => {
    setPlanDraft((prev) => (prev ? { ...prev, mode: nextMode } : prev));
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

    try {
      await updateSession(sessionId, {
        mode: planDraft.mode,
        activeCourts: planDraft.courtIds,
      });
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

    try {
      await updateSession(sessionId, { mode: draftMode, activeCourts: courtIds });

      const [freshPlayers, freshHistoryList] = await Promise.all([
        listSessionPlayers(sessionId),
        getPartnerHistory(sessionId),
      ]);
      const freshHistory = Object.fromEntries(
        freshHistoryList.map((entry) => [entry.pairKey, entry.timesPlayedTogether]),
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
    }
  };

  const resetStats = async () => {
    if (!sessionId) return;

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
    }
  };

  const requestClearAll = () => setIsClearAllConfirmOpen(true);

  const confirmClearAll = () => {
    forgetSession();
    setIsClearAllConfirmOpen(false);
  };

  // ---- webboard ----

  const MAX_POST_PHOTOS = 6;

  const addPostPhotoFiles = (files: FileList | null) => {
    if (!files) return;
    setPostPhotoFiles((prev) =>
      [...prev, ...Array.from(files)].slice(0, MAX_POST_PHOTOS),
    );
    if (postFileInputRef.current) postFileInputRef.current.value = '';
  };

  const removePostPhotoFile = (index: number) => {
    setPostPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPost = async () => {
    const trimmed = postText.trim();
    if (!trimmed && postPhotoFiles.length === 0) return;

    setIsPosting(true);
    try {
      const photoUrls = await Promise.all(
        postPhotoFiles.map((file) => uploadPostPhoto(file)),
      );
      await createPost({
        text: trimmed,
        photoUrls,
        sessionId: sessionId ?? undefined,
      });
      setPostText('');
      setPostPhotoFiles([]);
      await refreshPosts();
      showSnackbar({
        title: 'โพสต์แล้ว',
        description: 'ขึ้นกระดานข่าวเรียบร้อย',
        variant: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: 'โพสต์ไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    } finally {
      setIsPosting(false);
    }
  };

  const removePost = async (postId: string) => {
    try {
      await deletePost(postId);
      await refreshPosts();
      toast.success('ลบโพสต์แล้ว');
    } catch (error) {
      showSnackbar({
        title: 'ลบโพสต์ไม่สำเร็จ',
        description: getErrorMessage(error),
        variant: 'error',
      });
    }
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
      <div className="flex min-h-dvh items-center justify-center bg-gradient-surface px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark">
                <Icon
                  icon="mdi:badminton"
                  width="20"
                  height="20"
                  className="text-primary"
                />
              </div>
              <div>
                <h1 className="font-display text-base font-extrabold text-foreground">
                  Badminton Matcher
                </h1>
                <p className="text-xs text-muted-foreground">สร้าง session ใหม่</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/board"
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                aria-label="กระดานข่าว"
              >
                <Newspaper className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/how-to-use"
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                วิธีใช้งาน
              </Link>
            </div>
          </div>

          <div className="space-y-5">
            <ModeSelector value={createMode} onChange={setCreateMode} />
            <CourtSelector value={createCourts} onChange={setCreateCourts} />

            <div className="space-y-2">
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ตั้ง PIN สำหรับแอดมิน (4-6 หลัก)
              </p>
              <Input
                value={createPin}
                onChange={(event) =>
                  setCreatePin(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreateSession();
                  }
                }}
                inputMode="numeric"
                placeholder="เช่น 1234"
                className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
              />
              <p className="text-xs text-muted-foreground">
                ใครมี PIN นี้จะจับคู่/จบแมตช์/ปิดคอร์ดได้ เก็บไว้ให้ทีมงานเท่านั้น
              </p>
            </div>

            <Button
              type="button"
              onClick={handleCreateSession}
              disabled={isCreatingSession}
              className="h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90"
            >
              {isCreatingSession ? 'กำลังสร้าง...' : 'สร้าง session'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'pin') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-surface px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h1 className="font-display text-lg font-extrabold text-foreground">
            ใส่ PIN เพื่อเข้าใช้งาน
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session ? `${formatModeLabel(session.mode)} · สร้างไว้ก่อนหน้านี้` : ''}
          </p>

          <div className="mt-5 space-y-2">
            <Input
              value={pinInput}
              onChange={(event) => {
                setPinInput(event.target.value.replace(/\D/g, '').slice(0, 6));
                setPinError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleVerifyPin();
                }
              }}
              inputMode="numeric"
              placeholder="PIN"
              className="h-12 rounded-xl text-center font-display text-lg tracking-[0.3em]"
            />
            {pinError && (
              <p className="text-xs font-medium text-destructive">{pinError}</p>
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
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-surface pb-24">
      {managePlayerDraft && managedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
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
                className="rounded-xl bg-primary text-primary-foreground"
              >
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
                disabled={Boolean(managedPlayerActiveMatch)}
                className="mt-2 w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                ลบผู้เล่น
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingSubstitute && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
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
                className="rounded-xl bg-primary text-primary-foreground"
              >
                ยืนยันและสุ่มแทน
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingCourtClose !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
            <h3 className="font-display text-lg font-extrabold text-foreground">
              ปรับรอบถัดไป
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              เกมที่กำลังเล่นอยู่จะไม่เปลี่ยน ระบบจะใช้แผนนี้ตอนเติมคู่ถัดไป
            </p>

            <div className="mt-5 space-y-5">
              <ModeSelector value={planDraft.mode} onChange={setPlanDraftMode} />

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
                disabled={planDraft.courtIds.length === 0}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                บันทึกแผน
              </Button>
            </div>
          </div>
        </div>
      )}

      {isClearAllConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
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
          <Link
            href="/how-to-use"
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">วิธีใช้งาน</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <PlayerList
            players={players}
            onAddMany={addPlayers}
            onManage={openManagePlayer}
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
              ลงชื่อล่วงหน้าไว้ แต่ยังไม่ยืนยันว่าถึงคอร์ดแล้ว — ยังไม่เข้าคิวสุ่มจนกว่าจะเช็คอิน
            </p>
            <div className="flex flex-wrap gap-2">
              {registeredPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => checkInPlayerNow(player.id)}
                  className="flex items-center gap-1.5 rounded-full bg-card py-1.5 pl-3 pr-2.5 font-display text-sm font-semibold text-foreground shadow-sm transition-smooth hover:bg-secondary/20"
                >
                  {player.name}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                    เช็คอิน
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="mb-2 flex items-center gap-2">
            <Icon icon="mdi:qrcode" width="16" height="16" className="text-muted-foreground" />
            <h3 className="font-display text-sm font-bold text-foreground">
              ลิงก์ลงชื่อ/เช็คอินด้วยตัวเอง
            </h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            ให้ผู้เล่นสแกน QR หรือเปิดลิงก์นี้เพื่อลงชื่อล่วงหน้าหรือเช็คอินเองได้ ไม่ต้องมี PIN
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
                  className="h-11 rounded-xl text-xs font-bold"
                >
                  คัดลอกลิงก์
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-sm font-bold text-foreground">
                กระดานข่าว
              </h3>
            </div>
            <Link
              href="/board"
              className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              ดูทั้งหมด
            </Link>
          </div>

          <div className="space-y-2">
            <textarea
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              placeholder="วันนี้มากี่คน มีอะไรอัปเดตบ้าง..."
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {postPhotoFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {postPhotoFiles.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {file.name}
                    <button
                      type="button"
                      onClick={() => removePostPhotoFile(index)}
                      aria-label={`ลบรูป ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <input
                ref={postFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => addPostPhotoFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => postFileInputRef.current?.click()}
                disabled={postPhotoFiles.length >= MAX_POST_PHOTOS}
                className="h-9 rounded-xl text-xs font-bold"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                แนบรูป
              </Button>
              <Button
                type="button"
                onClick={submitPost}
                disabled={
                  isPosting || (!postText.trim() && postPhotoFiles.length === 0)
                }
                className="h-9 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                {isPosting ? 'กำลังโพสต์...' : 'โพสต์'}
              </Button>
            </div>
          </div>

          {recentPosts.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start justify-between gap-2 rounded-xl bg-muted/40 p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    {post.text && (
                      <p className="truncate text-foreground">{post.text}</p>
                    )}
                    {post.photoUrls.length > 0 && (
                      <p className="text-muted-foreground">
                        📷 {post.photoUrls.length} รูป
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePost(post.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="ลบโพสต์"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="space-y-5">
            <p className="text-xs font-medium text-muted-foreground">
              เพิ่มผู้เล่นให้พอสำหรับ 1 แมตช์ก่อน แล้วค่อยเลือก Singles/Doubles
              กับจำนวนคอร์ด
            </p>
            <ModeSelector
              value={displayMode}
              onChange={handleModeChange}
              disabled={activeMatches.length > 0}
            />
            <CourtSelector
              value={displayCourts}
              onChange={handleCourtCountChange}
              disabled={activeMatches.length > 0}
            />
            {activeMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  กำลังเล่นอยู่ ให้ใช้ปุ่ม “ปรับรอบถัดไป”
                  เพื่อเปลี่ยนจำนวนคอร์ดหรือรูปแบบการแข่งขัน
                </p>
                <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-[11px]">
                  <p className="font-display font-bold uppercase tracking-wide text-muted-foreground">
                    เกมที่กำลังเล่น
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {currentSessionSummary ?? '-'}
                  </p>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={generateMatches}
              disabled={players.length < playersPerMatch || activeMatches.length > 0}
              className="h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90"
            >
              เริ่มจับคู่
            </Button>
          </div>
        </section>

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
              undoableCourtId={undoableCourtId}
              onUndoCourtFinish={undoLatestFinishByCourt}
              onOpenPlanEditor={openPlanEditor}
            />
            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/35 px-3 py-2.5">
              <div className="overflow-x-auto">
                <div className="flex min-w-max items-center justify-between gap-4 text-[11px]">
                  <div className="flex items-center gap-2 text-muted-foreground/90">
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium text-muted-foreground/90">
                        กำลังเล่น:
                      </span>
                      <span className="font-display font-bold text-foreground/90">
                        {stats.playing}
                      </span>
                    </span>
                    <span>|</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium text-muted-foreground/90">
                        พักอยู่:
                      </span>
                      <span className="font-display font-bold text-foreground/90">
                        {stats.resting}
                      </span>
                    </span>
                    <span>|</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium text-muted-foreground/90">
                        จบแล้ว:
                      </span>
                      <span className="font-display font-bold text-foreground/90">
                        {totalFinishedMatches}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetStats}
                      className="h-7 rounded-full px-2 font-display text-[10px] font-medium text-muted-foreground/85 hover:bg-background/60 hover:text-muted-foreground"
                    >
                      <RefreshCw className="h-3 w-3 opacity-70" />
                      รีเซ็ตทั้งหมด
                    </Button>

                    {players.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={requestClearAll}
                        className="h-7 rounded-full px-2 font-display text-[10px] font-medium text-muted-foreground/85 hover:bg-background/60 hover:text-destructive/80"
                      >
                        <Trash2 className="h-3.5 w-3.5 opacity-70" />
                        ล้างทั้งหมด
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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
