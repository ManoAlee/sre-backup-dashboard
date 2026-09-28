import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Carregando dados...',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500 gap-3', className)}>
      <Loader2 className="w-8 h-8 animate-spin text-sky-600 dark:text-sky-400" />
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</span>
    </div>
  );
};
