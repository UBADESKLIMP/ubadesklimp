import { useState } from 'react';
import { LogOut, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AdminNavItem, AdminSection, getMobileNavSplit } from './adminNav';

interface AdminMobileNavProps {
  items: AdminNavItem[];
  activeSection: AdminSection;
  onSelect: (section: AdminSection) => void;
}

const AdminMobileNav = ({ items, activeSection, onSelect }: AdminMobileNavProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const { signOut } = useAuth();
  const { bar, overflow } = getMobileNavSplit(items);
  const overflowHasActive = overflow.some((item) => item.key === activeSection);

  const handleSelect = (section: AdminSection) => {
    onSelect(section);
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-adm-surface border-t border-adm-line flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {bar.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelect(item.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] text-[11px] font-medium',
                isActive ? 'text-adm-accent' : 'text-adm-muted'
              )}
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] text-[11px] font-medium',
            overflowHasActive ? 'text-adm-accent' : 'text-adm-muted'
          )}
        >
          <MoreHorizontal className="h-6 w-6" />
          Mais
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-adm-surface border-adm-line text-adm-ink">
          <SheetHeader>
            <SheetTitle className="text-adm-ink">Mais opções</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 mt-4 pb-4">
            {overflow.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelect(item.key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-lg px-2 py-4 text-xs min-h-[64px]',
                    isActive ? 'bg-adm-accent-soft text-adm-accent font-semibold' : 'bg-adm-bg text-adm-muted',
                    item.comingSoon && 'opacity-60'
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-center leading-tight">{item.label}</span>
                  {item.comingSoon && (
                    <span className="text-[9px] uppercase tracking-wide text-adm-faint">em breve</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={signOut}
              className="flex flex-col items-center justify-center gap-2 rounded-lg px-2 py-4 text-xs min-h-[64px] bg-adm-bg text-adm-muted"
            >
              <LogOut className="h-6 w-6" />
              <span className="text-center leading-tight">Sair da conta</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdminMobileNav;
