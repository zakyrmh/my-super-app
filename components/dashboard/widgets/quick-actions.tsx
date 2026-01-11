"use client";

import { Receipt, Camera, Fuel, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const quickActions = [
  {
    label: "Pengeluaran",
    icon: Receipt,
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    href: "/finance/add",
  },
  {
    label: "Makanan",
    icon: Camera,
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    href: "/health/add",
  },
  {
    label: "Bensin",
    icon: Fuel,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    href: "/vehicle/fuel",
  },
  {
    label: "Lainnya",
    icon: Plus,
    color: "bg-muted text-muted-foreground",
    href: "/quick-actions",
  },
];

export function QuickActions() {
  return (
    <div className="hidden md:block">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">
          Quick:
        </span>
        <div className="flex items-center gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  "border border-border/50",
                  action.color
                )}
              >
                <Icon className="size-3.5" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
