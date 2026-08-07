import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'dark' | 'light';
}

const AdminEmptyState = ({ icon: Icon, title, description, action, tone = 'dark' }: AdminEmptyStateProps) => {
  const isLight = tone === 'light';
  return (
    <div className="text-center py-16">
      <div
        className={
          isLight
            ? 'inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-6 border border-blue-200'
            : 'inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20'
        }
      >
        <Icon className={isLight ? 'h-10 w-10 text-blue-500' : 'h-10 w-10 text-blue-500/60'} />
      </div>
      <h3 className={isLight ? 'text-xl font-semibold text-foreground mb-2' : 'text-xl font-semibold text-white mb-2'}>
        {title}
      </h3>
      {description && (
        <p className={isLight ? 'text-muted-foreground mb-6 max-w-md mx-auto' : 'text-blue-300/50 mb-6 max-w-md mx-auto'}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
};

export default AdminEmptyState;
