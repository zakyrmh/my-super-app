"use client";

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FinanceWidgetProps {
  totalBalance: number;
  percentageChange: number;
  currency?: string;
}

export function FinanceWidget({
  totalBalance = 45750000,
  percentageChange = 12.5,
  currency = "Rp",
}: FinanceWidgetProps) {
  const isPositive = percentageChange >= 0;
  const formattedBalance = new Intl.NumberFormat("id-ID").format(totalBalance);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Total Balance
        </CardTitle>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <Wallet className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            {currency}
          </span>
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {formattedBalance}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {percentageChange}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground">vs bulan lalu</span>
        </div>
      </CardContent>
    </Card>
  );
}
