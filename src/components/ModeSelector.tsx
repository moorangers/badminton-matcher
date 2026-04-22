import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Mode = 'singles' | 'doubles';

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
}

const options: { value: Mode; label: string; sublabel: string }[] = [
  { value: 'singles', label: 'Singles', sublabel: '(1v1)' },
  { value: 'doubles', label: 'Doubles', sublabel: '(2v2)' },
];

export const ModeSelector = ({ value, onChange }: ModeSelectorProps) => {
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='flex items-center gap-2'>
        <Trophy className='h-3.5 w-3.5 text-muted-foreground' />
        <h3 className='font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          เลือกรูปแบบการแข่งขัน
        </h3>
      </div>

      <div className='flex rounded-full border border-border bg-muted/60 p-0.5'>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Button
              key={opt.value}
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => onChange(opt.value)}
              className={cn(
                'relative h-auto rounded-full px-3.5 py-2 font-display text-xs font-bold transition-smooth',
                active
                  ? 'bg-secondary text-primary shadow-dark hover:bg-secondary hover:text-primary'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              <span>{opt.label}</span>
              <span
                className={cn(
                  'text-[10px] font-semibold opacity-70',
                  active ? 'text-primary/80' : '',
                )}
              >
                {opt.sublabel}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
