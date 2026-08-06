import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}

const AdminStatCard = ({ icon: Icon, label, value, hint }: AdminStatCardProps) => {
  return (
    <Card className="bg-[#12121a] border-blue-500/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-blue-300/70">{label}</CardTitle>
        <Icon className="h-4 w-4 text-blue-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-blue-400">{value}</div>
        {hint && <p className="text-xs text-blue-300/50 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
};

export default AdminStatCard;
