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
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#DCDFD8] flex items-stretch pb-[env(safe-area-inset-bottom)]">
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
                isActive ? 'text-[#0F6B5C]' : 'text-[#55605F]'
              )}
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </button>
          );
        })}
        {overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] text-[11px] font-medium',
              overflowHasActive ? 'text-[#0F6B5C]' : 'text-[#55605F]'
            )}
          >
            <MoreHorizontal className="h-6 w-6" />
            Mais
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-white border-[#DCDFD8] text-[#141B1E]">
          <SheetHeader>
            <SheetTitle className="text-[#141B1E]">Mais opções</SheetTitle>
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
                    isActive ? 'bg-[#0F6B5C]/10 text-[#0F6B5C] font-semibold' : 'bg-[#F5F6F3] text-[#55605F]',
                    item.comingSoon && 'opacity-60'
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-center leading-tight">{item.label}</span>
                  {item.comingSoon && (
                    <span className="text-[9px] uppercase tracking-wide text-[#8A9290]">em breve</span>
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
