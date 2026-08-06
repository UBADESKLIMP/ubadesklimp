import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

const AdminEmptyState = ({ icon: Icon, title, description, action }: AdminEmptyStateProps) => {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20">
        <Icon className="h-10 w-10 text-blue-500/60" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && <p className="text-blue-300/50 mb-6 max-w-md mx-auto">{description}</p>}
      {action}
    </div>
  );
};

export default AdminEmptyState;
