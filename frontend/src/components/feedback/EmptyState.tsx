import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nenhum registro encontrado',
  message = 'Não existem dados disponíveis para os filtros selecionados.',
  icon,
  action,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg gap-3', className)}>
      <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{message}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
