import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  UserPlus,
  Building2,
  Contact,
  Kanban,
  CheckSquare,
  CalendarDays,
  FileText,
  Package,
  Receipt,
  Headphones,
  Megaphone,
  Users,
  BarChart3,
  FolderOpen,
  Settings,
  Shield,
  MessagesSquare,
  BookOpen,
  Sun,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavGroup = "daily" | "sales" | "more";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
  permission?: PermissionKey;
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  daily: "Daily work",
  sales: "Sales",
  more: "More",
};

export const NAV_GROUP_ORDER: NavGroup[] = ["daily", "sales", "more"];

export const NAV_ITEMS: NavItem[] = [
  { title: "My work", href: "/my-work", icon: Sun, group: "daily" },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    group: "daily",
    permission: "tasks:read",
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    group: "daily",
    permission: "tasks:read",
  },
  {
    title: "Messages",
    href: "/communications",
    icon: MessagesSquare,
    group: "daily",
  },
  {
    title: "Contacts",
    href: "/contacts",
    icon: Contact,
    group: "sales",
    permission: "contacts:read",
  },
  {
    title: "Leads",
    href: "/leads",
    icon: UserPlus,
    group: "sales",
    permission: "leads:read",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Building2,
    group: "sales",
    permission: "customers:read",
  },
  {
    title: "Deals board",
    href: "/pipeline",
    icon: Kanban,
    group: "sales",
    permission: "deals:read",
  },
  {
    title: "Quotes",
    href: "/quotations",
    icon: FileText,
    group: "sales",
    permission: "quotes:read",
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
    group: "sales",
    permission: "invoices:read",
  },
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "more",
  },
  {
    title: "Tickets",
    href: "/support",
    icon: Headphones,
    group: "more",
    permission: "tickets:read",
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    group: "more",
    permission: "products:read",
  },
  {
    title: "Campaigns",
    href: "/marketing",
    icon: Megaphone,
    group: "more",
    permission: "campaigns:read",
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FolderOpen,
    group: "more",
    permission: "documents:read",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    group: "more",
    permission: "reports:read",
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
    group: "more",
    permission: "employees:read",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    group: "more",
    permission: "settings:read",
  },
  {
    title: "Zoho Sync",
    href: "/settings/zoho",
    icon: BookOpen,
    group: "more",
    permission: "settings:read",
  },
  {
    title: "Audit",
    href: "/audit",
    icon: Shield,
    group: "more",
    permission: "audit:read",
  },
];

/** Admins land on the dashboard; everyone else starts on their own work list. */
export function homePathForRole(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" ? "/dashboard" : "/my-work";
}
