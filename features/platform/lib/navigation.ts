import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, BadgeCheck, Banknote, Boxes, ClipboardCheck, LayoutDashboard, PackageCheck, Palette, ReceiptText, Scale, ShoppingBasket, Store } from 'lucide-react';

export interface PlatformNavItem {
  title: string;
  href: string;
  color: string;
  description: string;
  icon: LucideIcon;
  group?: string;
  // The control room is the platform root, so a prefix match would mark it active on every platform page.
  exact?: boolean;
}

export interface PlatformNavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: PlatformNavItem[];
}

// Platform navigation items, relative to the dashboard basePath, as in the family Sidebar.
export const platformNavItems: PlatformNavItem[] = [
  { title: 'Control room', href: '/platform', color: 'slate', description: 'Today’s stock, incidents and authority at a glance.', icon: LayoutDashboard, group: 'standalone', exact: true },
  { title: 'Authority', href: '/platform/authority', color: 'emerald', description: 'Licenses and staff credentials.', icon: BadgeCheck, group: 'operations' },
  { title: 'Compliance', href: '/platform/compliance', color: 'amber', description: 'Customer verification, package holds and recalls.', icon: ClipboardCheck, group: 'operations' },
  { title: 'Inventory', href: '/platform/inventory', color: 'green', description: 'Package stock, holds and custody history.', icon: Boxes, group: 'operations' },
  { title: 'Receiving', href: '/platform/receiving', color: 'teal', description: 'Receive packages against transfer manifests.', icon: PackageCheck, group: 'operations' },
  { title: 'Menu', href: '/platform/menu', color: 'lime', description: 'Products and what is ready to sell.', icon: ShoppingBasket, group: 'operations' },
  { title: 'Store Settings', href: '/platform/store-settings', color: 'violet', description: 'Store name, logo and public description.', icon: Palette, group: 'operations' },
  { title: 'POS', href: '/platform/pos', color: 'blue', description: 'Carts, order preparation and receipts.', icon: ReceiptText, group: 'operations' },
  { title: 'Cash', href: '/platform/cash', color: 'yellow', description: 'Registers, shifts and cash variances.', icon: Banknote, group: 'operations' },
  { title: 'Reconciliation', href: '/platform/reconciliation', color: 'indigo', description: 'Reconciliation runs and state reporting queue.', icon: Scale, group: 'operations' },
  { title: 'Incidents', href: '/platform/incidents', color: 'red', description: 'Compliance incidents and notification deadlines.', icon: AlertTriangle, group: 'operations' },
];

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone');

export const platformNavGroups: PlatformNavGroup[] = [
  { id: 'operations', title: 'Dispensary operations', icon: Store, items: platformNavItems.filter((item) => item.group === 'operations') },
];

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }));
}
