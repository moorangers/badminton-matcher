import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Coffee,
  GitMerge,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Swords,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Mode } from './ModeSelector';
import type { Player } from './PlayerList';

export type MatchStatus = 'ready' | 'playing' | 'done';

export interface Match {
  court: number;
  mode: Mode;
  teamA: Player[];
  teamB: Player[];
  status: MatchStatus;
  scoreA?: number;
  scoreB?: number;
  targetScore?: number;
  gameWinner?: 'A' | 'B' | null;
}

interface MatchBoardProps {
  matches: Match[];
  mode: Mode;
  nextMatches?: Match[];
  restingPlayers?: Player[];
  title?: string;
  showActions?: boolean;
  onStatusChange?: (court: number, status: MatchStatus) => void;
  onFinish?: (court: number) => void;
  onCloseCourt?: (court: number) => void;
  onSubstitutePlayer?: (playerId: string) => void;
  onScoreChange?: (court: number, team: 'A' | 'B', delta: 1 | -1) => void;
  undoableCourtId?: number;
  onUndoCourtFinish?: (court: number) => void;
  onOpenPlanEditor?: () => void;
  onResetStats?: () => void;
  isResettingStats?: boolean;
  pendingCourt?: number | null;
}

const statusConfig: Record<
  MatchStatus,
  { label: string; icon: typeof Play; className: string; dot: string }
> = {
  ready: {
    label: 'พร้อมเริ่ม',
    icon: Check,
    className: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  playing: {
    label: 'กำลังเล่น',
    icon: Play,
    className: 'bg-destructive text-destructive-foreground',
    dot: 'bg-destructive-foreground animate-pulse',
  },
  done: {
    label: 'จบแล้ว',
    icon: CheckCircle2,
    className: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

export const MatchBoard = ({
  matches,
  mode,
  nextMatches = [],
  restingPlayers = [],
  title = 'แมตช์ปัจจุบัน',
  showActions = true,
  onStatusChange,
  onFinish,
  onCloseCourt,
  onSubstitutePlayer,
  onScoreChange,
  undoableCourtId,
  onUndoCourtFinish,
  onOpenPlanEditor,
  onResetStats,
  isResettingStats = false,
  pendingCourt = null,
}: MatchBoardProps) => {
  if (matches.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-extrabold text-foreground">
          {title}
        </h3>
        {showActions && (
          <div className="flex items-center gap-2">
            {onResetStats && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onResetStats}
                disabled={isResettingStats}
                className="h-8 shrink-0 rounded-full px-2.5 font-display text-xs font-bold text-muted-foreground"
              >
                {isResettingStats ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">รีเซ็ตสถิติ/แมตช์</span>
              </Button>
            )}
            {onOpenPlanEditor && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenPlanEditor}
                className="h-8 shrink-0 rounded-full px-3 font-display text-xs font-bold"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                ปรับรอบถัดไป
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {matches.map((m) => {
          const cfg = statusConfig[m.status];
          const StatusIcon = cfg.icon;
          const matchMode = m.mode ?? mode;
          let statusClassName = 'border-border shadow-soft opacity-80';

          if (m.status === 'playing') {
            statusClassName = 'border-destructive/40 shadow-soft';
          } else if (m.status === 'ready') {
            statusClassName = 'border-border shadow-soft';
          }

          return (
            <div
              key={m.court}
              className={cn(
                'animate-float-up overflow-hidden rounded-2xl border bg-card transition-smooth',
                statusClassName,
              )}
            >
              <div className="flex items-center justify-between gap-2 bg-secondary px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <span className="shrink-0 font-display text-xs font-extrabold uppercase tracking-widest text-secondary-foreground">
                    Court {m.court}
                  </span>
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground/60">
                    · {matchMode === 'singles' ? '1v1' : '2v2'}
                    {typeof m.targetScore === 'number' && ` · ${m.targetScore} แต้ม`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider shadow-sm',
                      cfg.className,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                    <StatusIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </span>
                  {showActions && onCloseCourt && m.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => onCloseCourt(m.court)}
                      disabled={pendingCourt === m.court}
                      aria-label="ปิดคอร์ด"
                      className="flex items-center gap-1 rounded-full bg-card px-2 py-1 font-display text-[10px] font-bold text-muted-foreground shadow-sm transition-smooth hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {pendingCourt === m.court ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <GitMerge className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline">ปิดคอร์ด</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    Team A
                  </span>
                  <span className="font-display text-[10px] font-bold uppercase tracking-widest text-destructive">
                    Team B
                  </span>
                </div>

                <div className="mb-2 flex flex-col items-center gap-1">
                  {m.status !== 'done' &&
                  m.scoreA !== undefined &&
                  m.scoreB !== undefined ? (
                    <div className="flex items-center gap-2">
                      <ScoreButtonPair
                        disabled={!showActions}
                        reverse
                        decrementDisabled={m.scoreA === 0}
                        onIncrement={() => onScoreChange?.(m.court, 'A', 1)}
                        onDecrement={() => onScoreChange?.(m.court, 'A', -1)}
                      />
                      <span className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-md border-2 border-border bg-card px-1.5 font-display text-2xl font-extrabold tabular-nums text-foreground shadow-sm">
                        {m.scoreA}
                      </span>
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-smooth',
                          m.status === 'playing'
                            ? 'bg-destructive text-destructive-foreground shadow-soft'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Swords className="h-3 w-3" />
                      </span>
                      <span className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-md border-2 border-border bg-card px-1.5 font-display text-2xl font-extrabold tabular-nums text-foreground shadow-sm">
                        {m.scoreB}
                      </span>
                      <ScoreButtonPair
                        disabled={!showActions}
                        decrementDisabled={m.scoreB === 0}
                        onIncrement={() => onScoreChange?.(m.court, 'B', 1)}
                        onDecrement={() => onScoreChange?.(m.court, 'B', -1)}
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full transition-smooth',
                          m.status === 'playing'
                            ? 'bg-destructive text-destructive-foreground shadow-soft'
                            : 'bg-muted text-muted-foreground shadow-soft',
                        )}
                      >
                        <Swords className="h-4 w-4" />
                      </div>
                      <span className="font-display text-[10px] font-extrabold tracking-widest text-secondary">
                        VS
                      </span>
                    </>
                  )}
                  {m.gameWinner && m.status !== 'done' && (
                    <span className="whitespace-nowrap rounded-full bg-primary px-2 py-0.5 font-display text-[9px] font-bold text-primary-foreground">
                      {m.gameWinner === 'A' ? 'Team A ชนะ' : 'Team B ชนะ'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TeamColumn
                    players={m.teamA}
                    accent="blue"
                    matchStatus={m.status}
                    showSubstitute={showActions}
                    onSubstitute={onSubstitutePlayer}
                  />
                  <TeamColumn
                    players={m.teamB}
                    align="right"
                    accent="red"
                    matchStatus={m.status}
                    showSubstitute={showActions}
                    onSubstitute={onSubstitutePlayer}
                  />
                </div>
              </div>

              <div className="border-t border-border/70 px-4 py-3">
                {showActions ? (
                  <div className="flex items-center justify-between gap-2 overflow-x-auto">
                    <div className="flex flex-nowrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onStatusChange?.(m.court, 'playing')}
                        disabled={m.status === 'playing' || pendingCourt === m.court}
                        className="h-10 shrink-0 rounded-full px-4 font-display text-sm font-bold"
                      >
                        {pendingCourt === m.court ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        เริ่ม
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onFinish?.(m.court)}
                        disabled={m.status !== 'playing' || pendingCourt === m.court}
                        className="h-10 shrink-0 rounded-full px-4 font-display text-sm font-bold"
                      >
                        {pendingCourt === m.court ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        จบแมตช์
                      </Button>
                    </div>
                    {undoableCourtId === m.court && (
                      <div className="ml-auto flex shrink-0 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onUndoCourtFinish?.(m.court)}
                          disabled={pendingCourt === m.court}
                          className="h-10 rounded-full px-4 font-display text-sm font-bold"
                        >
                          {pendingCourt === m.court ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          ย้อนกลับคอร์ดนี้
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground">
                    ตัวอย่างรอบถัดไป (Preview)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showActions && nextMatches.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <div className="space-y-2">
            {nextMatches.map((match) => (
              <div key={`next-${match.court}`} className="text-xs">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <span className="shrink-0 font-display font-bold text-muted-foreground">
                    คู่ถัดไป (Court {match.court} ·{' '}
                    {(match.mode ?? mode) === 'singles' ? '1v1' : '2v2'})
                  </span>

                  <span className="min-w-0 truncate rounded-full border border-tertiary/30 bg-tertiary/10 px-3 py-1 text-tertiary shadow-sm">
                    Team A:{' '}
                    {match.teamA.map((player) => player.name).join(', ')}
                  </span>

                  <span className="min-w-0 truncate rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-destructive shadow-sm">
                    Team B:{' '}
                    {match.teamB.map((player) => player.name).join(', ')}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showActions && restingPlayers.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                <Coffee className="h-3.5 w-3.5" />
              </div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                กำลังพัก
              </h4>
            </div>
            <span className="rounded-full bg-card px-2 py-0.5 font-display text-[11px] font-bold text-muted-foreground">
              {restingPlayers.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {restingPlayers.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 font-display text-xs font-semibold text-foreground shadow-sm"
              >
                <Pause className="h-2.5 w-2.5 text-muted-foreground" />
                {p.name}
                {p.matches > 0 && (
                  <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                    {p.matches}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ScoreButtonPair = ({
  disabled,
  reverse = false,
  decrementDisabled,
  onIncrement,
  onDecrement,
}: {
  disabled?: boolean;
  reverse?: boolean;
  decrementDisabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {
  if (disabled) return null;

  const decrementButton = (
    <button
      key="decrement"
      type="button"
      onClick={onDecrement}
      disabled={decrementDisabled}
      aria-label="ลดคะแนน"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
    >
      <Minus className="h-4 w-4" />
    </button>
  );
  const incrementButton = (
    <button
      key="increment"
      type="button"
      onClick={onIncrement}
      aria-label="เพิ่มคะแนน"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-smooth hover:bg-secondary/80 active:scale-90"
    >
      <Plus className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      {reverse ? incrementButton : decrementButton}
      {reverse ? decrementButton : incrementButton}
    </div>
  );
};

const TeamColumn = ({
  players,
  align = 'left',
  accent,
  matchStatus,
  showSubstitute = false,
  onSubstitute,
}: {
  players: Player[];
  align?: 'left' | 'right';
  accent: 'blue' | 'red';
  matchStatus?: MatchStatus;
  showSubstitute?: boolean;
  onSubstitute?: (playerId: string) => void;
}) => {
  const canSub = showSubstitute;

  return (
    <div className={cn('min-w-0', align === 'right' ? 'text-right' : 'text-left')}>
      <div className="space-y-1">
        {players.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex min-w-0 items-center gap-1',
              align === 'right' ? 'justify-end' : 'justify-start',
            )}
          >
            {canSub && align === 'right' && (
              <button
                type="button"
                onClick={() => onSubstitute?.(p.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive active:scale-90"
                aria-label={`เปลี่ยนตัว ${p.name}`}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            )}
            <span
              className={cn(
                'min-w-0 truncate font-display text-sm font-bold',
                accent === 'blue' ? 'text-tertiary' : 'text-destructive',
              )}
            >
              {p.name}
            </span>
            {canSub && align === 'left' && (
              <button
                type="button"
                onClick={() => onSubstitute?.(p.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive active:scale-90"
                aria-label={`เปลี่ยนตัว ${p.name}`}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
