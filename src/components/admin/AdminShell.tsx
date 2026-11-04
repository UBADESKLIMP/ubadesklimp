import { ReactNode } from 'react';
import { ArrowLeft, Layers, Moon, Palette, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ADMIN_THEMES, useAdminTheme, type AdminTheme } from '@/hooks/useAdminTheme';
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
  const { theme, setTheme } = useAdminTheme();
  const atual = ADMIN_THEMES.find((t) => t.valor === theme)?.rotulo ?? 'Tema';

  return (
    <div className="min-h-screen bg-adm-bg text-adm-ink flex">
      <AdminSidebar items={items} activeSection={activeSection} onSelect={onSelectSection} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="admin-glass-bar flex items-center justify-end gap-2 px-4 md:px-8 py-3 border-b border-adm-line bg-adm-surface">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label="Escolher o visual do painel"
                title="Visual do painel"
                className="border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-bg"
              >
                <Palette className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{atual}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visual do painel</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as AdminTheme)}>
                {ADMIN_THEMES.map(({ valor, rotulo }) => (
                  <DropdownMenuRadioItem key={valor} value={valor} className="gap-2">
                    {valor === 'light' && <Sun className="h-4 w-4" />}
                    {valor === 'dark' && <Moon className="h-4 w-4" />}
                    {(valor === 'glass-dark' || valor === 'glass-light') && <Layers className="h-4 w-4" />}
                    {rotulo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
