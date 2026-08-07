# Admin — Redesign Visual e Navegação (Parte B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as 7 abas horizontais do admin por uma sidebar (desktop, recolhida por padrão, expande no hover) + barra inferior (mobile), introduzir uma tela "Início" leve e por papel, e unificar cabeçalho/estado-vazio/estado-de-carregamento em todas as seções existentes — sem mudar nenhuma lógica de dados, permissões ou funcionalidade.

**Architecture:** Uma nova pasta `src/components/admin/` concentra a "casca" (shell, sidebar, nav mobile, header/empty/loading/coming-soon/stat-card compartilhados) e a config de navegação (`adminNav.ts`, única fonte de verdade pra quais itens existem, ícone, grupo, permissão). `Admin.tsx` deixa de usar `Tabs`/`TabsContent` e passa a controlar um estado `activeSection` simples, renderizando o componente de cada seção dentro de `<AdminShell>`. Os componentes de cada seção (`CategoryManager`, `OrdersManager`, etc.) recebem apenas trocas cirúrgicas: seus blocos de carregamento/vazio/cabeçalho passam a usar os componentes compartilhados — nenhuma mudança de dados, hooks ou comportamento.

**Tech Stack:** React + TypeScript + Tailwind + shadcn/ui (já usados no projeto). Nenhuma dependência nova.

## Global Constraints

- Paleta não muda: primária azul `hsl(210 85% 45%)`, fundo do admin `#0a0a0f`, fundo de cartão `#12121a`, bordas `border-blue-500/20` ou `border-blue-500/10`. Tipografia continua Inter/Poppins (`font-heading` para títulos, já existente).
- Breakpoint desktop/mobile: `md` (Tailwind padrão, 768px) — sidebar visível só em `md:` pra cima, barra inferior só abaixo disso.
- Nenhuma mudança em: RLS, `useStaffAccess`, hooks de dados (`useProducts`, `useCategories`, `useAdminOrders`, `useSalesStats`, `usePriorityProducts`, `useStaffMembers`), formulários (`ProductForm`), ou qualquer lógica de negócio. Só a casca visual/nav muda.
- Sidebar: recolhida por padrão (`w-[52px]`), expande no hover pra `w-52` (208px), com `transition-[width] duration-200`. Não é um botão de toggle — é `onMouseEnter`/`onMouseLeave`.
- Barra mobile: no máximo 4 posições fixas + "Mais". Ordem de prioridade fixa: `home` → `products` → `orders` → `financeiro`. Nunca preenche posições da barra principal com Automotivo/Destaques/Categorias/Funcionários — esses ficam sempre dentro de "Mais" (junto com Fornecedores/Faltantes).
- Itens "em breve" (Fornecedores, Faltantes) aparecem sempre visíveis pra qualquer staff, em qualquer papel, e são clicáveis — ao clicar, mostram a tela `AdminComingSoon`, não ficam com `disabled`/inertes.
- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) é a verificação real do projeto — não `npm run build`.
- Todas as strings visíveis pro usuário em português, consistente com o resto do projeto.

---

### Task 1: Config de navegação compartilhada (`adminNav.ts`)

**Files:**
- Create: `src/components/admin/adminNav.ts`
- Modify: `src/hooks/useStaffAccess.ts:7` (exportar a interface `StaffAccess`, hoje não-exportada)
- Test: nenhum teste automatizado (padrão do projeto) — verificado por `npm run typecheck` e pelos testes manuais da Task 19.

**Interfaces:**
- Produz: `AdminSection` (union type com as 10 chaves de seção), `AdminNavGroup`, `AdminNavItem` (`{ key, label, icon, permission?, adminOnly?, comingSoon?, group? }`), `ADMIN_NAV_ITEMS` (array com os 10 itens, na ordem exata da sidebar), `ADMIN_NAV_GROUP_LABELS`, `getVisibleNavItems(staffAccess): AdminNavItem[]`, `getMobileNavSplit(visibleItems): { bar: AdminNavItem[]; overflow: AdminNavItem[] }`.
- Consome: `StaffAccess`/`StaffPermission` de `@/hooks/useStaffAccess`.

- [ ] **Step 1: Exportar `StaffAccess` em `useStaffAccess.ts`**

Em `src/hooks/useStaffAccess.ts:7`, troque:

```ts
interface StaffAccess {
```

por:

```ts
export interface StaffAccess {
```

Nenhuma outra linha do arquivo muda.

- [ ] **Step 2: Criar `src/components/admin/adminNav.ts`**

```ts
import {
  LayoutDashboard,
  DollarSign,
  ClipboardList,
  Package,
  Car,
  Star,
  Tags,
  Truck,
  ClipboardCheck,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { StaffAccess, StaffPermission } from '@/hooks/useStaffAccess';

export type AdminSection =
  | 'home'
  | 'financeiro'
  | 'orders'
  | 'products'
  | 'automotive'
  | 'highlights'
  | 'categories'
  | 'suppliers'
  | 'missing'
  | 'staff';

export type AdminNavGroup = 'catalogo' | 'operacao' | 'equipe';

export interface AdminNavItem {
  key: AdminSection;
  label: string;
  icon: LucideIcon;
  permission?: StaffPermission;
  adminOnly?: boolean;
  comingSoon?: boolean;
  group?: AdminNavGroup;
}

export const ADMIN_NAV_GROUP_LABELS: Record<AdminNavGroup, string> = {
  catalogo: 'Catálogo',
  operacao: 'Operação',
  equipe: 'Equipe',
};

// Ordem exata de cima pra baixo na sidebar. A barra mobile usa uma ordem de
// prioridade própria (ver getMobileNavSplit), não esta ordem.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'home', label: 'Início', icon: LayoutDashboard },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign, permission: 'financeiro' },
  { key: 'orders', label: 'Pedidos', icon: ClipboardList, permission: 'financeiro' },
  { key: 'products', label: 'Produtos', icon: Package, permission: 'produtos', group: 'catalogo' },
  { key: 'automotive', label: 'Automotivo', icon: Car, permission: 'produtos', group: 'catalogo' },
  { key: 'highlights', label: 'Destaques', icon: Star, permission: 'produtos', group: 'catalogo' },
  { key: 'categories', label: 'Categorias', icon: Tags, permission: 'produtos', group: 'catalogo' },
  { key: 'suppliers', label: 'Fornecedores', icon: Truck, comingSoon: true, group: 'operacao' },
  { key: 'missing', label: 'Faltantes', icon: ClipboardCheck, comingSoon: true, group: 'operacao' },
  { key: 'staff', label: 'Funcionários', icon: Shield, adminOnly: true, group: 'equipe' },
];

// Itens "em breve" aparecem pra qualquer staff. Itens adminOnly só pra admin.
// Itens sem permission (hoje só 'home') aparecem pra qualquer staff.
export const canSeeNavItem = (item: AdminNavItem, staffAccess: StaffAccess): boolean => {
  if (item.comingSoon) return true;
  if (item.adminOnly) return staffAccess.isAdmin;
  if (!item.permission) return true;
  return staffAccess.isAdmin || staffAccess.permissions.has(item.permission);
};

export const getVisibleNavItems = (staffAccess: StaffAccess): AdminNavItem[] =>
  ADMIN_NAV_ITEMS.filter((item) => canSeeNavItem(item, staffAccess));

const MOBILE_BAR_PRIORITY: AdminSection[] = ['home', 'products', 'orders', 'financeiro'];

// A barra principal do mobile é sempre um subconjunto compactado desta lista
// de prioridade fixa — nunca puxa Automotivo/Destaques/Categorias/Funcionários
// pra dentro dela, mesmo que sobre espaço. Esses ficam sempre em "overflow".
export const getMobileNavSplit = (
  visibleItems: AdminNavItem[]
): { bar: AdminNavItem[]; overflow: AdminNavItem[] } => {
  const byKey = new Map(visibleItems.map((item) => [item.key, item]));

  const bar = MOBILE_BAR_PRIORITY
    .map((key) => byKey.get(key))
    .filter((item): item is AdminNavItem => Boolean(item));

  const barKeys = new Set(bar.map((item) => item.key));
  const overflow = visibleItems.filter((item) => !barKeys.has(item.key));

  return { bar, overflow };
};
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros (este arquivo ainda não é importado por ninguém, então só valida sintaxe/tipos internos).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/adminNav.ts src/hooks/useStaffAccess.ts
git commit -m "feat(admin): config compartilhada de navegação (adminNav)"
```

---

### Task 2: `AdminPageHeader`

**Files:**
- Create: `src/components/admin/AdminPageHeader.tsx`

**Interfaces:**
- Produz: `AdminPageHeader` — `{ icon?: LucideIcon; title: string; description?: string; action?: ReactNode }`.
- Consome: nada de tasks anteriores.

- [ ] **Step 1: Criar o componente**

```tsx
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

const AdminPageHeader = ({ icon: Icon, title, description, action }: AdminPageHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 bg-blue-600/20 rounded-xl border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-2xl font-heading text-white">{title}</h2>
          {description && <p className="text-blue-300/60 text-sm mt-1">{description}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

export default AdminPageHeader;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminPageHeader.tsx
git commit -m "feat(admin): componente compartilhado AdminPageHeader"
```

---

### Task 3: `AdminEmptyState`

**Files:**
- Create: `src/components/admin/AdminEmptyState.tsx`

**Interfaces:**
- Produz: `AdminEmptyState` — `{ icon: LucideIcon; title: string; description?: string; action?: ReactNode }`.

- [ ] **Step 1: Criar o componente**

```tsx
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

const AdminEmptyState = ({ icon: Icon, title, description, action }: AdminEmptyStateProps) => {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20">
        <Icon className="h-10 w-10 text-blue-500/60" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && <p className="text-blue-300/50 mb-6 max-w-md mx-auto">{description}</p>}
      {action}
    </div>
  );
};

export default AdminEmptyState;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminEmptyState.tsx
git commit -m "feat(admin): componente compartilhado AdminEmptyState"
```

---

### Task 4: `AdminLoadingState`

**Files:**
- Create: `src/components/admin/AdminLoadingState.tsx`

**Interfaces:**
- Produz: `AdminLoadingState` — `{ label?: string; rows?: number }`, default `label='Carregando...'`, `rows=4`.

- [ ] **Step 1: Criar o componente**

```tsx
interface AdminLoadingStateProps {
  label?: string;
  rows?: number;
}

const AdminLoadingState = ({ label = 'Carregando...', rows = 4 }: AdminLoadingStateProps) => {
  return (
    <div className="py-8 space-y-3" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-16 rounded-lg bg-blue-500/5 border border-blue-500/10 animate-pulse"
        />
      ))}
    </div>
  );
};

export default AdminLoadingState;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminLoadingState.tsx
git commit -m "feat(admin): componente compartilhado AdminLoadingState"
```

---

### Task 5: `AdminComingSoon`

**Files:**
- Create: `src/components/admin/AdminComingSoon.tsx`

**Interfaces:**
- Produz: `AdminComingSoon` — `{ icon?: LucideIcon; title: string; description: string }`, default `icon=Clock`.

- [ ] **Step 1: Criar o componente**

```tsx
import { Clock, type LucideIcon } from 'lucide-react';

interface AdminComingSoonProps {
  icon?: LucideIcon;
  title: string;
  description: string;
}

const AdminComingSoon = ({ icon: Icon = Clock, title, description }: AdminComingSoonProps) => {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center max-w-md px-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20">
          <Icon className="h-10 w-10 text-blue-500/60" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-blue-300/50">{description}</p>
      </div>
    </div>
  );
};

export default AdminComingSoon;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminComingSoon.tsx
git commit -m "feat(admin): componente compartilhado AdminComingSoon"
```

---

### Task 6: `AdminStatCard`

**Files:**
- Create: `src/components/admin/AdminStatCard.tsx`

**Interfaces:**
- Produz: `AdminStatCard` — `{ icon: LucideIcon; label: string; value: string | number; hint?: string }`.
- Consome: `Card`/`CardContent`/`CardHeader`/`CardTitle` de `@/components/ui/card` (já existentes no projeto).

- [ ] **Step 1: Criar o componente**

```tsx
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
    <Card className="bg-[#12121a] border-blue-500/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-blue-300/70">{label}</CardTitle>
        <Icon className="h-4 w-4 text-blue-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-blue-400">{value}</div>
        {hint && <p className="text-xs text-blue-300/50 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
};

export default AdminStatCard;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminStatCard.tsx
git commit -m "feat(admin): componente compartilhado AdminStatCard"
```

---

### Task 7: `AdminSidebar` (desktop)

**Files:**
- Create: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consome: `AdminNavItem`, `AdminNavGroup`, `ADMIN_NAV_GROUP_LABELS`, `AdminSection` de `./adminNav` (Task 1). `cn` de `@/lib/utils` (já existe no projeto, usado em `AdminDashboard.tsx`).
- Produz: `AdminSidebar` — `{ items: AdminNavItem[]; activeSection: AdminSection; onSelect: (section: AdminSection) => void }`.

- [ ] **Step 1: Criar o componente**

```tsx
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
        'hidden md:flex flex-col shrink-0 bg-[#0c0c14] border-r border-blue-500/10 py-4 transition-[width] duration-200 ease-out overflow-hidden',
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
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): AdminSidebar (desktop, recolhe/expande no hover)"
```

---

### Task 8: `AdminMobileNav` (mobile)

**Files:**
- Create: `src/components/admin/AdminMobileNav.tsx`

**Interfaces:**
- Consome: `AdminNavItem`, `AdminSection`, `getMobileNavSplit` de `./adminNav` (Task 1). `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` de `@/components/ui/sheet` (já existe no projeto). `cn` de `@/lib/utils`.
- Produz: `AdminMobileNav` — `{ items: AdminNavItem[]; activeSection: AdminSection; onSelect: (section: AdminSection) => void }`.

- [ ] **Step 1: Criar o componente**

```tsx
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
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminMobileNav.tsx
git commit -m "feat(admin): AdminMobileNav (barra inferior + folha Mais)"
```

---

### Task 9: `AdminShell` (layout wrapper)

**Files:**
- Create: `src/components/admin/AdminShell.tsx`

**Interfaces:**
- Consome: `AdminSidebar` (Task 7), `AdminMobileNav` (Task 8), `AdminNavItem`/`AdminSection` de `./adminNav` (Task 1), `Button` de `@/components/ui/button`.
- Produz: `AdminShell` — `{ items: AdminNavItem[]; activeSection: AdminSection; onSelectSection: (section: AdminSection) => void; children: ReactNode }`.

- [ ] **Step 1: Criar o componente**

```tsx
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
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminShell.tsx
git commit -m "feat(admin): AdminShell (layout combinando sidebar + nav mobile)"
```

---

### Task 10: `ProductsHomeSummary`

**Files:**
- Create: `src/components/admin/ProductsHomeSummary.tsx`

**Interfaces:**
- Consome: `useProducts` de `@/hooks/useProducts` (já existe, retorna `{ products: ProductWithVariations[], loading, ... }`), `AdminStatCard` (Task 6), `AdminSection` de `./adminNav` (Task 1), `Button` de `@/components/ui/button`.
- Produz: `ProductsHomeSummary` — `{ onNavigate: (section: AdminSection) => void }`.

- [ ] **Step 1: Criar o componente**

```tsx
import { useMemo } from 'react';
import { Package, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/hooks/useProducts';
import AdminStatCard from './AdminStatCard';
import { AdminSection } from './adminNav';

interface ProductsHomeSummaryProps {
  onNavigate: (section: AdminSection) => void;
}

const ProductsHomeSummary = ({ onNavigate }: ProductsHomeSummaryProps) => {
  const { products, loading } = useProducts();

  const incompleteCount = useMemo(
    () => products.filter((product) => !product.image_url || !product.description).length,
    [products]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading text-white">Produtos</h3>
        <Button
          size="sm"
          onClick={() => onNavigate('products')}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo produto
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdminStatCard
          icon={Package}
          label="Produtos ativos"
          value={loading ? '...' : products.length}
        />
        <AdminStatCard
          icon={AlertTriangle}
          label="Incompletos"
          value={loading ? '...' : incompleteCount}
          hint="Sem imagem ou sem descrição"
        />
      </div>
    </div>
  );
};

export default ProductsHomeSummary;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ProductsHomeSummary.tsx
git commit -m "feat(admin): ProductsHomeSummary (bloco de Início pra permissão produtos)"
```

---

### Task 11: `AdminHome`

**Files:**
- Create: `src/components/admin/AdminHome.tsx`

**Interfaces:**
- Consome: `useStaffAccess` de `@/hooks/useStaffAccess`, `AdminPageHeader` (Task 2), `AdminComingSoon` (Task 5), `ProductsHomeSummary` (Task 10), `AdminSection` de `./adminNav` (Task 1).
- Produz: `AdminHome` — `{ onNavigate: (section: AdminSection) => void }`.

- [ ] **Step 1: Criar o componente**

```tsx
import type { LucideIcon } from 'lucide-react';
import { DollarSign, ClipboardList, ChevronRight } from 'lucide-react';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import AdminPageHeader from './AdminPageHeader';
import AdminComingSoon from './AdminComingSoon';
import ProductsHomeSummary from './ProductsHomeSummary';
import { AdminSection } from './adminNav';

interface AdminHomeProps {
  onNavigate: (section: AdminSection) => void;
}

interface ShortcutCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}

const ShortcutCard = ({ icon: Icon, title, description, onClick }: ShortcutCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-4 p-4 rounded-xl bg-[#12121a] border border-blue-500/20 hover:border-blue-500/40 hover:bg-[#16161f] transition-colors text-left"
  >
    <div className="p-2.5 bg-blue-600/20 rounded-xl border border-blue-500/20 text-blue-400 shrink-0">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-white">{title}</p>
      <p className="text-sm text-blue-300/50">{description}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-blue-300/40 shrink-0" />
  </button>
);

const AdminHome = ({ onNavigate }: AdminHomeProps) => {
  const staffAccess = useStaffAccess();
  const showFinanceiro = staffAccess.isAdmin || staffAccess.permissions.has('financeiro');
  const showProdutos = staffAccess.isAdmin || staffAccess.permissions.has('produtos');
  const hasNothing = !showFinanceiro && !showProdutos;

  return (
    <div>
      <AdminPageHeader title="Início" description="Visão geral do que você pode fazer por aqui." />

      {hasNothing ? (
        <AdminComingSoon
          title="Ainda sem seções liberadas"
          description="Sua conta ainda não tem nenhuma seção com conteúdo pronto. As próximas etapas do painel (Fornecedores e Faltantes) estão a caminho."
        />
      ) : (
        <div className="space-y-8">
          {showFinanceiro && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShortcutCard
                icon={DollarSign}
                title="Financeiro"
                description="Vendas, faturamento e comparativos"
                onClick={() => onNavigate('financeiro')}
              />
              <ShortcutCard
                icon={ClipboardList}
                title="Pedidos"
                description="Acompanhe e atualize o status dos pedidos"
                onClick={() => onNavigate('orders')}
              />
            </div>
          )}

          {showProdutos && <ProductsHomeSummary onNavigate={onNavigate} />}
        </div>
      )}
    </div>
  );
};

export default AdminHome;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminHome.tsx
git commit -m "feat(admin): AdminHome (tela de Início por papel)"
```

---

### Task 12: Rewire `Admin.tsx`

**Files:**
- Modify: `src/pages/Admin.tsx` (reescrita completa do arquivo)

**Interfaces:**
- Consome: `AdminShell` (Task 9), `AdminHome` (Task 11), `AdminPageHeader` (Task 2), `AdminEmptyState` (Task 3), `AdminComingSoon` (Task 5), `AdminSection`/`getVisibleNavItems` de `@/components/admin/adminNav` (Task 1). Todos os componentes de seção já existentes (`AdminDashboard`, `OrdersManager`, `AutomotiveProductsManager`, `PriorityProductsManager`, `CategoryManager`, `StaffManager`) continuam consumidos exatamente como hoje, sem mudança de props.

**Global constraint relevante:** nenhuma mudança de comportamento nas seções existentes — só a casca de navegação/layout muda.

- [ ] **Step 1: Reescrever `src/pages/Admin.tsx` por completo**

Note sobre a remoção do bloco `visibleTabs.length === 0` ("Nenhuma seção disponível"): esse bloco existia porque, antes desta parte, só quem tinha permissão `financeiro` enxergava alguma tela — um funcionário só com `faltantes`/`fornecedores` ficava sem nenhuma aba visível. Agora **Início é sempre visível pra qualquer staff** (não depende de nenhuma permissão), então esse caso não pode mais acontecer — `getVisibleNavItems` nunca retorna uma lista vazia para quem chega em `Admin.tsx` (a rota já exige `requireStaff` via `ProtectedRoute`). O bloco é removido, não mantido como guarda morta.

Note sobre a aba "Funcionários": no código antigo, `TabsContent value="staff"` era condicionado a `visibleTabs.includes('staff')` por causa de uma particularidade do Radix Tabs (o conteúdo podia renderizar mesmo sem o trigger correspondente visível — foi um bug real corrigido na Parte A, commit `44595a8`). Com o novo modelo (um `switch` simples sobre `activeSection`, sem Radix Tabs), essa particularidade não existe: `activeSection` só pode virar `'staff'` através de `onSelectSection('staff')`, chamado a partir de um item de nav que `getVisibleNavItems` já filtrou por `adminOnly`. Por isso o `case 'staff'` no switch abaixo renderiza `<StaffManager />` direto, sem guarda redundante.

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Package, Search, Loader2, Truck, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductWithVariations } from '@/types/product';
import ProductForm from '@/components/ProductForm';
import CategoryManager from '@/components/CategoryManager';
import OrdersManager from '@/components/OrdersManager';
import AutomotiveProductsManager from '@/components/AutomotiveProductsManager';
import AdminDashboard from '@/components/AdminDashboard';
import PriorityProductsManager from '@/components/PriorityProductsManager';
import StaffManager from '@/components/StaffManager';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import DraggableAdminGrid from '@/components/DraggableAdminGrid';
import AdminProductFilters, { SortOption } from '@/components/AdminProductFilters';
import { normalizeText } from '@/lib/utils';
import AdminShell from '@/components/admin/AdminShell';
import AdminHome from '@/components/admin/AdminHome';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminComingSoon from '@/components/admin/AdminComingSoon';
import { AdminSection, getVisibleNavItems } from '@/components/admin/adminNav';

const Admin = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct, updateDisplayOrder, refetch } = useProducts();
  const { categories: limpezaCategories } = useCategories('limpeza');
  const staffAccess = useStaffAccess();

  const [activeSection, setActiveSection] = useState<AdminSection>('home');
  const visibleNavItems = useMemo(() => getVisibleNavItems(staffAccess), [staffAccess]);

  const [editingProduct, setEditingProduct] = useState<ProductWithVariations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  // Atualizar editingProduct quando products mudar
  useEffect(() => {
    if (editingProduct) {
      const updatedProduct = products.find(p => p.id === editingProduct.id);
      if (updatedProduct) {
        setEditingProduct(updatedProduct);
      }
    }
  }, [products]);

  const handleSaveProduct = async (productData: any) => {
    try {
      let savedProduct;
      const { fragrances, ...productPayload } = productData;

      if (editingProduct) {
        savedProduct = await updateProduct(editingProduct.id, productPayload);

        if (fragrances && fragrances.length > 0) {
          const { supabase } = await import('@/integrations/supabase/client');

          await supabase
            .from('product_fragrances')
            .delete()
            .eq('product_id', editingProduct.id);

          const fragrancesToInsert = fragrances.map((fragrance: any) => ({
            product_id: editingProduct.id,
            name: fragrance.name,
            description: fragrance.description || null,
            image_url: fragrance.image_url || null,
            available_literages: fragrance.available_literages || [],
            order_index: fragrance.order || 0
          }));

          await supabase
            .from('product_fragrances')
            .insert(fragrancesToInsert);

          await supabase
            .from('products')
            .update({ has_fragrances: fragrances.length > 0 })
            .eq('id', editingProduct.id);
        }

        await refetch();
      } else {
        savedProduct = await createProduct(productPayload);

        if (fragrances && fragrances.length > 0 && savedProduct?.id) {
          const { supabase } = await import('@/integrations/supabase/client');

          const fragrancesToInsert = fragrances.map((fragrance: any) => ({
            product_id: savedProduct.id,
            name: fragrance.name,
            description: fragrance.description || null,
            image_url: fragrance.image_url || null,
            available_literages: fragrance.available_literages || [],
            order_index: fragrance.order || 0
          }));

          await supabase
            .from('product_fragrances')
            .insert(fragrancesToInsert);

          await supabase
            .from('products')
            .update({ has_fragrances: true })
            .eq('id', savedProduct.id);
        }

        await refetch();
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct(id);
    }
  };

  const handleReorderProducts = useCallback(async (reorderedProducts: ProductWithVariations[]) => {
    await updateDisplayOrder(reorderedProducts);
  }, [updateDisplayOrder]);

  const limpezaProducts = useMemo(() =>
    products.filter(p => (p.line_type ?? 'limpeza') === 'limpeza'),
    [products]
  );

  const filteredLimpezaProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    let filtered = limpezaProducts.filter(product => {
      const matchesSearch =
        normalizeText(product.name).includes(normalizedSearch) ||
        normalizeText(product.description || '').includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === 'all' || product.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });

    if (sortOption !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortOption) {
          case 'price_asc':
            return (a.price || 0) - (b.price || 0);
          case 'price_desc':
            return (b.price || 0) - (a.price || 0);
          case 'name_asc':
            return a.name.localeCompare(b.name, 'pt-BR');
          case 'name_desc':
            return b.name.localeCompare(a.name, 'pt-BR');
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [limpezaProducts, searchTerm, categoryFilter, sortOption]);

  if (loading || staffAccess.loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-blue-300/60">Carregando painel...</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <AdminHome onNavigate={setActiveSection} />;

      case 'financeiro':
        return <AdminDashboard />;

      case 'orders':
        return <OrdersManager />;

      case 'products':
        return (
          <div>
            <AdminPageHeader
              title="Produtos de Limpeza"
              description="Arraste para reorganizar a ordem de exibição na vitrine."
              action={
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingProduct(null)} className="bg-blue-600 hover:bg-blue-500 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f18] border-blue-500/30 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">
                        {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                      </DialogTitle>
                    </DialogHeader>
                    <ProductForm
                      product={editingProduct}
                      onSave={handleSaveProduct}
                      onCancel={() => setIsDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              }
            />

            <AdminProductFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              categories={limpezaCategories}
              resultCount={filteredLimpezaProducts.length}
              totalCount={limpezaProducts.length}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />

            {filteredLimpezaProducts.length > 0 ? (
              <DraggableAdminGrid
                products={filteredLimpezaProducts}
                onReorder={handleReorderProducts}
                onEdit={(product) => {
                  setEditingProduct(product);
                  setIsDialogOpen(true);
                }}
                onDelete={handleDeleteProduct}
              />
            ) : limpezaProducts.length > 0 ? (
              <AdminEmptyState
                icon={Search}
                title="Nenhum produto encontrado"
                description="Tente ajustar os filtros de busca"
              />
            ) : (
              <AdminEmptyState
                icon={Package}
                title="Nenhum produto de limpeza encontrado"
                description="Comece adicionando seu primeiro produto de limpeza"
                action={
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Produto
                  </Button>
                }
              />
            )}
          </div>
        );

      case 'automotive':
        return <AutomotiveProductsManager />;

      case 'highlights':
        return (
          <PriorityProductsManager
            onEditProduct={(productId) => {
              const product = products.find(p => p.id === productId);
              if (product) {
                setEditingProduct(product);
                setIsDialogOpen(true);
              }
            }}
          />
        );

      case 'categories':
        return <CategoryManager />;

      case 'suppliers':
        return (
          <AdminComingSoon
            icon={Truck}
            title="Fornecedores"
            description="Em breve você vai poder cadastrar fornecedores e enviar cotações direto por aqui."
          />
        );

      case 'missing':
        return (
          <AdminComingSoon
            icon={ClipboardCheck}
            title="Faltantes"
            description="Em breve você vai poder registrar produtos faltantes e gerar cotações automaticamente."
          />
        );

      case 'staff':
        return <StaffManager />;

      default:
        return null;
    }
  };

  return (
    <AdminShell items={visibleNavItems} activeSection={activeSection} onSelectSection={setActiveSection}>
      {renderSection()}
    </AdminShell>
  );
};

export default Admin;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "feat(admin): trocar Tabs horizontais pela nova AdminShell (sidebar + Início por papel)"
```

---

### Task 13: `AdminDashboard.tsx` — estados compartilhados

**Files:**
- Modify: `src/components/AdminDashboard.tsx:104-113` (loading), `src/components/AdminDashboard.tsx:795-800` (empty state de produtos vendidos)

**Interfaces:**
- Consome: `AdminLoadingState` (Task 4), `AdminEmptyState` (Task 3) de `@/components/admin/...`. Nenhuma outra mudança — gráficos, filtros de data, comparação de períodos continuam idênticos.

- [ ] **Step 1: Adicionar os imports**

Em `src/components/AdminDashboard.tsx`, logo abaixo do último import existente (linha 36, `} from 'recharts';`), adicione:

```tsx
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
```

- [ ] **Step 2: Trocar o bloco de loading**

Troque (linhas 104-113):

```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">📊</div>
          <h3 className="text-xl font-semibold mb-2">Carregando estatísticas...</h3>
        </div>
      </div>
    );
  }
```

por:

```tsx
  if (loading) {
    return <AdminLoadingState label="Carregando estatísticas..." rows={5} />;
  }
```

- [ ] **Step 3: Trocar o empty state de "Produtos Mais Vendidos"**

Troque (linhas 795-800):

```tsx
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma venda registrada ainda</p>
            </div>
          )}
```

por:

```tsx
          ) : (
            <AdminEmptyState icon={Package} title="Nenhuma venda registrada ainda" />
          )}
```

`Package` já está importado no topo do arquivo (linha 16), nenhuma mudança de import necessária pra este passo.

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "refactor(admin): usar AdminLoadingState/AdminEmptyState no Dashboard"
```

---

### Task 14: `CategoryManager.tsx` — estados compartilhados

**Files:**
- Modify: `src/components/CategoryManager.tsx:40-46` (loading/empty do `CategoryList`), `src/components/CategoryManager.tsx:196-198` (cabeçalho)

**Interfaces:**
- Consome: `AdminLoadingState` (Task 4), `AdminEmptyState` (Task 3), `AdminPageHeader` (Task 2) — importados via `./admin/...` (o arquivo está em `src/components/`, então o caminho relativo é `./admin/...`).

- [ ] **Step 1: Adicionar os imports**

Em `src/components/CategoryManager.tsx`, logo abaixo do import de `useCategories` (linha 9), adicione:

```tsx
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { Tags } from 'lucide-react';
```

- [ ] **Step 2: Trocar loading/empty em `CategoryList`**

Troque (linhas 40-46):

```tsx
  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  }

  if (categories.length === 0) {
    return <p className="text-muted-foreground text-center py-8">{emptyMessage}</p>;
  }
```

por:

```tsx
  if (loading) {
    return <AdminLoadingState rows={3} />;
  }

  if (categories.length === 0) {
    return <AdminEmptyState icon={Tags} title={emptyMessage} />;
  }
```

- [ ] **Step 3: Trocar o cabeçalho do `CardHeader`**

Troque (linhas 194-198):

```tsx
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Gerenciar Categorias</CardTitle>
```

por:

```tsx
  return (
    <Card>
      <CardHeader>
        <AdminPageHeader
          icon={Tags}
          title="Categorias"
          description="Organize as categorias de limpeza e automotivo."
        />
        <div className="flex justify-end items-center -mt-4">
```

E troque o fechamento correspondente — na linha 236 (`</div>` que fecha o antigo `flex justify-between items-center`, logo antes de `</CardHeader>`), mantenha como está (o `<div>` continua fechando normalmente, só o conteúdo interno mudou de "título + botão lado a lado" pra "cabeçalho padrão em cima, botão alinhado à direita embaixo").

Nota: `AdminPageHeader` já tem sua própria margem inferior (`mb-6`); o `-mt-4` no `<div>` de baixo evita espaçamento duplicado entre o cabeçalho e o botão "Nova Categoria". Se ao rodar visualmente o espaçamento parecer grande demais ou pequeno demais, ajuste esse valor — não é um número crítico, é só produto do cabeçalho compartilhado ser novo aqui.

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryManager.tsx
git commit -m "refactor(admin): usar componentes compartilhados em CategoryManager"
```

---

### Task 15: `OrdersManager.tsx` — estados compartilhados

**Files:**
- Modify: `src/components/OrdersManager.tsx:92-101` (loading), `src/components/OrdersManager.tsx:159-167` (empty), `src/components/OrdersManager.tsx:104-116` (cabeçalho)

**Interfaces:**
- Consome: `AdminLoadingState` (Task 4), `AdminEmptyState` (Task 3), `AdminPageHeader` (Task 2).

- [ ] **Step 1: Adicionar os imports**

Em `src/components/OrdersManager.tsx`, logo abaixo do import de `toast` (linha 27), adicione:

```tsx
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
```

- [ ] **Step 2: Trocar o bloco de loading**

Troque (linhas 92-101):

```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    );
  }
```

por:

```tsx
  if (loading) {
    return <AdminLoadingState label="Carregando pedidos..." rows={5} />;
  }
```

- [ ] **Step 3: Trocar o cabeçalho do `CardHeader`**

Troque (linhas 104-116):

```tsx
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Gerenciar Pedidos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalCount} pedido{totalCount !== 1 ? 's' : ''} no total
              </p>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
```

por:

```tsx
      <CardHeader>
        <AdminPageHeader
          icon={ClipboardList}
          title="Pedidos"
          description={`${totalCount} pedido${totalCount !== 1 ? 's' : ''} no total`}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
```

Isso remove a coluna esquerda antiga (ícone+título+contagem manual) porque `AdminPageHeader` já cobre isso; o filtro de status continua exatamente igual, só perde o `<div>` irmão vazio à esquerda dele.

- [ ] **Step 4: Trocar o empty state**

Troque (linhas 159-167):

```tsx
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? 'Nenhum pedido encontrado'
                : `Nenhum pedido ${statusLabels[statusFilter]?.toLowerCase()}`}
            </p>
          </div>
        ) : (
```

por:

```tsx
        {orders.length === 0 ? (
          <AdminEmptyState
            icon={ClipboardList}
            title={
              statusFilter === 'all'
                ? 'Nenhum pedido encontrado'
                : `Nenhum pedido ${statusLabels[statusFilter]?.toLowerCase()}`
            }
          />
        ) : (
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/OrdersManager.tsx
git commit -m "refactor(admin): usar componentes compartilhados em OrdersManager"
```

---

### Task 16: `AutomotiveProductsManager.tsx` — estados compartilhados

**Files:**
- Modify: `src/components/AutomotiveProductsManager.tsx:162-171` (loading), `src/components/AutomotiveProductsManager.tsx:329-352` (cabeçalho da seção de produtos), `src/components/AutomotiveProductsManager.tsx:404-433` (empty states)

**Interfaces:**
- Consome: `AdminLoadingState` (Task 4), `AdminEmptyState` (Task 3), `AdminPageHeader` (Task 2).

- [ ] **Step 1: Adicionar os imports**

Em `src/components/AutomotiveProductsManager.tsx`, logo abaixo do import de `normalizeText` (linha 16), adicione:

```tsx
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
```

- [ ] **Step 2: Trocar o bloco de loading**

Troque (linhas 162-171):

```tsx
  if (loading) {
    return (
      <div className="min-h-[400px] bg-[#0a0a0f] rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🚗</div>
          <h3 className="text-xl font-semibold text-white mb-2">Carregando produtos automotivos...</h3>
        </div>
      </div>
    );
  }
```

por:

```tsx
  if (loading) {
    return (
      <div className="min-h-[400px] bg-[#0a0a0f] rounded-xl p-6 border border-blue-500/20">
        <AdminLoadingState label="Carregando produtos automotivos..." rows={5} />
      </div>
    );
  }
```

- [ ] **Step 3: Trocar o cabeçalho "Produtos Automotivos"**

Troque (linhas 329-352):

```tsx
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
            <Car className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-heading text-white flex items-center gap-2">
              Produtos Automotivos
              <Badge className="bg-blue-600/30 text-blue-400 border-blue-500/50 hover:bg-blue-600/40">
                {automotiveProducts.length} itens
              </Badge>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-blue-300/60 text-sm">
                Gerencie sua linha de produtos para veículos
              </p>
              <div className="flex items-center gap-1 text-xs text-blue-300/50 bg-blue-500/10 px-2 py-0.5 rounded">
                <GripVertical className="h-3 w-3" />
                <span>Arraste para reorganizar</span>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
```

por:

```tsx
      <AdminPageHeader
        icon={Car}
        title="Produtos Automotivos"
        description={`${automotiveProducts.length} itens · arraste para reorganizar`}
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
```

A parte do meio (`DialogTrigger`, `Button`, `DialogContent`, `DialogHeader`, `ProductForm` self-fechado) fica exatamente igual, só fica um nível mais aninhada dentro da prop `action`. Só o fechamento muda — troque o final do bloco (linhas 374-377 originais):

```tsx
            />
          </DialogContent>
        </Dialog>
      </div>
```

por:

```tsx
            />
          </DialogContent>
          </Dialog>
        }
      />
```

(`<ProductForm .../>` é um componente self-fechado, sem tag de fechamento própria — só o `/>` na linha 374 muda de indentação, não de conteúdo. O `</div>` que fechava o antigo `flex justify-between items-center` some, substituído por `}` + `/>` fechando a prop `action` do `AdminPageHeader`.)

`Badge` deixa de ser usado neste bloco (a contagem "X itens" virou texto simples na descrição) — ele continua usado em outros pontos do mesmo arquivo (seção de categorias automotivas, linhas 200-202), então o import de `Badge` no topo do arquivo **não** deve ser removido.

- [ ] **Step 4: Trocar os empty states da grid de produtos**

Troque (linhas 404-433):

```tsx
      ) : automotiveProducts.length > 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-blue-300/50 mb-6">
            Tente ajustar os filtros de busca
          </p>
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20">
            <Car className="h-10 w-10 text-blue-500/60" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhum produto automotivo
          </h3>
          <p className="text-blue-300/50 mb-6 max-w-md mx-auto">
            Comece adicionando seu primeiro produto da linha automotiva
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto Automotivo
          </Button>
        </div>
      )}
```

por:

```tsx
      ) : automotiveProducts.length > 0 ? (
        <AdminEmptyState
          icon={Search}
          title="Nenhum produto encontrado"
          description="Tente ajustar os filtros de busca"
        />
      ) : (
        <AdminEmptyState
          icon={Car}
          title="Nenhum produto automotivo"
          description="Comece adicionando seu primeiro produto da linha automotiva"
          action={
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Produto Automotivo
            </Button>
          }
        />
      )}
```

Adicione `Search` à lista de ícones importados de `lucide-react` no topo do arquivo (linha 2): troque

```tsx
import { Plus, Car, DollarSign, TrendingUp, ShoppingBag, Tags, X, GripVertical } from 'lucide-react';
```

por:

```tsx
import { Plus, Car, DollarSign, TrendingUp, ShoppingBag, Tags, X, Search } from 'lucide-react';
```

(`GripVertical` sai da lista — não é mais usado neste arquivo depois da troca do cabeçalho no Step 3; `Search` entra pro novo empty state de busca.)

- [ ] **Step 5: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/AutomotiveProductsManager.tsx
git commit -m "refactor(admin): usar componentes compartilhados em AutomotiveProductsManager"
```

---

### Task 17: `PriorityProductsManager.tsx` — estados compartilhados

**Files:**
- Modify: `src/components/PriorityProductsManager.tsx:204-212` (loading), `src/components/PriorityProductsManager.tsx:216-225` (cabeçalho)

**Interfaces:**
- Consome: `AdminLoadingState` (Task 4), `AdminPageHeader` (Task 2). Os empty states por coluna (linhas 145-157) **não** mudam nesta task — ver justificativa abaixo.

Nota: o empty state por coluna (`AlertCircle` + mensagem + link "Adicionar primeiro produto") fica como está, não vira `AdminEmptyState`. Ele é compacto e vive dentro de duas colunas lado a lado (limpeza/automotivo) com um link de texto contextual por linha, diferente do padrão "ícone grande + título + descrição + botão" das outras seções — forçar o componente compartilhado aqui deixaria o layout de duas colunas apertado. Mantém o padrão atual, que já é razoavelmente polido.

- [ ] **Step 1: Adicionar os imports**

Em `src/components/PriorityProductsManager.tsx`, logo abaixo do import de `SortablePriorityItem` (linha 31), adicione:

```tsx
import AdminLoadingState from './admin/AdminLoadingState';
import AdminPageHeader from './admin/AdminPageHeader';
```

- [ ] **Step 2: Trocar o bloco de loading**

Troque (linhas 204-212):

```tsx
  if (loading) {
    return (
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-blue-300/60">Carregando produtos prioritários...</div>
        </CardContent>
      </Card>
    );
  }
```

por:

```tsx
  if (loading) {
    return (
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardContent className="py-6">
          <AdminLoadingState label="Carregando produtos prioritários..." rows={3} />
        </CardContent>
      </Card>
    );
  }
```

- [ ] **Step 3: Trocar o cabeçalho**

Troque (linhas 216-225):

```tsx
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading text-white flex items-center gap-2">
          <Star className="h-6 w-6 text-yellow-400" />
          Produtos em Destaque
        </h2>
        <p className="text-blue-300/60 mt-1">
          Gerencie os produtos que aparecem em destaque na vitrine. Arraste para reordenar.
        </p>
      </div>
```

por:

```tsx
      {/* Header */}
      <AdminPageHeader
        icon={Star}
        title="Produtos em Destaque"
        description="Gerencie os produtos que aparecem em destaque na vitrine. Arraste para reordenar."
      />
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/PriorityProductsManager.tsx
git commit -m "refactor(admin): usar componentes compartilhados em PriorityProductsManager"
```

---

### Task 18: `StaffManager.tsx` — estados compartilhados

**Files:**
- Modify: `src/components/StaffManager.tsx:186-189` (loading/empty), `src/components/StaffManager.tsx:100-105` (cabeçalho)

**Interfaces:**
- Consome: `AdminLoadingState` (Task 4), `AdminEmptyState` (Task 3), `AdminPageHeader` (Task 2).

- [ ] **Step 1: Adicionar os imports**

Em `src/components/StaffManager.tsx`, logo abaixo do import de `useStaffAccess`/`StaffPermission` (linha 18), adicione:

```tsx
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
```

- [ ] **Step 2: Trocar o cabeçalho do `CardHeader`**

Troque (linhas 100-105):

```tsx
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Funcionários
        </CardTitle>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
```

por:

```tsx
      <CardHeader>
        <AdminPageHeader
          icon={Shield}
          title="Funcionários"
          description="Crie contas de funcionário e defina o que cada um pode acessar."
          action={
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
```

E o fechamento — troque (linha 183, logo antes de `</CardHeader>`):

```tsx
        </Dialog>
      </CardHeader>
```

por:

```tsx
            </Dialog>
          }
        />
      </CardHeader>
```

(o conteúdo do `Dialog` entre esses dois pontos — `DialogTrigger`, `DialogContent`, formulário de criação — permanece exatamente igual, só a indentação lógica muda porque ele passa a ser filho da prop `action`.)

- [ ] **Step 3: Trocar loading/empty**

Troque (linhas 186-189):

```tsx
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : staffMembers.length === 0 ? (
          <p className="text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
        ) : (
```

por:

```tsx
        {loading ? (
          <AdminLoadingState rows={3} />
        ) : staffMembers.length === 0 ? (
          <AdminEmptyState icon={Shield} title="Nenhum funcionário cadastrado ainda." />
        ) : (
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/StaffManager.tsx
git commit -m "refactor(admin): usar componentes compartilhados em StaffManager"
```

---

### Task 19: Verificação final e testes manuais

**Files:**
- Nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Typecheck limpo**

Run: `npm run typecheck`
Expected: 0 erros.

- [ ] **Step 2: Subir o servidor de dev e testar manualmente**

Run: `npm run dev`

Roteiro de teste (documentar resultado de cada item no relatório desta task):

1. Logar como admin, abrir `/admin`. Confirmar: sidebar aparece recolhida (só ícones) à esquerda; passar o mouse expande mostrando rótulos e os três grupos ("Catálogo", "Operação", "Equipe"); tirar o mouse recolhe de novo.
2. Confirmar que a sidebar mostra, nesta ordem: Início, Financeiro, Pedidos, depois o grupo Catálogo (Produtos, Automotivo, Destaques, Categorias), grupo Operação (Fornecedores, Faltantes — com a etiqueta "em breve" visível quando expandida), grupo Equipe (Funcionários).
3. Clicar em cada item da sidebar e confirmar que o conteúdo certo aparece: Início (atalhos), Financeiro (o dashboard de gráficos, sem nenhuma mudança visível de dados), Pedidos (tabela de pedidos), Produtos/Automotivo/Destaques/Categorias/Funcionários (mesmas telas de sempre, com o novo cabeçalho padronizado).
4. Clicar em "Fornecedores" e "Faltantes": confirmar que mostram a tela "em breve" (`AdminComingSoon`) com o texto certo, e não travam nem dão erro.
5. Redimensionar a janela pra largura de celular (ou usar as devtools em modo responsivo): confirmar que a sidebar desaparece e a barra inferior aparece com Início, Produtos, Pedidos, Financeiro, Mais.
6. Tocar em "Mais": confirmar que abre a folha de baixo com Automotivo, Destaques, Categorias, Funcionários, Fornecedores (em breve), Faltantes (em breve) — e que clicar em qualquer um navega pra seção certa e fecha a folha.
7. Logar como um funcionário só com permissão `produtos` (reaproveite ou crie um funcionário de teste via StaffManager, apagando-o no final): confirmar que a sidebar mostra só Início, Produtos, Automotivo, Destaques, Categorias, Fornecedores (em breve), Faltantes (em breve) — sem Financeiro, Pedidos nem Funcionários. Confirmar que Início mostra a contagem de produtos e o atalho "Novo produto", sem nenhum bloco de Financeiro/Pedidos. Confirmar que a barra mobile pra esse papel mostra Início, Produtos, e "Mais" contendo o resto (sem buraco vazio nas posições de Pedidos/Financeiro).
8. Logar como um funcionário só com permissão `financeiro`: confirmar que Início mostra os atalhos de Financeiro/Pedidos, sem o bloco de Produtos.
9. Se der pra testar um funcionário só com `faltantes`/`fornecedores` (sem produtos nem financeiro): confirmar que Início mostra a tela "em breve" ao invés de ficar em branco.
10. Confirmar que criar, editar e excluir um produto, uma categoria, um pedido (mudar status) e um funcionário continuam funcionando exatamente como antes — esta parte não deveria ter mudado nenhum desses fluxos.

- [ ] **Step 3: Reportar resultado**

Se algum item do roteiro falhar, corrigir antes de considerar a task concluída. Se tudo passar, seguir pra revisão final de branch inteira (fora do escopo desta task — próxima etapa do processo).
