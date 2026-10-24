import { ReactNode } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminTheme } from '@/hooks/useAdminTheme';
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
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-adm-bg text-adm-ink flex">
      <AdminSidebar items={items} activeSection={activeSection} onSelect={onSelectSection} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-end gap-2 px-4 md:px-8 py-3 border-b border-adm-line bg-adm-surface">
          <Button
            variant="outline"
            onClick={toggleTheme}
            aria-label={isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
            title={isDark ? 'Tema claro' : 'Tema escuro'}
            className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-bg"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{isDark ? 'Tema claro' : 'Tema escuro'}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="flex items-center space-x-2 border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-bg"
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
