import { ReactNode, useEffect } from 'react';
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
  // O tema claro do painel vale também para janelas e menus que o Radix abre
  // fora desta árvore (diálogos, listas); por isso a classe vai no body.
  useEffect(() => {
    document.body.classList.add('admin-light');
    return () => document.body.classList.remove('admin-light');
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F6F3] text-[#141B1E] flex">
      <AdminSidebar items={items} activeSection={activeSection} onSelect={onSelectSection} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-end px-4 md:px-8 py-3 border-b border-[#DCDFD8] bg-white">
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="flex items-center space-x-2 border-[#DCDFD8] bg-white text-[#141B1E] hover:bg-[#F5F6F3]"
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
