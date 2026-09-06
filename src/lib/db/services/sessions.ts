export const MAX_COURT_NUMBER = 20;
export const MIN_TARGET_SCORE = 1;
export const MAX_TARGET_SCORE = 99;

export const MAX_SESSION_NAME_LENGTH = 60;

export const serializeSession = (session: {
  _id: { toString(): string };
  name?: string | null;
  mode: string;
  status: string;
  activeCourts: number[];
  targetScore: number;
  createdAt?: Date;
}) => ({
  id: session._id.toString(),
  name: session.name ?? null,
  mode: session.mode,
  status: session.status,
  activeCourts: session.activeCourts,
  targetScore: session.targetScore,
  createdAt: session.createdAt ?? null,
});

export const isValidActiveCourts = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (court) =>
      typeof court === 'number' && court >= 1 && court <= MAX_COURT_NUMBER,
  );

export const isValidTargetScore = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_TARGET_SCORE &&
  value <= MAX_TARGET_SCORE;
