'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import {
  getSession,
  listMatches,
  listSessionPlayers,
  type ApiMatch,
  type ApiSession,
  type ApiSessionPlayer,
} from '@/lib/api/sessionApi';

const POLL_INTERVAL_MS = 2000;

export default function ScoreboardPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [session, setSession] = useState<ApiSession | null>(null);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [players, setPlayers] = useState<ApiSessionPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const [fetchedSession, fetchedMatches, fetchedPlayers] =
          await Promise.all([
            getSession(sessionId),
            listMatches(sessionId),
            listSessionPlayers(sessionId),
          ]);
        setSession(fetchedSession);
        setMatches(fetchedMatches);
        setPlayers(fetchedPlayers);
        setNotFound(false);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId]);

  const nameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  const activeMatches = matches
    .filter((match) => match.status !== 'done')
    .sort((a, b) => a.court - b.court);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Icon
          icon="mdi:badminton"
          width="40"
          height="40"
          className="animate-shuttle text-primary"
        />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-center">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            ไม่พบ session นี้
          </h1>
          <p className="mt-2 text-muted-foreground">
            ลิงก์อาจผิดหรือ session ถูกปิดไปแล้ว
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Icon
            icon="mdi:badminton"
            width="32"
            height="32"
            className="text-primary"
          />
          <h1 className="text-2xl font-extrabold uppercase tracking-widest text-foreground sm:text-3xl">
            Live Scoreboard
          </h1>
        </div>

        {activeMatches.length === 0 ? (
          <p className="py-20 text-center text-xl text-muted-foreground">
            ยังไม่มีแมตช์ที่กำลังเล่นอยู่
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {activeMatches.map((match) => {
              const teamANames = match.teamA
                .map((id) => nameById.get(id) ?? '?')
                .join(' / ');
              const teamBNames = match.teamB
                .map((id) => nameById.get(id) ?? '?')
                .join(' / ');

              return (
                <div
                  key={match.id}
                  className="rounded-3xl border border-border bg-card p-6 shadow-soft"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-secondary px-3 py-1 text-sm font-extrabold uppercase tracking-widest text-secondary-foreground">
                      Court {match.court}
                    </span>
                    {match.status === 'playing' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                        กำลังเล่น
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="min-w-0 text-right">
                      <p className="truncate text-base font-bold text-tertiary sm:text-lg">
                        {teamANames}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-2">
                      <span className="text-4xl font-extrabold tabular-nums text-foreground sm:text-5xl">
                        {match.scoreA}
                      </span>
                      <span className="text-lg font-bold text-muted-foreground">
                        :
                      </span>
                      <span className="text-4xl font-extrabold tabular-nums text-foreground sm:text-5xl">
                        {match.scoreB}
                      </span>
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-base font-bold text-destructive sm:text-lg">
                        {teamBNames}
                      </p>
                    </div>
                  </div>

                  {match.gameWinner && (
                    <p className="mt-4 text-center text-sm font-extrabold uppercase tracking-widest text-primary">
                      {match.gameWinner === 'A' ? teamANames : teamBNames} ชนะ!
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
