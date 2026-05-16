'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { Icon } from '@iconify/react';
import {
  // BookOpenText,
  // Coffee,
  RefreshCw,
  // Share2,
  Trash2,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_VERSION } from '@/lib/appVersion';

type PendingSubstitute = {
  playerId: string;
  playerName: string;
  court: number;
};

type ManagePlayerDraft = {
  playerId: string;
  name: string;
};

export function HomePage() {
  const [mode, setMode] = useLocalStorage<Mode>('bm_mode', 'doubles');
  const [courts, setCourts] = useLocalStorage<number>('bm_courts', 1);
  const [players, setPlayers] = useLocalStorage<Player[]>('bm_players', []);
  const [matches, setMatches] = useLocalStorage<Match[]>('bm_matches', []);
  const [nextMatches, setNextMatches] = useLocalStorage<Match[]>(
    'bm_nextMatches',
    [],
  );
  const [totalFinishedMatches, setTotalFinishedMatches] =
    useLocalStorage<number>('bm_totalFinishedMatches', 0);
  const [managePlayerDraft, setManagePlayerDraft] =
    useState<ManagePlayerDraft | null>(null);
  const [pendingSubstitute, setPendingSubstitute] =
    useState<PendingSubstitute | null>(null);
  const manageNameInputRef = useRef<HTMLInputElement>(null);

  type UndoSnapshot = {
    players: Player[];
    matches: Match[];
    nextMatches: Match[];
    totalFinishedMatches: number;
    label: string;
  };
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  useEffect(() => {
    if (!managePlayerDraft) return;
    const input = manageNameInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [managePlayerDraft]);

  const pushUndo = (label: string) => {
    setUndoStack((prev) => [
      ...prev.slice(-4),
      { players, matches, nextMatches, totalFinishedMatches, label },
    ]);
  };

  const undoLast = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev.at(-1)!;
      setPlayers(snapshot.players);
      setMatches(snapshot.matches);
      setNextMatches(snapshot.nextMatches);
      setTotalFinishedMatches(snapshot.totalFinishedMatches);
      return prev.slice(0, -1);
    });
  };

  const undoLatest = () => {
    const label = undoStack.at(-1)?.label;
    undoLast();
    toast.success('ย้อนกลับแล้ว', {
      description: label ? `ยกเลิก: ${label}` : undefined,
      duration: 2500,
    });
  };

  const playersPerMatch = mode === 'singles' ? 2 : 4;
  const requiredPlayers = playersPerMatch * courts;

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
  ) => {
    const availablePlayers = sourcePlayers.filter(
      (player) => !blockedIds.has(player.id),
    );
    const pool = rankCandidates(availablePlayers, recentlyPlayedIds);

    const newMatches: Match[] = [];
    const used = new Set<string>();

    for (let courtIndex = 0; courtIndex < courts; courtIndex += 1) {
      const slice = pool
        .filter((player) => !used.has(player.id))
        .slice(0, playersPerMatch);
      if (slice.length < playersPerMatch) {
        break;
      }

      slice.forEach((player) => used.add(player.id));

      const half = playersPerMatch / 2;
      newMatches.push({
        court: courtIndex + 1,
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

  const promoteNextRound = (sourcePlayers: Player[]) => {
    if (nextMatches.length === 0) return false;

    const promotedMatches: Match[] = nextMatches.map((match) => ({
      ...match,
      status: 'ready',
    }));
    const used = new Set(
      promotedMatches
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
    );
    const preview = buildMatchesFromPlayers(sourcePlayers, used, used);

    setPlayers(sourcePlayers);
    setMatches(promotedMatches);
    setNextMatches(preview.newMatches);
    return true;
  };

  const updateMatchStatus = (court: number, status: MatchStatus) => {
    setMatches((prev) =>
      prev.map((match) =>
        match.court === court ? { ...match, status } : match,
      ),
    );
  };

  const finishMatch = (court: number) => {
    pushUndo(`จบแมตช์ Court ${court}`);
    const finishedMatch = matches.find((match) => match.court === court);
    if (!finishedMatch) return;
    setTotalFinishedMatches((prev) => prev + 1);

    const finishedPlayerIds = new Set(
      [...finishedMatch.teamA, ...finishedMatch.teamB].map(
        (player) => player.id,
      ),
    );
    const playersAfterFinish = incrementPlayedCounts(
      players,
      finishedPlayerIds,
    );

    const updatedMatches: Match[] = matches.map((match) =>
      match.court === court ? { ...match, status: 'done' } : match,
    );

    if (nextMatches.length > 0) {
      const activeOtherIds = getActivePlayerIds(updatedMatches);
      const nextIndex = nextMatches.findIndex((nextMatch) => {
        return [...nextMatch.teamA, ...nextMatch.teamB].every(
          (player) => !activeOtherIds.has(player.id),
        );
      });

      if (nextIndex >= 0) {
        const nextUp = nextMatches[nextIndex];
        const matchesAfterPull: Match[] = updatedMatches.map((match) =>
          match.court === court
            ? {
                ...nextUp,
                court,
                status: 'ready',
              }
            : match,
        );
        const activeAfterPullIds = getActivePlayerIds(matchesAfterPull);
        const preview = buildMatchesFromPlayers(
          playersAfterFinish,
          activeAfterPullIds,
          activeAfterPullIds,
        );

        setPlayers(playersAfterFinish);
        setMatches(matchesAfterPull);
        setNextMatches(preview.newMatches);
        showSnackbar({
          title: `Court ${court} จบแมตช์แล้ว`,
          description: `ดึงคู่ถัดไปขึ้น Court ${court} แล้ว`,
          variant: 'success',
        });
        return;
      }
    }

    setPlayers(playersAfterFinish);
    setMatches(updatedMatches);

    const isRoundFinished = updatedMatches.every(
      (match) => match.status === 'done',
    );
    if (isRoundFinished && nextMatches.length > 0) {
      promoteNextRound(playersAfterFinish);
      showSnackbar({
        title: 'เริ่มรอบถัดไปอัตโนมัติ',
        description: 'ดึงแมตช์ถัดไปขึ้นมาเป็นแมตช์ปัจจุบันแล้ว',
        variant: 'success',
      });
      return;
    }

    showSnackbar({
      title: `Court ${court} จบแมตช์แล้ว`,
      description: 'อัปเดตสถานะเป็นจบแมตช์แล้ว',
      variant: 'success',
    });
  };

  const rematch = (court: number) => {
    setMatches((prev) =>
      prev.map((match) =>
        match.court === court
          ? {
              ...match,
              status: 'ready',
            }
          : match,
      ),
    );
    showSnackbar({
      title: `รีแมตช์ Court ${court}`,
      description: 'รีเซ็ตสถานะเรียบร้อย',
      variant: 'info',
    });
  };

  const cancelMatch = (court: number) => {
    const target = matches.find((match) => match.court === court);
    if (!target) return;

    const remainingMatches = matches.filter((match) => match.court !== court);
    setMatches(remainingMatches);
    const activeIds = getActivePlayerIds(remainingMatches);
    const preview = buildMatchesFromPlayers(players, activeIds, activeIds);
    setNextMatches(preview.newMatches);
    showSnackbar({
      title: `ยกเลิก Court ${court}`,
      description: 'นำคอร์ดนี้ออกจากรอบปัจจุบันแล้ว',
      variant: 'info',
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

    const currentRound = buildMatchesFromPlayers(players);
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
    );

    setPlayers(players);
    setMatches(currentRound.newMatches);
    setNextMatches(preview.newMatches);

    if (currentRound.newMatches.length < courts) {
      showSnackbar({
        title: `จับคู่ได้ ${currentRound.newMatches.length}/${courts} คอร์ด`,
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
    setTotalFinishedMatches(0);
    setUndoStack([]);
    showSnackbar({
      title: 'รีเซ็ตเรียบร้อย',
      description: 'ล้างสถิติและแมตช์ทั้งหมด',
      variant: 'success',
    });
  };

  const clearAll = () => {
    setPlayers([]);
    setMatches([]);
    setNextMatches([]);
    setTotalFinishedMatches(0);
    setUndoStack([]);
    toast.dismiss();
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
                  {managedPlayer.name} กำลังอยู่ใน Court{' '}
                  {managedPlayerActiveMatch.court} ต้องเปลี่ยนตัวก่อนจึงจะลบได้
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
              {pendingSubstitute.playerName} กำลังอยู่ใน Court{' '}
              {pendingSubstitute.court} ถ้าดำเนินการต่อ
              ระบบจะสุ่มผู้เล่นที่กำลังพักมาเปลี่ยนแทนทันที
              โดยผู้เล่นเดิมจะไปพัก
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
          {players.length > 0 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={clearAll}
              className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="ล้างทั้งหมด"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="space-y-5">
            <ModeSelector value={mode} onChange={setMode} />
            <CourtSelector value={courts} onChange={setCourts} />
            <div className="flex items-center justify-between rounded-2xl bg-secondary p-3.5 text-xs">
              <span className="font-medium text-secondary-foreground/70">
                ต้องการผู้เล่นต่อรอบ อย่างน้อย
              </span>
              <span className="font-display text-base font-extrabold text-primary">
                {requiredPlayers}{' '}
                <span className="text-xs font-semibold text-secondary-foreground/60">
                  คน
                </span>
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <PlayerList
            players={players}
            onAddMany={addPlayers}
            onManage={openManagePlayer}
          />
          <Button
            type="button"
            onClick={generateMatches}
            disabled={players.length < playersPerMatch || matches.length > 0}
            className="mt-4 h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90"
          >
            <Icon
              icon="material-symbols-light:badminton-outline-rounded"
              width="24"
              height="24"
              className="mr-2"
            />
            เริ่มจับคู่
          </Button>
        </section>

        {matches.length > 0 && (
          <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <MatchBoard
              matches={matches}
              mode={mode}
              nextMatches={nextMatches}
              restingPlayers={stats.restingPlayers}
              onStatusChange={updateMatchStatus}
              onFinish={finishMatch}
              onRematch={rematch}
              onCancel={cancelMatch}
              onSubstitutePlayer={requestSubstitutePlayer}
              canUndoLatest={undoStack.length > 0}
              onUndoLatest={undoLatest}
            />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted p-3 text-xs">
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-muted-foreground">
                <span className="inline-flex items-center">
                  <span>กำลังเล่น</span>
                  <span className="px-2 font-display font-extrabold text-foreground">
                    {stats.playing}
                  </span>
                </span>

                <span className="px-1">·</span>

                <span className="inline-flex items-center">
                  <span>พักอยู่</span>
                  <span className="px-2 font-display font-extrabold text-foreground">
                    {stats.resting}
                  </span>
                </span>

                <span className="px-1">·</span>

                <span className="inline-flex items-center">
                  <span>เล่นแล้ว</span>
                  <span className="px-2 font-display font-extrabold text-foreground">
                    {totalFinishedMatches}
                  </span>
                  <span>แมตช์</span>
                </span>
              </span>
              <Button
                type="button"
                variant="link"
                onClick={resetStats}
                className="h-auto p-0 font-display font-bold text-tertiary"
              >
                <RefreshCw className="h-3 w-3" />
                รีเซ็ตแมตท์ทั้งหมด
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-md px-4 py-3 pb-4">
          <div className="flex flex-col items-center gap-3">
            {/* Actions */}
            {/* <div className='flex flex-wrap items-center justify-center gap-2 rounded-full bg-muted/40 p-1 backdrop-blur'>
              <Button
                type='button'
                variant='ghost'
                onClick={shareApp}
                className='h-8 rounded-full px-3 text-xs font-semibold transition-all hover:bg-background hover:shadow-sm'
              >
                <Share2 className='mr-1.5 h-3.5 w-3.5' />
                Share
              </Button>

              <Button
                type='button'
                variant='ghost'
                onClick={openHowToUse}
                className='h-8 rounded-full px-3 text-xs font-semibold transition-all hover:bg-background hover:shadow-sm'
              >
                <BookOpenText className='mr-1.5 h-3.5 w-3.5' />
                Guide
              </Button>

              <Button
                type='button'
                variant='ghost'
                onClick={openDonate}
                className='h-8 rounded-full px-3 text-xs font-semibold transition-all hover:bg-background hover:shadow-sm'
              >
                <Coffee className='mr-1.5 h-3.5 w-3.5' />
                Donate
              </Button>
            </div> */}

            {/* Branding */}
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
