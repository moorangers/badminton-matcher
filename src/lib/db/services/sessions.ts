export const MAX_COURT_NUMBER = 20;
export const MIN_TARGET_SCORE = 1;
export const MAX_TARGET_SCORE = 99;

export const serializeSession = (session: {
  _id: { toString(): string };
  mode: string;
  status: string;
  activeCourts: number[];
  targetScore: number;
  createdAt?: Date;
}) => ({
  id: session._id.toString(),
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
