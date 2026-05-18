'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { Icon } from '@iconify/react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { CourtSelector } from '@/components/CourtSelector';
import {
  MatchBoard,
  type Match,
  type MatchStatus,
} from '@/components/MatchBoard';
import { ModeSelector, type Mode } from '@/components/ModeSelector';
import { PlayerList, type Player } from '@/components/PlayerList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_VERSION } from '@/lib/appVersion';
import { cn } from '@/lib/utils';

type PendingSubstitute = {
  playerId: string;
  playerName: string;
  court: number;
};

type ManagePlayerDraft = {
  playerId: string;
  name: string;
};

type SessionPlan = {
  mode: Mode;
  courtIds: number[];
};

const MAX_COURTS = 3;

const getCourtIds = (count: number) => {
  return Array.from({ length: count }, (_, index) => index + 1);
};

const normalizeCourtIds = (courtIds: number[], fallbackCount: number) => {
  const normalized = Array.from(
    new Set(
      courtIds.filter((courtId) => courtId >= 1 && courtId <= MAX_COURTS),
    ),
  ).sort((a, b) => a - b);

  return normalized.length > 0
    ? normalized
    : getCourtIds(Math.min(Math.max(fallbackCount, 1), MAX_COURTS));
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

export function HomePage() {
  const [mode, setMode, removeMode] = useLocalStorage<Mode>(
    'bm_mode',
    'doubles',
  );
  const [courts, setCourts, removeCourts] = useLocalStorage<number>(
    'bm_courts',
    1,
  );
  const [players, setPlayers, removePlayers] = useLocalStorage<Player[]>(
    'bm_players',
    [],
  );
  const [matches, setMatches, removeMatches] = useLocalStorage<Match[]>(
    'bm_matches',
    [],
  );
  const [nextMatches, setNextMatches, removeNextMatches] = useLocalStorage<
    Match[]
  >('bm_nextMatches', []);
  const [activeCourtIds, setActiveCourtIds, removeActiveCourtIds] =
    useLocalStorage<number[]>('bm_activeCourtIds', []);
  const [nextPlan, setNextPlan, removeNextPlan] =
    useLocalStorage<SessionPlan | null>('bm_nextPlan', null);
  const [
    totalFinishedMatches,
    setTotalFinishedMatches,
    removeTotalFinishedMatches,
  ] = useLocalStorage<number>('bm_totalFinishedMatches', 0);
  const [managePlayerDraft, setManagePlayerDraft] =
    useState<ManagePlayerDraft | null>(null);
  const [pendingSubstitute, setPendingSubstitute] =
    useState<PendingSubstitute | null>(null);
  const [planDraft, setPlanDraft] = useState<SessionPlan | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const manageNameInputRef = useRef<HTMLInputElement>(null);

  type UndoSnapshot = {
    actionType: 'finish' | 'plan';
    courtId?: number;
    mode: Mode;
    courts: number;
    players: Player[];
    matches: Match[];
    nextMatches: Match[];
    activeCourtIds: number[];
    nextPlan: SessionPlan | null;
    totalFinishedMatches: number;
    label: string;
  };
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const sessionCourtIds = useMemo(() => {
    if (matches.length === 0) {
      return normalizeCourtIds(
        activeCourtIds.length > 0 ? activeCourtIds : getCourtIds(courts),
        courts,
      );
    }

    const courtIdsFromMatches = matches.map((match) => match.court);
    const fallbackCourtIds =
      courtIdsFromMatches.length > 0
        ? courtIdsFromMatches
        : getCourtIds(courts);

    return normalizeCourtIds(
      activeCourtIds.length > 0 ? activeCourtIds : fallbackCourtIds,
      courts,
    );
  }, [activeCourtIds, courts, matches]);

  const currentPlan = useMemo<SessionPlan>(
    () => ({
      mode,
      courtIds: sessionCourtIds,
    }),
    [mode, sessionCourtIds],
  );

  const playersPerMatch = getPlayersPerMatch(mode);

  const activeMatches = useMemo(
    () => matches.filter((match) => match.status !== 'done'),
    [matches],
  );
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
    const activeMatchIds = new Set(
      matches
        .filter((match) => match.status !== 'done')
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
    );
    const playingIds = new Set(
      matches
        .filter((match) => match.status === 'playing')
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
    );
    const resting = players.filter((player) => !activeMatchIds.has(player.id));

    return {
      playing: playingIds.size,
      resting: resting.length,
      restingPlayers: resting,
    };
  }, [matches, players]);

  useEffect(() => {
    if (!managePlayerDraft) return;
    const input = manageNameInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [managePlayerDraft?.playerId]);

  const pushUndo = (
    label: string,
    actionType: 'finish' | 'plan',
    courtId?: number,
  ) => {
    setUndoStack((prev) => [
      ...prev.slice(-4),
      {
        actionType,
        courtId,
        mode,
        courts,
        players,
        matches,
        nextMatches,
        activeCourtIds,
        nextPlan,
        totalFinishedMatches,
        label,
      },
    ]);
  };

  const undoLast = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev.at(-1)!;
      setMode(snapshot.mode);
      setCourts(snapshot.courts);
      setPlayers(snapshot.players);
      setMatches(snapshot.matches);
      setNextMatches(snapshot.nextMatches);
      setActiveCourtIds(snapshot.activeCourtIds);
      setNextPlan(snapshot.nextPlan);
      setTotalFinishedMatches(snapshot.totalFinishedMatches);
      return prev.slice(0, -1);
    });
  };

  const latestUndo = undoStack.at(-1);
  const undoableCourtId =
    latestUndo?.actionType === 'finish' ? latestUndo.courtId : undefined;
  const canUndoLatestPlan = latestUndo?.actionType === 'plan';

  const undoLatestFinishByCourt = (court: number) => {
    if (undoableCourtId !== court) {
      showSnackbar({
        title: 'ยังย้อนกลับคอร์ดนี้ไม่ได้',
        description: 'ย้อนกลับได้เฉพาะคอร์ดที่กดจบล่าสุด',
        variant: 'info',
      });
      return;
    }

    const label = latestUndo?.label;
    undoLast();
    toast.success('ย้อนกลับคอร์ดแล้ว', {
      description: label ? `ยกเลิก: ${label}` : undefined,
      duration: 2500,
    });
  };

  const undoLatestPlan = () => {
    if (!canUndoLatestPlan) return;

    const label = latestUndo?.label;
    undoLast();
    toast.success('ย้อนกลับแผนแล้ว', {
      description: label ? `ยกเลิก: ${label}` : undefined,
      duration: 2500,
    });
  };

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

  const getRoundPlayerIds = (sourceMatches: Match[]) => {
    return new Set(
      sourceMatches
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
    );
  };

  const getActivePlayerIds = (sourceMatches: Match[]) => {
    return new Set(
      sourceMatches
        .filter((match) => match.status !== 'done')
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
    );
  };

  const shufflePlayers = (sourcePlayers: Player[]) => {
    const output = [...sourcePlayers];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  };

  const rankCandidates = (
    sourcePlayers: Player[],
    recentlyPlayedIds: Set<string>,
  ) => {
    const grouped = new Map<number, Player[]>();

    sourcePlayers.forEach((player) => {
      const tier = grouped.get(player.matches) ?? [];
      tier.push(player);
      grouped.set(player.matches, tier);
    });

    const pool: Player[] = [];
    Array.from(grouped.keys())
      .sort((a, b) => a - b)
      .forEach((key) => {
        const tier = grouped.get(key)!;
        const rested = tier.filter(
          (player) => !recentlyPlayedIds.has(player.id),
        );
        const recentlyPlayed = tier.filter((player) =>
          recentlyPlayedIds.has(player.id),
        );

        pool.push(...shufflePlayers(rested), ...shufflePlayers(recentlyPlayed));
      });

    return pool;
  };

  const buildMatchesFromPlayers = (
    sourcePlayers: Player[],
    recentlyPlayedIds: Set<string> = new Set(),
    blockedIds: Set<string> = new Set(),
    plan: SessionPlan = currentPlan,
  ) => {
    const planCourtIds = normalizeCourtIds(plan.courtIds, courts);
    const planPlayersPerMatch = getPlayersPerMatch(plan.mode);
    const availablePlayers = sourcePlayers.filter(
      (player) => !blockedIds.has(player.id),
    );
    const pool = rankCandidates(availablePlayers, recentlyPlayedIds);

    const newMatches: Match[] = [];
    const used = new Set<string>();

    for (const courtId of planCourtIds) {
      const slice = pool
        .filter((player) => !used.has(player.id))
        .slice(0, planPlayersPerMatch);
      if (slice.length < planPlayersPerMatch) {
        break;
      }

      slice.forEach((player) => used.add(player.id));

      const half = planPlayersPerMatch / 2;
      newMatches.push({
        court: courtId,
        mode: plan.mode,
        teamA: slice.slice(0, half),
        teamB: slice.slice(half),
        status: 'ready',
      });
    }

    return { newMatches, used };
  };

  const incrementPlayedCounts = (
    sourcePlayers: Player[],
    playedIds: Set<string>,
  ) => {
    return sourcePlayers.map((player) =>
      playedIds.has(player.id)
        ? { ...player, matches: player.matches + 1 }
        : player,
    );
  };

  const pruneClosedCourtMatches = (
    sourceMatches: Match[],
    plan: SessionPlan = currentPlan,
  ) => {
    const plannedCourtIds = new Set(plan.courtIds);

    return sourceMatches.filter((match) => {
      return match.status !== 'done' || plannedCourtIds.has(match.court);
    });
  };

  const isPlanActiveForCurrentMatches = (
    sourceMatches: Match[],
    plan: SessionPlan,
  ) => {
    const plannedCourtIds = new Set(plan.courtIds);
    const openMatches = sourceMatches.filter(
      (match) => match.status !== 'done',
    );

    if (openMatches.length === 0) return false;

    return openMatches.every((match) => {
      return plannedCourtIds.has(match.court) && match.mode === plan.mode;
    });
  };

  const updateMatchStatus = (court: number, status: MatchStatus) => {
    setMatches((prev) =>
      prev.map((match) =>
        match.court === court ? { ...match, status } : match,
      ),
    );
  };

  const finishMatch = (court: number) => {
    const finishedMatch = matches.find((match) => match.court === court);
    if (!finishedMatch) return;

    pushUndo(`จบแมตช์ Court ${court}`, 'finish', court);
    setTotalFinishedMatches((prev) => prev + 1);

    const plan = currentPlan;
    const plannedCourtIds = new Set(plan.courtIds);
    const clearNextPlanIfApplied = (sourceMatches: Match[]) => {
      if (nextPlan && isPlanActiveForCurrentMatches(sourceMatches, nextPlan)) {
        setNextPlan(null);
      }
    };

    const finishedPlayerIds = new Set(
      [...finishedMatch.teamA, ...finishedMatch.teamB].map(
        (player) => player.id,
      ),
    );
    const playersAfterFinish = incrementPlayedCounts(
      players,
      finishedPlayerIds,
    );

    const markedDoneMatches: Match[] = matches.map((match) =>
      match.court === court ? { ...match, status: 'done' } : match,
    );
    const updatedMatches = pruneClosedCourtMatches(markedDoneMatches, plan);

    if (plannedCourtIds.has(court) && nextMatches.length > 0) {
      const activeOtherIds = getActivePlayerIds(updatedMatches);
      const canUseNextMatch = (nextMatch: Match) => {
        return [...nextMatch.teamA, ...nextMatch.teamB].every(
          (player) => !activeOtherIds.has(player.id),
        );
      };
      const sameCourtIndex = nextMatches.findIndex((nextMatch) => {
        return nextMatch.court === court && canUseNextMatch(nextMatch);
      });
      const nextIndex =
        sameCourtIndex >= 0
          ? sameCourtIndex
          : nextMatches.findIndex(canUseNextMatch);

      if (nextIndex >= 0) {
        const nextUp = nextMatches[nextIndex];
        const matchesAfterPull: Match[] = updatedMatches.map((match) =>
          match.court === court
            ? {
                ...nextUp,
                court,
                mode: nextUp.mode ?? plan.mode,
                status: 'ready',
              }
            : match,
        );
        const activeAfterPullIds = getActivePlayerIds(matchesAfterPull);
        const preview = buildMatchesFromPlayers(
          playersAfterFinish,
          activeAfterPullIds,
          activeAfterPullIds,
          plan,
        );

        setPlayers(playersAfterFinish);
        setMatches(matchesAfterPull);
        setNextMatches(preview.newMatches);
        clearNextPlanIfApplied(matchesAfterPull);
        showSnackbar({
          title: `Court ${court} จบแมตช์แล้ว`,
          description: `ดึงคู่ถัดไปขึ้น Court ${court} แล้ว`,
          variant: 'success',
        });
        return;
      }
    }

    const activeAfterFinishIds = getActivePlayerIds(updatedMatches);
    const preview = buildMatchesFromPlayers(
      playersAfterFinish,
      activeAfterFinishIds,
      activeAfterFinishIds,
      plan,
    );
    const sameCourtGeneratedIndex = preview.newMatches.findIndex(
      (match) => match.court === court,
    );
    const canGenerateNextForCourt =
      plannedCourtIds.has(court) && preview.newMatches.length > 0;
    let generatedNextIndex = -1;
    if (canGenerateNextForCourt) {
      generatedNextIndex = Math.max(sameCourtGeneratedIndex, 0);
    }

    if (generatedNextIndex >= 0) {
      const nextUp = preview.newMatches[generatedNextIndex];
      const matchesAfterGeneratedPull: Match[] = updatedMatches.map((match) =>
        match.court === court
          ? {
              ...nextUp,
              court,
              mode: nextUp.mode ?? plan.mode,
              status: 'ready',
            }
          : match,
      );
      const activeAfterGeneratedPullIds = getActivePlayerIds(
        matchesAfterGeneratedPull,
      );
      const nextPreview = buildMatchesFromPlayers(
        playersAfterFinish,
        activeAfterGeneratedPullIds,
        activeAfterGeneratedPullIds,
        plan,
      );

      setPlayers(playersAfterFinish);
      setMatches(matchesAfterGeneratedPull);
      setNextMatches(nextPreview.newMatches);
      clearNextPlanIfApplied(matchesAfterGeneratedPull);
      showSnackbar({
        title: `Court ${court} จบแมตช์แล้ว`,
        description: `จัดคู่ใหม่ขึ้น Court ${court} ตามแผนรอบถัดไปแล้ว`,
        variant: 'success',
      });
      return;
    }

    const hasActiveMatches = updatedMatches.some(
      (match) => match.status !== 'done',
    );

    if (!hasActiveMatches && preview.newMatches.length > 0) {
      const nextPreview = buildMatchesFromPlayers(
        playersAfterFinish,
        preview.used,
        preview.used,
        plan,
      );

      setPlayers(playersAfterFinish);
      setMatches(preview.newMatches);
      setNextMatches(nextPreview.newMatches);
      clearNextPlanIfApplied(preview.newMatches);
      showSnackbar({
        title: 'เริ่มรอบถัดไปอัตโนมัติ',
        description: 'จัดคู่ใหม่ตามแผนรอบถัดไปแล้ว',
        variant: 'success',
      });
      return;
    }

    setPlayers(playersAfterFinish);
    setMatches(updatedMatches);
    setNextMatches(preview.newMatches);
    clearNextPlanIfApplied(updatedMatches);

    showSnackbar({
      title: `Court ${court} จบแมตช์แล้ว`,
      description: 'อัปเดตสถานะเป็นจบแมตช์แล้ว',
      variant: 'success',
    });
  };

  const addPlayers = (names: string[]) => {
    const incoming = names.map((name) => name.trim()).filter(Boolean);
    if (incoming.length === 0) return;

    const existing = new Set(
      players.map((player) => player.name.toLowerCase()),
    );
    const duplicates: string[] = [];
    const accepted: string[] = [];

    incoming.forEach((name) => {
      const key = name.toLowerCase();
      if (existing.has(key)) {
        duplicates.push(name);
        return;
      }
      existing.add(key);
      accepted.push(name);
    });

    if (accepted.length > 0) {
      const acceptedPlayers = accepted.map((name) => ({
        id: crypto.randomUUID(),
        name,
        matches: 0,
      }));
      const updatedPlayers = [...players, ...acceptedPlayers];

      setPlayers(updatedPlayers);
      if (matches.length > 0) {
        const activeIds = getActivePlayerIds(matches);
        const preview = buildMatchesFromPlayers(
          updatedPlayers,
          activeIds,
          activeIds,
        );
        setNextMatches(preview.newMatches);
      } else {
        setNextMatches([]);
      }
    }

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
  };

  const removePlayer = (id: string) => {
    const targetPlayer = players.find((player) => player.id === id);
    if (!targetPlayer) return false;

    const activeMatch = matches.find(
      (match) =>
        match.status !== 'done' &&
        [...match.teamA, ...match.teamB].some((player) => player.id === id),
    );

    if (activeMatch) {
      showSnackbar({
        title: 'ยังลบผู้เล่นไม่ได้',
        description: `${targetPlayer.name} กำลังอยู่ใน Court ${activeMatch.court} ให้เปลี่ยนตัวก่อน`,
        variant: 'error',
      });
      return false;
    }

    const updatedPlayers = players.filter((player) => player.id !== id);
    setPlayers(updatedPlayers);
    if (matches.length > 0) {
      const activeIds = getActivePlayerIds(matches);
      const preview = buildMatchesFromPlayers(
        updatedPlayers,
        activeIds,
        activeIds,
      );
      setNextMatches(preview.newMatches);
    } else {
      setNextMatches([]);
    }

    showSnackbar({
      title: `ลบ ${targetPlayer.name} แล้ว`,
      description: 'อัปเดตรายการผู้เล่นเรียบร้อย',
      variant: 'info',
    });

    return true;
  };

  const renamePlayerInMatches = (
    sourceMatches: Match[],
    playerId: string,
    nextName: string,
  ): Match[] => {
    return sourceMatches.map((match) => ({
      ...match,
      teamA: match.teamA.map((player) =>
        player.id === playerId ? { ...player, name: nextName } : player,
      ),
      teamB: match.teamB.map((player) =>
        player.id === playerId ? { ...player, name: nextName } : player,
      ),
    }));
  };

  const openManagePlayer = (id: string) => {
    const targetPlayer = players.find((player) => player.id === id);
    if (!targetPlayer) return;

    setManagePlayerDraft({
      playerId: id,
      name: targetPlayer.name,
    });
  };

  const closeManagePlayer = () => {
    setManagePlayerDraft(null);
  };

  const saveManagedPlayerName = () => {
    if (!managePlayerDraft) return;

    const trimmedName = managePlayerDraft.name.trim();
    const targetPlayer = players.find(
      (player) => player.id === managePlayerDraft.playerId,
    );
    if (!targetPlayer) {
      closeManagePlayer();
      return;
    }

    if (!trimmedName) {
      showSnackbar({
        title: 'ชื่อไม่ถูกต้อง',
        description: 'กรุณากรอกชื่อผู้เล่น',
        variant: 'error',
      });
      return;
    }

    if (trimmedName === targetPlayer.name) {
      closeManagePlayer();
      return;
    }

    const isDuplicate = players.some(
      (player) =>
        player.id !== targetPlayer.id &&
        player.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      showSnackbar({
        title: 'ชื่อซ้ำ',
        description: `มีผู้เล่นชื่อ "${trimmedName}" อยู่แล้ว`,
        variant: 'error',
      });
      return;
    }

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === targetPlayer.id
          ? { ...player, name: trimmedName }
          : player,
      ),
    );
    setMatches((prev) =>
      renamePlayerInMatches(prev, targetPlayer.id, trimmedName),
    );
    setNextMatches((prev) =>
      renamePlayerInMatches(prev, targetPlayer.id, trimmedName),
    );
    setPendingSubstitute((prev) =>
      prev?.playerId === targetPlayer.id
        ? { ...prev, playerName: trimmedName }
        : prev,
    );

    closeManagePlayer();
    showSnackbar({
      title: 'แก้ชื่อเรียบร้อย',
      description: `${targetPlayer.name} → ${trimmedName}`,
      variant: 'success',
    });
  };

  const deleteManagedPlayer = () => {
    if (!managePlayerDraft) return;

    const didRemove = removePlayer(managePlayerDraft.playerId);
    if (didRemove) {
      closeManagePlayer();
    }
  };

  const requestSubstitutePlayer = (id: string) => {
    const targetPlayer = players.find((player) => player.id === id);
    if (!targetPlayer) return;

    const activeMatch = matches.find(
      (match) =>
        match.status !== 'done' &&
        [...match.teamA, ...match.teamB].some((player) => player.id === id),
    );

    if (!activeMatch) {
      showSnackbar({
        title: 'เปลี่ยนตัวไม่สำเร็จ',
        description: `${targetPlayer.name} ไม่ได้อยู่ในแมตช์ปัจจุบัน`,
        variant: 'error',
      });
      return;
    }

    setPendingSubstitute({
      playerId: id,
      playerName: targetPlayer.name,
      court: activeMatch.court,
    });
  };

  const confirmSubstitute = () => {
    if (!pendingSubstitute) return;

    const target = pendingSubstitute;
    const activeIds = new Set(
      matches
        .filter((match) => match.status !== 'done')
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
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

    const recentIds = getRoundPlayerIds(matches);
    const replacement = rankCandidates(candidatePool, recentIds)[0];
    if (!replacement) {
      setPendingSubstitute(null);
      showSnackbar({
        title: 'สุ่มคนแทนไม่สำเร็จ',
        description: 'ลองอีกครั้ง',
        variant: 'error',
      });
      return;
    }

    const updatedMatches = matches.map((match) => ({
      ...match,
      teamA: match.teamA.map((player) =>
        player.id === target.playerId ? replacement : player,
      ),
      teamB: match.teamB.map((player) =>
        player.id === target.playerId ? replacement : player,
      ),
    }));

    const preview = buildMatchesFromPlayers(
      players,
      getActivePlayerIds(updatedMatches),
      getActivePlayerIds(updatedMatches),
    );

    setMatches(updatedMatches);
    setPlayers(players);
    setNextMatches(preview.newMatches);
    setPendingSubstitute(null);

    showSnackbar({
      title: `แทนผู้เล่น Court ${target.court}`,
      description: `${replacement.name} ลงแทน ${target.playerName} แล้ว (${target.playerName} ไปพัก)`,
      variant: 'success',
    });
  };

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setNextPlan(null);
  };

  const handleCourtCountChange = (nextCourts: number) => {
    const normalizedCourts = Math.min(Math.max(nextCourts, 1), MAX_COURTS);

    setCourts(normalizedCourts);
    setActiveCourtIds(getCourtIds(normalizedCourts));
    setNextPlan(null);
  };

  const openPlanEditor = () => {
    const basePlan = nextPlan ?? currentPlan;

    setPlanDraft({
      mode: basePlan.mode,
      courtIds: [...basePlan.courtIds],
    });
  };

  const closePlanEditor = () => {
    setPlanDraft(null);
  };

  const setPlanDraftMode = (nextMode: Mode) => {
    setPlanDraft((prev) => (prev ? { ...prev, mode: nextMode } : prev));
  };

  const togglePlanDraftCourt = (courtId: number) => {
    setPlanDraft((prev) => {
      if (!prev) return prev;

      const nextCourtIds = prev.courtIds.includes(courtId)
        ? prev.courtIds.filter((id) => id !== courtId)
        : [...prev.courtIds, courtId];

      return {
        ...prev,
        courtIds: nextCourtIds.toSorted((a, b) => a - b),
      };
    });
  };

  const saveNextPlan = () => {
    if (!planDraft) return;

    if (planDraft.courtIds.length === 0) {
      showSnackbar({
        title: 'ยังไม่ได้เลือกคอร์ด',
        description: 'เลือกอย่างน้อย 1 คอร์ดสำหรับรอบถัดไป',
        variant: 'error',
      });
      return;
    }

    const plan: SessionPlan = {
      mode: planDraft.mode,
      courtIds: normalizeCourtIds(planDraft.courtIds, courts),
    };
    const planPlayersPerMatch = getPlayersPerMatch(plan.mode);
    const planRequiredPlayers = planPlayersPerMatch * plan.courtIds.length;

    if (players.length < planRequiredPlayers) {
      showSnackbar({
        title: 'ผู้เล่นไม่พอสำหรับแผนใหม่',
        description: `ต้องมีอย่างน้อย ${planRequiredPlayers} คนสำหรับ ${formatCourtLabel(plan.courtIds)} · ${formatModeLabel(plan.mode)}`,
        variant: 'error',
      });
      return;
    }

    pushUndo('เปลี่ยนแผนรอบถัดไป', 'plan');

    const activeIds = getActivePlayerIds(matches);
    const preview = buildMatchesFromPlayers(
      players,
      activeIds,
      activeIds,
      plan,
    );

    setMode(plan.mode);
    setCourts(plan.courtIds.length);
    setActiveCourtIds(plan.courtIds);
    setNextPlan(plan);
    setNextMatches(preview.newMatches);
    setPlanDraft(null);

    showSnackbar({
      title: 'เปลี่ยนแผนรอบถัดไปแล้ว',
      description: 'คู่ถัดไปเดิมถูกจัดใหม่ตามแผนใหม่แล้ว',
      variant: 'success',
    });
  };

  const generateMatches = () => {
    if (matches.length > 0) {
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
        description: `ต้องมีอย่างน้อย ${playersPerMatch} คนสำหรับ ${mode === 'singles' ? 'Singles' : 'Doubles'}`,
        variant: 'error',
      });
      return;
    }

    const startPlan: SessionPlan = {
      mode,
      courtIds: normalizeCourtIds(
        activeCourtIds.length > 0 ? activeCourtIds : getCourtIds(courts),
        courts,
      ),
    };
    const currentRound = buildMatchesFromPlayers(
      players,
      new Set(),
      new Set(),
      startPlan,
    );
    if (currentRound.newMatches.length === 0) {
      showSnackbar({
        title: 'จับคู่ไม่สำเร็จ',
        description: 'ผู้เล่นไม่พอสำหรับคอร์ดที่เลือก',
        variant: 'error',
      });
      return;
    }

    const activeAfterIds = getActivePlayerIds(currentRound.newMatches);
    const preview = buildMatchesFromPlayers(
      players,
      activeAfterIds,
      activeAfterIds,
      startPlan,
    );

    setPlayers(players);
    setMatches(currentRound.newMatches);
    setNextMatches(preview.newMatches);
    setActiveCourtIds(startPlan.courtIds);
    setNextPlan(null);

    if (currentRound.newMatches.length < startPlan.courtIds.length) {
      showSnackbar({
        title: `จับคู่ได้ ${currentRound.newMatches.length}/${startPlan.courtIds.length} คอร์ด`,
        description: 'เพิ่มผู้เล่นเพื่อใช้ทุกคอร์ด',
        variant: 'info',
      });
      return;
    }

    toast.dismiss();
  };

  const resetStats = () => {
    setPlayers(players.map((player) => ({ ...player, matches: 0 })));
    setMatches([]);
    setNextMatches([]);
    setActiveCourtIds(getCourtIds(courts));
    setNextPlan(null);
    setPlanDraft(null);
    setTotalFinishedMatches(0);
    setUndoStack([]);
    showSnackbar({
      title: 'รีเซ็ตเรียบร้อย',
      description: 'ล้างสถิติและแมตช์ทั้งหมด',
      variant: 'success',
    });
  };

  const clearAll = () => {
    removeMode();
    removeCourts();
    removePlayers();
    removeMatches();
    removeNextMatches();
    removeActiveCourtIds();
    removeNextPlan();
    removeTotalFinishedMatches();
    setPlanDraft(null);
    setUndoStack([]);
    toast.dismiss();
  };

  const requestClearAll = () => {
    setIsClearAllConfirmOpen(true);
  };

  const confirmClearAll = () => {
    clearAll();
    setIsClearAllConfirmOpen(false);
  };

  const managedPlayer = managePlayerDraft
    ? players.find((player) => player.id === managePlayerDraft.playerId)
    : null;
  const managedPlayerActiveMatch = managedPlayer
    ? matches.find(
        (match) =>
          match.status !== 'done' &&
          [...match.teamA, ...match.teamB].some(
            (player) => player.id === managedPlayer.id,
          ),
      )
    : null;

  // const openHowToUse = () => {
  //   showSnackbar({
  //     title: 'วิธีการใช้งาน',
  //     description: 'เตรียมปุ่มนี้ไว้สำหรับเปิด modal ในเวอร์ชันถัดไป',
  //     variant: 'info',
  //   });
  // };

  // const openDonate = () => {
  //   showSnackbar({
  //     title: 'Buy coffee (Donate)',
  //     description: 'เตรียมเชื่อมลิงก์โดเนตในเวอร์ชันถัดไป',
  //     variant: 'info',
  //   });
  // };

  // const shareApp = async () => {
  //   const shareData = {
  //     title: 'Badminton Matcher',
  //     text: 'ลองใช้ Badminton Matcher สำหรับจัดคู่แบดมินตัน',
  //     url: globalThis.window.location.href,
  //   };

  // try {
  //   if (globalThis.navigator.share) {
  //     await globalThis.navigator.share(shareData);
  //     showSnackbar({
  //       title: 'แชร์เรียบร้อย',
  //       description: 'ส่งลิงก์แอปให้เพื่อนแล้ว',
  //       variant: 'success',
  //     });
  //     return;
  //   }

  //   await globalThis.navigator.clipboard.writeText(shareData.url);
  //   showSnackbar({
  //     title: 'คัดลอกลิงก์แล้ว',
  //     description: 'วางลิงก์เพื่อแชร์ต่อได้เลย',
  //     variant: 'info',
  //   });
  // } catch {
  //   showSnackbar({
  //     title: 'แชร์ไม่สำเร็จ',
  //     description: 'ลองอีกครั้งหรือคัดลอก URL จากเบราว์เซอร์',
  //     variant: 'error',
  //   });
  // }
  // };

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
              <ModeSelector
                value={planDraft.mode}
                onChange={setPlanDraftMode}
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
              ยืนยันล้างทั้งหมด
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              การดำเนินการนี้จะลบผู้เล่น แมตช์ และสถิติทั้งหมดทันที
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
                ล้างทั้งหมด
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

        <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="space-y-5">
            <p className="text-xs font-medium text-muted-foreground">
              เพิ่มผู้เล่นให้พอสำหรับ 1 แมตช์ก่อน แล้วค่อยเลือก Singles/Doubles
              กับจำนวนคอร์ด
            </p>
            <ModeSelector
              value={mode}
              onChange={handleModeChange}
              disabled={matches.length > 0}
            />
            <CourtSelector
              value={courts}
              onChange={handleCourtCountChange}
              disabled={matches.length > 0}
            />
            {matches.length > 0 && (
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
              disabled={players.length < playersPerMatch || matches.length > 0}
              className="h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90"
            >
              เริ่มจับคู่
            </Button>
          </div>
        </section>

        {matches.length > 0 && (
          <section className="rounded-3xl border border-border/70 bg-card p-4 sm:p-6">
            <MatchBoard
              matches={matches}
              mode={mode}
              nextMatches={nextMatches}
              restingPlayers={stats.restingPlayers}
              onStatusChange={updateMatchStatus}
              onFinish={finishMatch}
              onSubstitutePlayer={requestSubstitutePlayer}
              undoableCourtId={undoableCourtId}
              onUndoCourtFinish={undoLatestFinishByCourt}
              canUndoPlanLatest={canUndoLatestPlan}
              onUndoPlanLatest={undoLatestPlan}
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
