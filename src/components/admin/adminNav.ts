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
  Receipt,
  Users,
  ClipboardCheck as ClipboardCheckIcon,
  type LucideIcon,
} from 'lucide-react';
import { StaffAccess, StaffPermission } from '@/hooks/useStaffAccess';
import type { EquipeAccess } from '@/hooks/useEquipeAccess';

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
  | 'quotes'
  | 'staff'
  | 'equipe'
  | 'meus-registros';

export type AdminNavGroup = 'catalogo' | 'operacao' | 'equipe';

export interface AdminNavItem {
  key: AdminSection;
  label: string;
  icon: LucideIcon;
  permission?: StaffPermission | StaffPermission[];
  adminOnly?: boolean;
  comingSoon?: boolean;
  group?: AdminNavGroup;
  /**
   * Papéis do módulo Equipe que veem este item. É um eixo separado das
   * staff_permission (que controlam Catálogo/Operação/Financeiro) — um
   * colaborador pode ver "Meus registros" sem ter nenhuma permissão de módulo.
   */
  equipeAcesso?: 'gestor_ou_admin' | 'qualquer_papel';
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
  { key: 'suppliers', label: 'Fornecedores', icon: Truck, permission: 'fornecedores', group: 'operacao' },
  { key: 'missing', label: 'Faltantes', icon: ClipboardCheck, permission: 'faltantes', group: 'operacao' },
  { key: 'quotes', label: 'Cotações', icon: Receipt, permission: ['faltantes', 'fornecedores'], group: 'operacao' },
  { key: 'staff', label: 'Funcionários', icon: Shield, adminOnly: true, group: 'equipe' },
  { key: 'equipe', label: 'Atrasos', icon: Users, equipeAcesso: 'gestor_ou_admin', group: 'equipe' },
  {
    key: 'meus-registros',
    label: 'Meus registros',
    icon: ClipboardCheckIcon,
    equipeAcesso: 'qualquer_papel',
    group: 'equipe',
  },
];

// Itens "em breve" aparecem pra qualquer staff. Itens adminOnly só pra admin.
// Itens sem permission (hoje só 'home') aparecem pra qualquer staff.
// Itens com equipeAcesso dependem do papel de equipe, não das staff_permission.
export const canSeeNavItem = (
  item: AdminNavItem,
  staffAccess: StaffAccess,
  equipeAccess?: EquipeAccess
): boolean => {
  if (item.comingSoon) return true;
  if (item.equipeAcesso) {
    if (!equipeAccess) return false;
    return item.equipeAcesso === 'gestor_ou_admin'
      ? equipeAccess.isGestorOuAdmin
      : equipeAccess.isEquipe;
  }
  if (item.adminOnly) return staffAccess.isAdmin;
  if (!item.permission) return true;
  const required = Array.isArray(item.permission) ? item.permission : [item.permission];
  return staffAccess.isAdmin || required.every((perm) => staffAccess.permissions.has(perm));
};

export const getVisibleNavItems = (
  staffAccess: StaffAccess,
  equipeAccess?: EquipeAccess
): AdminNavItem[] => ADMIN_NAV_ITEMS.filter((item) => canSeeNavItem(item, staffAccess, equipeAccess));

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
