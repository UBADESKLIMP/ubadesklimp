import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
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
  const { bar, overflow } = getMobileNavSplit(items);
  const overflowHasActive = overflow.some((item) => item.key === activeSection);

  const handleSelect = (section: AdminSection) => {
    onSelect(section);
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0c0c14] border-t border-blue-500/10 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {bar.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelect(item.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px]',
                isActive ? 'text-blue-300' : 'text-blue-300/50'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
        {overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px]',
              overflowHasActive ? 'text-blue-300' : 'text-blue-300/50'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-[#0c0c14] border-blue-500/10 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Mais opções</SheetTitle>
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
                    'flex flex-col items-center justify-center gap-2 rounded-lg px-2 py-4 text-xs min-h-[44px]',
                    isActive ? 'bg-blue-600/30 text-white' : 'bg-blue-500/5 text-blue-300/70',
                    item.comingSoon && 'opacity-60'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{item.label}</span>
                  {item.comingSoon && (
                    <span className="text-[9px] uppercase tracking-wide text-blue-300/40">em breve</span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdminMobileNav;
