import { PlayerModel } from '@/lib/db/models/player';
import {
  SessionPlayerModel,
  type SessionPlayerDocument,
} from '@/lib/db/models/sessionPlayer';

export const MAX_SESSION_PLAYERS = 60;
export const MAX_NAME_LENGTH = 40;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const serializeSessionPlayer = (sessionPlayer: {
  _id: { toString(): string };
  guestName?: string | null;
  playerId?: { _id: { toString(): string }; name: string } | null;
  status: string;
  registeredAt: Date;
  checkedInAt?: Date | null;
  matchesPlayedInSession: number;
  queuedAt: Date;
}) => ({
  id: sessionPlayer._id.toString(),
  playerId: sessionPlayer.playerId?._id.toString() ?? null,
  name: sessionPlayer.guestName ?? sessionPlayer.playerId?.name ?? '',
  status: sessionPlayer.status,
  registeredAt: sessionPlayer.registeredAt,
  checkedInAt: sessionPlayer.checkedInAt ?? null,
  matchesPlayedInSession: sessionPlayer.matchesPlayedInSession,
  queuedAt: sessionPlayer.queuedAt,
});

const getExistingNameSet = async (sessionId: string) => {
  const existingSessionPlayers = await SessionPlayerModel.find({
    sessionId,
  }).populate('playerId', 'name');

  return new Set(
    existingSessionPlayers.map((sessionPlayer) =>
      (
        sessionPlayer.guestName ??
        (sessionPlayer.playerId as unknown as { name: string } | null)
          ?.name ??
        ''
      ).toLowerCase(),
    ),
  );
};

/**
 * Adds one or more players to a session, deduping case-insensitively
 * against names already in the session (not just this batch). Used by
 * both the admin "add player" flow (status 'checked_in' — added in
 * person, so already present) and public self-registration (status
 * 'registered' — signed up ahead of time, not yet confirmed at the
 * court).
 */
export async function addPlayersToSession(
  sessionId: string,
  rawNames: string[],
  status: 'registered' | 'checked_in',
) {
  const incoming = rawNames
    .map((name) => name.trim().slice(0, MAX_NAME_LENGTH))
    .filter(Boolean);

  const existingNames = await getExistingNameSet(sessionId);
  const currentCount = existingNames.size;

  const accepted: ReturnType<typeof serializeSessionPlayer>[] = [];
  const duplicates: string[] = [];
  let rejectedForCapacity = 0;

  for (const name of incoming) {
    const key = name.toLowerCase();
    if (existingNames.has(key)) {
      duplicates.push(name);
      continue;
    }
    if (currentCount + accepted.length >= MAX_SESSION_PLAYERS) {
      rejectedForCapacity += 1;
      continue;
    }
    existingNames.add(key);

    let player = await PlayerModel.findOne({
      name: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
    });
    if (!player) {
      player = await PlayerModel.create({ name });
    }

    const now = new Date();
    const sessionPlayer = await SessionPlayerModel.create({
      sessionId,
      playerId: player._id,
      status,
      checkedInAt: status === 'checked_in' ? now : undefined,
    });

    accepted.push(
      serializeSessionPlayer({
        _id: sessionPlayer._id,
        playerId: { _id: player._id, name: player.name },
        status: sessionPlayer.status,
        registeredAt: sessionPlayer.registeredAt,
        checkedInAt: sessionPlayer.checkedInAt,
        matchesPlayedInSession: sessionPlayer.matchesPlayedInSession,
        queuedAt: sessionPlayer.queuedAt,
      }),
    );
  }

  return { accepted, duplicates, rejectedForCapacity };
}

/** Finds a session player by id, or by case-insensitive name (checking
 * both linked Player names and guestName) if no id is given. */
export async function findSessionPlayerByIdOrName(
  sessionId: string,
  { sessionPlayerId, name }: { sessionPlayerId?: string; name?: string },
): Promise<InstanceType<typeof SessionPlayerModel> | null> {
  if (sessionPlayerId) {
    return SessionPlayerModel.findOne({ _id: sessionPlayerId, sessionId });
  }
  if (!name) return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  const candidates = await SessionPlayerModel.find({ sessionId }).populate(
    'playerId',
    'name',
  );
  const key = trimmed.toLowerCase();

  return (
    candidates.find(
      (sessionPlayer) =>
        (
          sessionPlayer.guestName ??
          (sessionPlayer.playerId as unknown as { name: string } | null)
            ?.name ??
          ''
        ).toLowerCase() === key,
    ) ?? null
  );
}

export type { SessionPlayerDocument };
