import { Clock, type LucideIcon } from 'lucide-react';

interface AdminComingSoonProps {
  icon?: LucideIcon;
  title: string;
  description: string;
}

const AdminComingSoon = ({ icon: Icon = Clock, title, description }: AdminComingSoonProps) => {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center max-w-md px-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20">
          <Icon className="h-10 w-10 text-blue-500/60" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-blue-300/50">{description}</p>
      </div>
    </div>
  );
};

export default AdminComingSoon;
