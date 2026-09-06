import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TargetScoreSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const PRESETS = [11, 15, 21];

export const TargetScoreSelector = ({
  value,
  onChange,
  disabled = false,
}: TargetScoreSelectorProps) => {
  // ช่องกำหนดเองเก็บ string ของตัวเองแยกจาก value ที่ commit แล้ว เพื่อให้ลบ/พิมพ์
  // เลขใหม่ได้อิสระ (ไม่งั้นพอ input ว่างชั่วคราว parsed จะ invalid แล้ว onChange
  // ไม่ถูกเรียก ทำให้ค่าเดิมเด้งกลับมาทันทีจน backspace ตัวสุดท้ายไม่ได้)
  const [customInput, setCustomInput] = useState(String(value));

  useEffect(() => {
    setCustomInput(String(value));
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          คะแนนเป้าหมายต่อเกม
        </h3>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex rounded-full border border-border bg-muted/60 p-0.5">
          {PRESETS.map((preset) => {
            const active = value === preset;
            return (
              <Button
                key={preset}
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(preset)}
                className={cn(
                  'relative h-auto rounded-full px-3 py-1.5 font-display text-xs font-bold transition-smooth',
                  active
                    ? 'bg-secondary text-primary shadow-dark hover:bg-secondary hover:text-primary'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground',
                  disabled && 'cursor-not-allowed opacity-70',
                )}
              >
                {preset}
              </Button>
            );
          })}
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          หรือ
        </span>
        <Input
          type="number"
          min={1}
          max={99}
          value={customInput}
          disabled={disabled}
          onChange={(event) => {
            const nextRaw = event.target.value;
            setCustomInput(nextRaw);

            const parsed = Number(nextRaw);
            if (
              nextRaw !== '' &&
              Number.isInteger(parsed) &&
              parsed >= 1 &&
              parsed <= 99
            ) {
              onChange(parsed);
            }
          }}
          onBlur={() => setCustomInput(String(value))}
          className="h-8 w-16 rounded-full text-center text-xs"
        />
      </div>
    </div>
  );
};
