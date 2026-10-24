import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

const AdminPageHeader = ({ icon: Icon, title, description, action }: AdminPageHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="h-11 w-11 bg-[#0F6B5C]/10 rounded-xl text-[#0F6B5C] flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-2xl font-semibold text-[#141B1E]">{title}</h2>
          {description && <p className="text-[#55605F] text-sm mt-1">{description}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

export default AdminPageHeader;
