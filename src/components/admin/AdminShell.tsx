import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminSidebar from './AdminSidebar';
import AdminMobileNav from './AdminMobileNav';
import { AdminNavItem, AdminSection } from './adminNav';

interface AdminShellProps {
  items: AdminNavItem[];
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  children: ReactNode;
}

const AdminShell = ({ items, activeSection, onSelectSection, children }: AdminShellProps) => {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      <AdminSidebar items={items} activeSection={activeSection} onSelect={onSelectSection} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-end px-4 md:px-8 py-4 border-b border-blue-500/10">
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-900 text-blue-300 hover:text-blue-200 border-slate-800 shadow-lg shadow-black/20"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para o Site</span>
          </Button>
        </div>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      <AdminMobileNav items={items} activeSection={activeSection} onSelect={onSelectSection} />
    </div>
  );
};

export default AdminShell;
