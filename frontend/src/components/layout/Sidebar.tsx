"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  PackageCheck,
  Truck,
  ArrowLeftRight,
  ClipboardList,
  History,
  Settings,
  User,
  Menu,
  X,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard",          href: "/",             icon: LayoutDashboard },
  { label: "Products",           href: "/products",     icon: Package },
  { label: "Receipts",           href: "/receipts",     icon: PackageCheck },
  { label: "Deliveries",         href: "/deliveries",   icon: Truck },
  { label: "Internal Transfers", href: "/transfers",    icon: ArrowLeftRight },
  { label: "Adjustments",        href: "/adjustments",  icon: ClipboardList },
  { label: "Move History",       href: "/history",      icon: History },
  { label: "Settings",           href: "/settings",     icon: Settings },
  { label: "Profile",            href: "/profile",      icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavList = () => (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-slate-900 min-h-screen">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
          <Boxes className="h-6 w-6 text-blue-400" />
          <span className="text-lg font-bold text-white tracking-tight">
            StockSense
          </span>
        </div>
        <NavList />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-blue-400" />
          <span className="text-base font-bold text-white">StockSense</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="text-slate-300 hover:text-white p-1 rounded"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed top-0 left-0 z-40 h-full w-64 bg-slate-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-400" />
                <span className="text-base font-bold text-white">StockSense</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="text-slate-300 hover:text-white p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList />
          </aside>
        </>
      )}
    </>
  );
}
