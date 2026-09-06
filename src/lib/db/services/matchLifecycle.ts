import type { HydratedDocument } from 'mongoose';

import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';
import { PartnerHistoryModel } from '@/lib/db/models/partnerHistory';
import { MatchModel, type MatchDocument } from '@/lib/db/models/match';

type MatchDoc = HydratedDocument<MatchDocument>;

const pairKeyFor = (ids: string[]) => [...ids].sort().join('_');

/** Badminton-style single-game scoring, parameterized by target score
 * (default 11): first to reach it wins if ahead by 2+; hard cap at
 * target + 9 wins outright regardless of margin (generalizes the
 * official 21-point game's 21/30 cap ratio to other targets like 11/15). */
export function getGameWinner(
  scoreA: number,
  scoreB: number,
  targetScore = 11,
): 'A' | 'B' | null {
  const cap = targetScore + 9;
  if (scoreA >= cap) return 'A';
  if (scoreB >= cap) return 'B';
  if (scoreA >= targetScore && scoreA - scoreB >= 2) return 'A';
  if (scoreB >= targetScore && scoreB - scoreA >= 2) return 'B';
  return null;
}

export const serializeMatch = (match: {
  _id: { toString(): string };
  court: number;
  mode: string;
  teamA: { toString(): string }[];
  teamB: { toString(): string }[];
  status: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  statsCounted: boolean;
  scoreA: number;
  scoreB: number;
  targetScore: number;
}) => ({
  id: match._id.toString(),
  court: match.court,
  mode: match.mode,
  teamA: match.teamA.map((playerId) => playerId.toString()),
  teamB: match.teamB.map((playerId) => playerId.toString()),
  status: match.status,
  startedAt: match.startedAt ?? null,
  finishedAt: match.finishedAt ?? null,
  statsCounted: match.statsCounted,
  scoreA: match.scoreA,
  scoreB: match.scoreB,
  targetScore: match.targetScore,
  gameWinner: getGameWinner(match.scoreA, match.scoreB, match.targetScore),
});

/** Finds an active (non-done) match in this session that already contains
 * any of the given sessionPlayer ids — used to reject double-booking a
 * player into two matches at once. Pass `excludeMatchId` when editing an
 * existing match (e.g. substitute) so it doesn't collide with itself. */
export async function findActiveMatchForPlayers(
  sessionId: string,
  playerIds: string[],
  excludeMatchId?: string,
) {
  const query: Record<string, unknown> = {
    sessionId,
    status: { $ne: 'done' },
    $or: [{ teamA: { $in: playerIds } }, { teamB: { $in: playerIds } }],
  };
  if (excludeMatchId) {
    query._id = { $ne: excludeMatchId };
  }

  return MatchModel.findOne(query);
}

/** Finds an active (non-done) match already on this court — used so
 * undo-finish can refuse to revive a match onto a court that already has
 * a newer active match (e.g. finishMatch's auto-fill already ran). */
export async function findActiveMatchForCourt(
  sessionId: string,
  court: number,
  excludeMatchId?: string,
) {
  const query: Record<string, unknown> = {
    sessionId,
    court,
    status: { $ne: 'done' },
  };
  if (excludeMatchId) {
    query._id = { $ne: excludeMatchId };
  }

  return MatchModel.findOne(query);
}

const teamIdsOf = (match: MatchDoc) => ({
  teamAIds: match.teamA.map((playerId) => playerId.toString()),
  teamBIds: match.teamB.map((playerId) => playerId.toString()),
});

/**
 * Bumps matchesPlayedInSession/queuedAt for every player in the match and
 * partner-history counts for each 2-player team. Only call this once per
 * match — callers must guard against double-counting (see `statsCounted`
 * on the Match model).
 */
export async function applyMatchFinishStats(
  sessionId: string,
  match: MatchDoc,
) {
  const { teamAIds, teamBIds } = teamIdsOf(match);
  const allPlayerIds = [...teamAIds, ...teamBIds];
  const now = new Date();

  await SessionPlayerModel.updateMany(
    { _id: { $in: allPlayerIds } },
    {
      $inc: { matchesPlayedInSession: 1 },
      $set: { status: 'resting', queuedAt: now },
    },
  );

  for (const teamIds of [teamAIds, teamBIds]) {
    if (teamIds.length !== 2) continue;
    await PartnerHistoryModel.findOneAndUpdate(
      { sessionId, pairKey: pairKeyFor(teamIds) },
      { $inc: { timesPlayedTogether: 1 }, $set: { lastPlayedAt: now } },
      { upsert: true },
    );
  }
}

/** Reverses exactly what applyMatchFinishStats did. Caller must have
 * already verified `statsCounted` was true on the match being reverted. */
export async function revertMatchFinishStats(
  sessionId: string,
  match: MatchDoc,
) {
  const { teamAIds, teamBIds } = teamIdsOf(match);
  const allPlayerIds = [...teamAIds, ...teamBIds];

  await SessionPlayerModel.updateMany(
    { _id: { $in: allPlayerIds } },
    { $inc: { matchesPlayedInSession: -1 }, $set: { status: 'playing' } },
  );

  for (const teamIds of [teamAIds, teamBIds]) {
    if (teamIds.length !== 2) continue;
    await PartnerHistoryModel.updateOne(
      { sessionId, pairKey: pairKeyFor(teamIds) },
      { $inc: { timesPlayedTogether: -1 } },
    );
  }
}
