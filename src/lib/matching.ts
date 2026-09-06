import type { Match } from '@/components/MatchBoard';
import type { Mode } from '@/components/ModeSelector';
import type { Player } from '@/components/PlayerList';

export type SessionPlan = { mode: Mode; courtIds: number[] };

export const getPlayersPerMatch = (sourceMode: Mode) => {
  return sourceMode === 'singles' ? 2 : 4;
};

export const shufflePlayers = (sourcePlayers: Player[]) => {
  const output = [...sourcePlayers];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
};

export const rankCandidates = (sourcePlayers: Player[]) => {
  return shufflePlayers(sourcePlayers).sort((a, b) => {
    if (a.matches !== b.matches) return a.matches - b.matches;
    return (a.queuedAt ?? 0) - (b.queuedAt ?? 0);
  });
};

export const getPairKey = (idA: string, idB: string) =>
  [idA, idB].sort().join('_');

export const DOUBLES_PARTNER_COMBOS: [[number, number], [number, number]][] = [
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

export const assignTeams = (
  slice: Player[],
  history: Record<string, number>,
) => {
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

export const buildMatchesFromPlayers = (
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
