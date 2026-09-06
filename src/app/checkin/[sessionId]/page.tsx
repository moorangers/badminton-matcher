'use client';

import { use, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  checkInToSession,
  getSession,
  listSessionPlayers,
  registerForSession,
  type ApiSession,
  type ApiSessionPlayer,
} from '@/lib/api/sessionApi';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';

export default function CheckinPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [session, setSession] = useState<ApiSession | null>(null);
  const [players, setPlayers] = useState<ApiSessionPlayer[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [fetchedSession, fetchedPlayers] = await Promise.all([
        getSession(sessionId),
        listSessionPlayers(sessionId),
      ]);
      setSession(fetchedSession);
      setPlayers(fetchedPlayers);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [sessionId]);

  const registeredPlayers = players.filter((p) => p.status === 'registered');
  const checkedInPlayers = players.filter((p) => p.status !== 'registered');

  const handleCheckInExisting = async (sessionPlayerId: string) => {
    setBusy(true);
    try {
      await checkInToSession(sessionId, { sessionPlayerId });
      await refresh();
      toast.success('เช็คอินเรียบร้อย');
    } catch (error) {
      toast.error('เช็คอินไม่สำเร็จ', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { accepted, duplicates } = await registerForSession(sessionId, [
        trimmed,
      ]);
      await refresh();
      if (duplicates.length > 0) {
        toast.error('ชื่อนี้อยู่ในรายชื่อแล้ว');
      } else if (accepted.length > 0) {
        toast.success('ลงชื่อล่วงหน้าเรียบร้อย', {
          description: 'อย่าลืมกลับมาเช็คอินตอนถึงคอร์ดด้วย',
        });
        setName('');
      }
    } catch (error) {
      toast.error('ลงชื่อไม่สำเร็จ', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckInNew = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await checkInToSession(sessionId, { name: trimmed });
      await refresh();
      toast.success('เช็คอินเรียบร้อย');
      setName('');
    } catch (error) {
      toast.error('เช็คอินไม่สำเร็จ', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-surface">
        <Icon
          icon="mdi:badminton"
          width="32"
          height="32"
          className="animate-shuttle text-primary"
        />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-surface px-4 text-center">
        <div>
          <h1 className="font-display text-lg font-extrabold text-foreground">
            ไม่พบ session นี้
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ลิงก์อาจผิดหรือ session ถูกปิดไปแล้ว
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-surface px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark">
            <Icon
              icon="mdi:badminton"
              width="20"
              height="20"
              className="text-primary"
            />
          </div>
          <div>
            <h1 className="font-display text-base font-extrabold text-foreground">
              เช็คอินเข้าเล่น
            </h1>
            <p className="text-xs text-muted-foreground">
              Badminton Matcher · {session.mode === 'singles' ? 'Singles (1v1)' : 'Doubles (2v2)'}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-medium text-muted-foreground">
            พิมพ์ชื่อของคุณแล้วเลือก
          </p>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ชื่อของคุณ"
            className="mt-2 h-12 rounded-xl"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !name.trim()}
              onClick={handleRegister}
              className="h-11 rounded-xl text-xs font-bold"
            >
              ลงชื่อล่วงหน้า
              <span className="block text-[10px] font-normal opacity-70">
                (ยังไม่ถึงคอร์ด)
              </span>
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={handleCheckInNew}
              className="h-11 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              เช็คอินเลย
              <span className="block text-[10px] font-normal opacity-80">
                (ถึงคอร์ดแล้ว)
              </span>
            </Button>
          </div>
        </div>

        {registeredPlayers.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              รอเช็คอิน ({registeredPlayers.length})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ถ้าเห็นชื่อตัวเองในนี้ กดที่ชื่อเพื่อยืนยันว่าถึงคอร์ดแล้ว
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {registeredPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleCheckInExisting(player.id)}
                  className="rounded-full border border-secondary/50 bg-secondary/10 px-3 py-1.5 font-display text-sm font-semibold text-foreground transition-smooth hover:bg-secondary/20"
                >
                  {player.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {checkedInPlayers.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              เช็คอินแล้ว ({checkedInPlayers.length})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {checkedInPlayers.map((player) => (
                <span
                  key={player.id}
                  className="rounded-full bg-primary px-3 py-1.5 font-display text-sm font-semibold text-primary-foreground"
                >
                  {player.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
