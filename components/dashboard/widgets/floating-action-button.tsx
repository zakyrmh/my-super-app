"use client";

import * as React from "react";
import { Plus, X, Receipt, Camera, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";

const fabActions = [
  {
    label: "Catat Pengeluaran",
    icon: Receipt,
    color: "bg-violet-500 hover:bg-violet-600",
    href: "/finance/add",
  },
  {
    label: "Foto Makanan",
    icon: Camera,
    color: "bg-rose-500 hover:bg-rose-600",
    href: "/health/add",
  },
  {
    label: "Isi Bensin",
    icon: Fuel,
    color: "bg-emerald-500 hover:bg-emerald-600",
    href: "/vehicle/fuel",
  },
];

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="md:hidden fixed bottom-20 right-4 z-50">
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action Menu */}
      <div
        className={cn(
          "absolute bottom-16 right-0 flex flex-col gap-2 transition-all duration-300",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {fabActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              className={cn(
                "flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full text-white shadow-lg transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                action.color
              )}
              style={{
                transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
              }}
              onClick={() => {
                setIsOpen(false);
                // Navigate to action.href
              }}
            >
              <span className="text-sm font-medium whitespace-nowrap">
                {action.label}
              </span>
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300",
          "bg-primary text-primary-foreground",
          "hover:shadow-xl hover:scale-105 active:scale-95",
          isOpen && "rotate-45 bg-muted text-muted-foreground"
        )}
      >
        {isOpen ? <X className="size-6" /> : <Plus className="size-6" />}
      </button>
    </div>
  );
}
