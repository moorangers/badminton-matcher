import { useState, type KeyboardEvent } from 'react';
import { Plus, UserCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface Player {
  id: string;
  name: string;
  matches: number;
}

interface PlayerListProps {
  players: Player[];
  onAddMany: (names: string[]) => void;
  onRemove: (id: string) => void;
}

export const PlayerList = ({
  players,
  onAddMany,
  onRemove,
}: PlayerListProps) => {
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const names = trimmed.split(/\s+/).filter(Boolean);
    if (names.length === 0) return;
    onAddMany(names);
    setName('');
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <div className='mb-3 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-primary'>
            <UserCircle2 className='h-4 w-4' />
          </div>
          <h3 className='font-display text-sm font-bold text-foreground'>
            ผู้เล่น
          </h3>
        </div>
        <span className='rounded-full bg-secondary px-2.5 py-1 font-display text-xs font-semibold text-secondary-foreground'>
          {players.length} คน
        </span>
      </div>

      <div className='flex gap-2'>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKey}
          placeholder='เพิ่มชื่อผู้เล่น ex. John Jane Doe'
          className='h-12 rounded-xl border-border bg-background font-medium'
        />

        <Button
          type='button'
          onClick={handleAdd}
          disabled={!name.trim()}
          className='h-12 shrink-0 rounded-xl bg-secondary px-4 font-display font-bold text-secondary-foreground shadow-dark hover:bg-secondary/90'
        >
          <Plus className='h-4 w-4' />
          เพิ่ม
        </Button>
      </div>

      {players.length > 0 ? (
        <div className='mt-4 flex flex-wrap gap-2'>
          {players.map((player) => (
            <div
              key={player.id}
              className='group flex animate-pop-in items-center gap-2 rounded-full bg-primary py-1.5 pl-3 pr-1.5 font-display text-sm font-semibold text-primary-foreground shadow-soft'
            >
              <span className='max-w-[120px] truncate'>{player.name}</span>
              {player.matches > 0 && (
                <span className='rounded-full bg-secondary px-2 text-[10px] font-bold leading-5 text-secondary-foreground'>
                  {player.matches}
                </span>
              )}
              <button
                type='button'
                onClick={() => onRemove(player.id)}
                className='flex h-6 w-6 items-center justify-center rounded-full bg-secondary/15 transition-smooth hover:bg-secondary/30'
                aria-label={`ลบ ${player.name}`}
              >
                <X className='h-3.5 w-3.5' />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className='mt-4 rounded-xl border border-dashed border-border bg-muted/40 py-6 text-center text-xs font-medium text-muted-foreground'>
          ยังไม่มีผู้เล่น เริ่มเพิ่มชื่อด้านบนได้เลย
        </p>
      )}
    </div>
  );
};
