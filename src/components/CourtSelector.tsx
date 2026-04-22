import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CourtSelectorProps {
  value: number;
  onChange: (n: number) => void;
}

const options: { value: number; label: number }[] = [
  { value: 1, label: 1 },
  { value: 2, label: 2 },
  { value: 3, label: 3 },
];

export const CourtSelector = ({ value, onChange }: CourtSelectorProps) => {
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='flex items-center gap-2'>
        <LayoutGrid className='h-3.5 w-3.5 text-muted-foreground' />
        <h3 className='font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          เลือกจำนวนคอร์ด
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
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
