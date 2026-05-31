'use client';

import { PresenceUser } from '@/hooks/useDocumentPresence';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
  users: PresenceUser[];
  currentUserId: string;
}

export function PresenceAvatars({ users, currentUserId }: Props) {
  // Filter out current user — no need to show yourself
  const others = users.filter((u) => u.userId !== currentUserId);

  if (others.length === 0) return null;

  const visible = others.slice(0, 4);
  const overflow = others.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      {/* Subtle separator */}
      <div className="h-4 w-px bg-border mx-1" />

      <div className="flex -space-x-2">
        {visible.map((u) => (
          <Tooltip key={u.userId}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-muted text-[10px] font-semibold uppercase text-muted-foreground transition-all cursor-default select-none',
                  u.isEditing
                    ? 'border-orange-400 ring-1 ring-orange-400/50'
                    : 'border-background',
                )}
              >
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={u.nom}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span>{u.nom.charAt(0)}</span>
                )}

                {/* Green "online" dot */}
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-green-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span className="font-medium">{u.nom}</span>
              {u.isEditing && (
                <span className="ml-1 text-orange-400">• editing</span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}

        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground cursor-default select-none">
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {overflow} more viewer{overflow > 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}