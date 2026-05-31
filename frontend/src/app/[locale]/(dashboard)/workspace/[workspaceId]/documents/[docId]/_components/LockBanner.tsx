'use client';

import { PresenceUser } from '@/hooks/useDocumentPresence';
import { Lock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  lockedBy: PresenceUser;          // the person holding the lock
  onReloadRequest?: () => void;    // called when "Reload" is clicked
  variant?: 'locked' | 'updated'; // locked = you can't edit / updated = content changed
}

export function LockBanner({ lockedBy, onReloadRequest, variant = 'locked' }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b px-4 py-2 text-sm font-medium',
        variant === 'locked'
          ? 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400'
          : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      )}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" />

      <span className="flex-1">
        {variant === 'locked' ? (
          <>
            <span className="font-semibold">{lockedBy.nom}</span>
            {' is currently editing — editing is locked for others.'}
          </>
        ) : (
          <>
            <span className="font-semibold">{lockedBy.nom}</span>
            {' just saved changes to this document.'}
          </>
        )}
      </span>

      {variant === 'updated' && onReloadRequest && (
        <button
          onClick={onReloadRequest}
          className="flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2.5 py-1 text-xs font-semibold hover:bg-blue-500/25 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Reload
        </button>
      )}
    </div>
  );
}