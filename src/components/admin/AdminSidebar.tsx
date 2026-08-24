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
        'hidden md:flex flex-col shrink-0 sticky top-0 h-screen self-start bg-[#0c0c14] border-r border-blue-500/10 py-4 transition-[width] duration-200 ease-out overflow-hidden',
        expanded ? 'w-52' : 'w-[52px]'
      )}
    >
      <div className="px-3 mb-4 h-4">
        <span
          className={cn(
            'block text-[10px] uppercase tracking-wider text-blue-300/40 whitespace-nowrap transition-opacity duration-150',
            expanded ? 'opacity-100' : 'opacity-0'
          )}
        >
          Ubadesklimp
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2">
        {groups.map(({ group, items: groupItems }, index) => (
          <div key={group ?? 'ungrouped'} className={index > 0 ? 'mt-3' : undefined}>
            {group && (
              <div
                className={cn(
                  'px-2 mb-1 text-[9px] uppercase tracking-wider text-blue-300/30 whitespace-nowrap transition-opacity duration-150',
                  expanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
                )}
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
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-blue-600/30 text-white font-medium'
                      : 'text-blue-300/70 hover:bg-blue-500/10 hover:text-blue-200',
                    item.comingSoon && 'opacity-60'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span
                    className={cn(
                      'whitespace-nowrap transition-opacity duration-150',
                      expanded ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {item.label}
                  </span>
                  {item.comingSoon && expanded && (
                    <span className="ml-auto text-[9px] uppercase tracking-wide text-blue-300/40 whitespace-nowrap">
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
