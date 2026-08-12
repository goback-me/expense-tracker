"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/receipts", label: "Receipts", icon: "receipt_long" },
  { href: "/scan", label: "Scan", icon: "add_circle", isFab: true },
  { href: "/reports", label: "Reports", icon: "bar_chart" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md items-center justify-around border-t border-outline-variant bg-white px-4 pb-2 pt-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;

        if (item.isFab) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="-mt-4 flex w-16 flex-col items-center gap-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-[28px]">
                  {item.icon}
                </span>
              </div>
              <span className="text-[10px] font-semibold tracking-wide text-on-surface-variant">
                {item.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex w-16 flex-col items-center gap-1 transition-colors ${
              active ? "text-primary font-bold" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: active
                  ? "'FILL' 1, 'wght' 400"
                  : "'FILL' 0, 'wght' 300",
              }}
            >
              {item.icon}
            </span>
            <span className="text-[10px] tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
