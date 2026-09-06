import { describe, expect, it } from 'vitest';

import {
  assignTeams,
  buildMatchesFromPlayers,
  getPairKey,
  getPlayersPerMatch,
  rankCandidates,
  shufflePlayers,
} from './matching';
import type { Player } from '@/components/PlayerList';

const player = (id: string, matches = 0, queuedAt = 0): Player => ({
  id,
  name: id,
  matches,
  queuedAt,
});

describe('getPlayersPerMatch', () => {
  it('singles needs 2 players', () => {
    expect(getPlayersPerMatch('singles')).toBe(2);
  });

  it('doubles needs 4 players', () => {
    expect(getPlayersPerMatch('doubles')).toBe(4);
  });
});

describe('shufflePlayers', () => {
  it('returns the same players, just reordered (no player lost or duplicated)', () => {
    const players = [player('a'), player('b'), player('c'), player('d')];
    const shuffled = shufflePlayers(players);

    expect(shuffled).toHaveLength(players.length);
    expect(new Set(shuffled.map((p) => p.id))).toEqual(
      new Set(players.map((p) => p.id)),
    );
  });

  it('does not mutate the input array', () => {
    const players = [player('a'), player('b')];
    const original = [...players];
    shufflePlayers(players);
    expect(players).toEqual(original);
  });
});

describe('rankCandidates', () => {
  it('ranks players with fewer matches played first', () => {
    const players = [player('a', 3), player('b', 0), player('c', 1)];
    const ranked = rankCandidates(players);
    expect(ranked.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by earliest queuedAt (whoever has been waiting longest)', () => {
    const players = [
      player('a', 1, 300),
      player('b', 1, 100),
      player('c', 1, 200),
    ];
    const ranked = rankCandidates(players);
    expect(ranked.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('assignTeams', () => {
  it('splits a singles match (2 players) into one-per-team', () => {
    const slice = [player('a'), player('b')];
    const { teamA, teamB } = assignTeams(slice, {});
    expect(teamA.map((p) => p.id)).toEqual(['a']);
    expect(teamB.map((p) => p.id)).toEqual(['b']);
  });

  it('picks the doubles partner combo with the least shared history', () => {
    const slice = [player('a'), player('b'), player('c'), player('d')];
    // a+b and c+d have played together many times before; a+c/b+d and
    // a+d/b+c have not — the algorithm should avoid repeating a+b/c+d.
    const history: Record<string, number> = {
      [getPairKey('a', 'b')]: 5,
      [getPairKey('c', 'd')]: 5,
    };

    const { teamA, teamB } = assignTeams(slice, history);
    const teamAIds = teamA.map((p) => p.id).sort();
    const teamBIds = teamB.map((p) => p.id).sort();

    expect(teamAIds).not.toEqual(['a', 'b']);
    expect(teamBIds).not.toEqual(['c', 'd']);
  });

  it('treats an unplayed pair history as 0 (falls back to any combo when nothing has history)', () => {
    const slice = [player('a'), player('b'), player('c'), player('d')];
    const { teamA, teamB } = assignTeams(slice, {});
    expect(teamA).toHaveLength(2);
    expect(teamB).toHaveLength(2);
    const allIds = [...teamA, ...teamB].map((p) => p.id).sort();
    expect(allIds).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('buildMatchesFromPlayers', () => {
  it('fills one court for a doubles match when exactly 4 players are available', () => {
    const players = [player('a'), player('b'), player('c'), player('d')];
    const { newMatches, used } = buildMatchesFromPlayers(
      players,
      new Set(),
      { mode: 'doubles', courtIds: [1] },
      {},
    );

    expect(newMatches).toHaveLength(1);
    expect(newMatches[0].court).toBe(1);
    expect(used.size).toBe(4);
  });

  it('excludes blocked (already-playing) player ids from the pool', () => {
    const players = [
      player('a'),
      player('b'),
      player('c'),
      player('d'),
      player('e'),
      player('f'),
    ];
    const { newMatches } = buildMatchesFromPlayers(
      players,
      new Set(['a', 'b']),
      { mode: 'singles', courtIds: [1] },
      {},
    );

    expect(newMatches).toHaveLength(1);
    const usedIds = [...newMatches[0].teamA, ...newMatches[0].teamB].map(
      (p) => p.id,
    );
    expect(usedIds).not.toContain('a');
    expect(usedIds).not.toContain('b');
  });

  it('stops filling courts once there are not enough players left (does not error)', () => {
    const players = [player('a'), player('b'), player('c')];
    const { newMatches } = buildMatchesFromPlayers(
      players,
      new Set(),
      { mode: 'doubles', courtIds: [1, 2] },
      {},
    );

    // only 3 players — not enough for even one doubles match (needs 4)
    expect(newMatches).toHaveLength(0);
  });

  it('fills multiple courts when there are enough players for all of them', () => {
    const players = Array.from({ length: 8 }, (_, i) => player(`p${i}`));
    const { newMatches, used } = buildMatchesFromPlayers(
      players,
      new Set(),
      { mode: 'doubles', courtIds: [1, 2] },
      {},
    );

    expect(newMatches).toHaveLength(2);
    expect(newMatches.map((m) => m.court)).toEqual([1, 2]);
    expect(used.size).toBe(8);
  });

  it('never assigns the same player to two different courts in one call', () => {
    const players = Array.from({ length: 8 }, (_, i) => player(`p${i}`));
    const { newMatches } = buildMatchesFromPlayers(
      players,
      new Set(),
      { mode: 'doubles', courtIds: [1, 2] },
      {},
    );

    const allIds = newMatches.flatMap((m) => [
      ...m.teamA.map((p) => p.id),
      ...m.teamB.map((p) => p.id),
    ]);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
