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
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", href: "/leads", icon: UserPlus, permission: "leads:read" },
  {
    title: "Customers",
    href: "/customers",
    icon: Building2,
    permission: "customers:read",
  },
  {
    title: "Contacts",
    href: "/contacts",
    icon: Contact,
    permission: "contacts:read",
  },
  {
    title: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    permission: "deals:read",
  },
  { title: "Tasks", href: "/tasks", icon: CheckSquare, permission: "tasks:read" },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    permission: "tasks:read",
  },
  {
    title: "Communications",
    href: "/communications",
    icon: MessagesSquare,
  },
  {
    title: "Quotations",
    href: "/quotations",
    icon: FileText,
    permission: "quotes:read",
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    permission: "products:read",
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
    permission: "invoices:read",
  },
  {
    title: "Support",
    href: "/support",
    icon: Headphones,
    permission: "tickets:read",
  },
  {
    title: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    permission: "campaigns:read",
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
    permission: "employees:read",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "reports:read",
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FolderOpen,
    permission: "documents:read",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings:read",
  },
  { title: "Audit", href: "/audit", icon: Shield, permission: "audit:read" },
];
