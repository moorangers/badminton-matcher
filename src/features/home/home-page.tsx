'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  // BookOpenText,
  // Coffee,
  RefreshCw,
  // Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { CourtSelector } from '@/components/CourtSelector';
import {
  MatchBoard,
  type Match,
  type MatchStatus,
} from '@/components/MatchBoard';
import { ModeSelector, type Mode } from '@/components/ModeSelector';
import { PlayerList, type Player } from '@/components/PlayerList';
import { Button } from '@/components/ui/button';

const APP_VERSION = 'v0.1.0';

type Snackbar = {
  title: string;
  description: string;
  variant: 'success' | 'error' | 'info';
};

export function HomePage() {
  const [mode, setMode] = useState<Mode>('doubles');
  const [courts, setCourts] = useState<number>(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [nextMatches, setNextMatches] = useState<Match[]>([]);
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);

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

  const showSnackbar = (nextSnackbar: Snackbar) => {
    setSnackbar(nextSnackbar);
  };

  const buildMatchesFromPlayers = (sourcePlayers: Player[]) => {
    const sorted = [...sourcePlayers].sort((a, b) => a.matches - b.matches);
    const grouped = new Map<number, Player[]>();

    sorted.forEach((player) => {
      const tier = grouped.get(player.matches) ?? [];
      tier.push(player);
      grouped.set(player.matches, tier);
    });

    const pool: Player[] = [];
    Array.from(grouped.keys())
      .sort((a, b) => a - b)
      .forEach((key) => {
        const tier = grouped.get(key)!;
        for (let i = tier.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [tier[i], tier[j]] = [tier[j], tier[i]];
        }
        pool.push(...tier);
      });

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

  const promoteNextRound = () => {
    if (nextMatches.length === 0) return false;

    const promotedMatches = nextMatches.map((match) => ({
      ...match,
      status: 'ready' as MatchStatus,
    }));
    const used = new Set(
      promotedMatches
        .flatMap((match) => [...match.teamA, ...match.teamB])
        .map((player) => player.id),
    );
    const playersAfterPromote = incrementPlayedCounts(players, used);
    const preview = buildMatchesFromPlayers(playersAfterPromote);

    setPlayers(playersAfterPromote);
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
    const updatedMatches: Match[] = matches.map((match) =>
      match.court === court ? { ...match, status: 'done' } : match,
    );
    setMatches(updatedMatches);

    const isRoundFinished = updatedMatches.every(
      (match) => match.status === 'done',
    );
    if (isRoundFinished && nextMatches.length > 0) {
      promoteNextRound();
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

    const playerIds = new Set(
      [...target.teamA, ...target.teamB].map((player) => player.id),
    );

    setMatches((prev) => prev.filter((match) => match.court !== court));
    const updatedPlayers = players.map((player) =>
      playerIds.has(player.id)
        ? { ...player, matches: Math.max(0, player.matches - 1) }
        : player,
    );
    setPlayers(updatedPlayers);
    const preview = buildMatchesFromPlayers(updatedPlayers);
    setNextMatches(preview.newMatches);
    showSnackbar({
      title: `ยกเลิก Court ${court}`,
      description: 'นำคอร์ดนี้ออกจากรอบปัจจุบันแล้ว',
      variant: 'info',
    });
  };

  useEffect(() => {
    if (!snackbar) return;

    const timeoutId = globalThis.window.setTimeout(() => {
      setSnackbar(null);
    }, 3000);

    return () => {
      globalThis.window.clearTimeout(timeoutId);
    };
  }, [snackbar]);

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
      setPlayers((prev) => [
        ...prev,
        ...accepted.map((name) => ({
          id: crypto.randomUUID(),
          name,
          matches: 0,
        })),
      ]);
      setNextMatches([]);
    }

    if (accepted.length > 0 && duplicates.length === 0) {
      setSnackbar(null);
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
    setPlayers((prev) => prev.filter((player) => player.id !== id));
    setNextMatches([]);
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

    const playersAfterCurrent = incrementPlayedCounts(
      players,
      currentRound.used,
    );
    const preview = buildMatchesFromPlayers(playersAfterCurrent);

    setPlayers(playersAfterCurrent);
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

    setSnackbar(null);
  };

  const resetStats = () => {
    setPlayers((prev) => prev.map((player) => ({ ...player, matches: 0 })));
    setMatches([]);
    setNextMatches([]);
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
    setSnackbar(null);
  };

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

  const SNACKBAR_STYLES: Record<string, string> = {
    success: 'border-primary/40 bg-secondary text-primary',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
    default: 'border-tertiary/40 bg-card text-tertiary',
  };

  return (
    <div className='min-h-dvh bg-gradient-surface pb-24'>
      {snackbar && (
        <div className='pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4'>
          <div
            className={`max-w-md rounded-2xl border px-4 py-2 shadow-dark ${
              SNACKBAR_STYLES[snackbar.variant || 'default']
            }`}
          >
            <p className='font-display text-sm font-bold'>{snackbar.title}</p>
            <p className='text-xs opacity-90'>{snackbar.description}</p>
          </div>
        </div>
      )}

      <header className='sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg'>
        <div className='mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark'>
              <Sparkles className='h-5 w-5 animate-shuttle text-primary' />
            </div>
            <div>
              <h1 className='font-display text-base font-extrabold leading-tight text-foreground'>
                Badminton Matcher
              </h1>
              <p className='font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
                Fair · Fast · Fun · {APP_VERSION}
              </p>
            </div>
          </div>
          {players.length > 0 && (
            <Button
              type='button'
              size='icon'
              variant='ghost'
              onClick={clearAll}
              className='rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
              aria-label='ล้างทั้งหมด'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          )}
        </div>
      </header>

      <main className='mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-8'>
        <section className='overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6'>
          <div className='space-y-5'>
            <ModeSelector value={mode} onChange={setMode} />
            <CourtSelector value={courts} onChange={setCourts} />
            <div className='flex items-center justify-between rounded-2xl bg-secondary p-3.5 text-xs'>
              <span className='font-medium text-secondary-foreground/70'>
                ต้องการผู้เล่นต่อรอบ อย่างน้อย
              </span>
              <span className='font-display text-base font-extrabold text-primary'>
                {requiredPlayers}{' '}
                <span className='text-xs font-semibold text-secondary-foreground/60'>
                  คน
                </span>
              </span>
            </div>
          </div>
        </section>

        <section className='rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6'>
          <PlayerList
            players={players}
            onAddMany={addPlayers}
            onRemove={removePlayer}
          />
          <Button
            type='button'
            onClick={generateMatches}
            disabled={players.length < playersPerMatch || matches.length > 0}
            className='mt-4 h-14 w-full rounded-2xl bg-primary font-display text-base font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90'
          >
            <Icon
              icon='material-symbols-light:badminton-outline-rounded'
              width='24'
              height='24'
              className='mr-2'
            />
            เริ่มจับคู่
          </Button>
        </section>

        {matches.length > 0 && (
          <section className='rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6'>
            <MatchBoard
              matches={matches}
              mode={mode}
              nextMatches={nextMatches}
              restingPlayers={stats.restingPlayers}
              onStatusChange={updateMatchStatus}
              onFinish={finishMatch}
              onRematch={rematch}
              onCancel={cancelMatch}
            />
            <div className='mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted p-3 text-xs'>
              <span className='inline-flex flex-wrap items-center gap-1 font-medium text-muted-foreground'>
                <span className='inline-flex items-center'>
                  <span>กำลังเล่น</span>
                  <span className='px-2 font-display font-extrabold text-foreground'>
                    {stats.playing}
                  </span>
                </span>

                <span className='px-1'>·</span>

                <span className='inline-flex items-center'>
                  <span>พักอยู่</span>
                  <span className='px-2 font-display font-extrabold text-foreground'>
                    {stats.resting}
                  </span>
                </span>
              </span>
              <Button
                type='button'
                variant='link'
                onClick={resetStats}
                className='h-auto p-0 font-display font-bold text-tertiary'
              >
                <RefreshCw className='h-3 w-3' />
                รีเซ็ตแมตท์ทั้งหมด
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className='fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/80 backdrop-blur-xl'>
        <div className='mx-auto w-full max-w-md px-4 py-3 pb-4'>
          <div className='flex flex-col items-center gap-3'>
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
            <p className='text-xs font-medium text-muted-foreground'>
              <span>Powered by</span>
              <span className='ml-1 font-display font-bold text-foreground'>
                wonder-toolbox
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
