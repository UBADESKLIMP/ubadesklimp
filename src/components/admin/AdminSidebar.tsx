import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AdminNavGroup, AdminNavItem, AdminSection, ADMIN_NAV_GROUP_LABELS } from './adminNav';

interface AdminSidebarProps {
  items: AdminNavItem[];
  activeSection: AdminSection;
  onSelect: (section: AdminSection) => void;
}

const GROUP_ORDER: (AdminNavGroup | undefined)[] = [undefined, 'catalogo', 'operacao', 'equipe'];

const AdminSidebar = ({ items, activeSection, onSelect }: AdminSidebarProps) => {
  const [expanded, setExpanded] = useState(false);

  const groups = GROUP_ORDER
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        'hidden md:flex flex-col shrink-0 sticky top-0 h-screen self-start bg-white border-r border-[#DCDFD8] py-4 transition-[width] duration-200 ease-out overflow-hidden',
        expanded ? 'w-56' : 'w-[60px]'
      )}
    >
      <div className="px-3 mb-5 h-9 flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-lg bg-[#0F6B5C] text-white flex items-center justify-center font-semibold text-sm">
          U
        </span>
        <span
          className={cn(
            'whitespace-nowrap text-sm font-semibold text-[#141B1E] transition-opacity duration-150',
            expanded ? 'opacity-100' : 'opacity-0'
          )}
        >
          Ubadesklimp
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {groups.map(({ group, items: groupItems }, index) => (
          <div key={group ?? 'ungrouped'} className={index > 0 ? 'mt-3' : undefined}>
            {group && (
              // O rótulo guarda a mesma altura recolhido e expandido: só some
              // a tinta. Antes ele tinha altura zero e, ao expandir, empurrava
              // tudo abaixo dele 41 px pra baixo — o ícone fugia do cursor na
              // hora do clique.
              <div
                className={cn(
                  'px-2 mb-1 h-3 flex items-end text-[10px] leading-none uppercase tracking-wider font-medium',
                  'text-[#8A9290] whitespace-nowrap transition-opacity duration-150',
                  expanded ? 'opacity-100' : 'opacity-0'
                )}
                aria-hidden={!expanded}
              >
                {ADMIN_NAV_GROUP_LABELS[group]}
              </div>
            )}
            {groupItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  title={item.label}
                  className={cn(
                    'relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-[#0F6B5C]/10 text-[#0F6B5C] font-semibold'
                      : 'text-[#55605F] hover:bg-[#F5F6F3] hover:text-[#141B1E]',
                    item.comingSoon && 'opacity-60'
                  )}
                >
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0F6B5C]" />}
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span
                    className={cn(
                      'whitespace-nowrap transition-opacity duration-150',
                      expanded ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {item.label}
                  </span>
                  {item.comingSoon && expanded && (
                    <span className="ml-auto text-[9px] uppercase tracking-wide text-[#8A9290] whitespace-nowrap">
                      em breve
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
