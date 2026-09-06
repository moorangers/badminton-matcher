import { describe, expect, it } from 'vitest';

import { getGameWinner } from './matchLifecycle';

describe('getGameWinner', () => {
  it('returns null while no one has reached the target score yet', () => {
    expect(getGameWinner(5, 3, 21)).toBeNull();
    expect(getGameWinner(20, 19, 21)).toBeNull();
  });

  it('declares a winner at the target score with a 2-point lead', () => {
    expect(getGameWinner(21, 19, 21)).toBe('A');
    expect(getGameWinner(19, 21, 21)).toBe('B');
  });

  it('does not declare a winner at the target score without a 2-point lead (deuce)', () => {
    expect(getGameWinner(21, 20, 21)).toBeNull();
    expect(getGameWinner(20, 21, 21)).toBeNull();
  });

  it('requires extending past the target score by exactly 2 once in deuce', () => {
    expect(getGameWinner(22, 20, 21)).toBe('A');
    expect(getGameWinner(23, 21, 21)).toBe('A');
  });

  it('caps the game at target + 9 regardless of margin (e.g. 30 for a 21-point game)', () => {
    expect(getGameWinner(30, 29, 21)).toBe('A');
    expect(getGameWinner(29, 30, 21)).toBe('B');
  });

  it('generalizes the same cap ratio to other target scores (e.g. 11 -> cap 20)', () => {
    expect(getGameWinner(11, 10, 11)).toBeNull();
    expect(getGameWinner(12, 10, 11)).toBe('A');
    expect(getGameWinner(20, 19, 11)).toBe('A');
  });

  it('defaults target score to 11 when not provided', () => {
    expect(getGameWinner(11, 9)).toBe('A');
  });
});
