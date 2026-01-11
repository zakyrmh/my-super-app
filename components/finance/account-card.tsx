"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  Wallet,
  Banknote,
  TrendingUp,
  CreditCard,
} from "lucide-react";

interface AccountCardProps {
  name: string;
  type: string;
  balance: number;
}

/** Get icon and styling based on account type */
function getAccountStyle(type: string) {
  switch (type.toUpperCase()) {
    case "BANK":
      return {
        icon: Landmark,
        bg: "bg-blue-100 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        badge:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    case "EWALLET":
      return {
        icon: Wallet,
        bg: "bg-violet-100 dark:bg-violet-500/20",
        text: "text-violet-600 dark:text-violet-400",
        badge:
          "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      };
    case "CASH":
      return {
        icon: Banknote,
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        badge:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "INVESTMENT":
      return {
        icon: TrendingUp,
        bg: "bg-amber-100 dark:bg-amber-500/20",
        text: "text-amber-600 dark:text-amber-400",
        badge:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    case "CREDIT":
      return {
        icon: CreditCard,
        bg: "bg-rose-100 dark:bg-rose-500/20",
        text: "text-rose-600 dark:text-rose-400",
        badge:
          "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      };
    default:
      return {
        icon: Wallet,
        bg: "bg-gray-100 dark:bg-gray-500/20",
        text: "text-gray-600 dark:text-gray-400",
        badge:
          "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
      };
  }
}

/** Format currency to IDR */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Get display label for account type */
function getTypeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case "BANK":
      return "Bank";
    case "EWALLET":
      return "E-Wallet";
    case "CASH":
      return "Tunai";
    case "INVESTMENT":
      return "Investasi";
    case "CREDIT":
      return "Kredit";
    default:
      return type;
  }
}

export function AccountCard({ name, type, balance }: AccountCardProps) {
  const style = getAccountStyle(type);
  const Icon = style.icon;
  const isNegative = balance < 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors min-w-[200px] shrink-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex items-center justify-center size-10 rounded-xl ${style.bg}`}
          >
            <Icon className={`size-5 ${style.text}`} />
          </div>
          <Badge variant="outline" className={`text-xs ${style.badge}`}>
            {getTypeLabel(type)}
          </Badge>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p
            className={`text-lg font-bold ${
              isNegative ? "text-red-600 dark:text-red-400" : "text-foreground"
            }`}
          >
            {formatCurrency(balance)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
