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
    <Card className="bg-adm-surface border-adm-line shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-adm-muted">{label}</CardTitle>
        <Icon className="h-4 w-4 text-adm-accent" />
      </CardHeader>
      <CardContent>
        <div className="font-mono text-3xl font-semibold tabular-nums text-adm-ink">{value}</div>
        {hint && <p className="text-xs text-adm-faint mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
};

export default AdminStatCard;
