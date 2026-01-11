"use client";

import { Heart, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MacroNutrient {
  name: string;
  current: number;
  target: number;
  unit: string;
}

interface HealthWidgetProps {
  currentCalories: number;
  targetCalories: number;
  macros?: MacroNutrient[];
}

export function HealthWidget({
  currentCalories = 1200,
  targetCalories = 2000,
  macros = [
    { name: "Protein", current: 45, target: 80, unit: "g" },
    { name: "Karbo", current: 120, target: 250, unit: "g" },
    { name: "Lemak", current: 35, target: 65, unit: "g" },
  ],
}: HealthWidgetProps) {
  const percentage = Math.min((currentCalories / targetCalories) * 100, 100);
  const remaining = Math.max(targetCalories - currentCalories, 0);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Kalori Hari Ini
        </CardTitle>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10">
          <Heart className="size-5 text-rose-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Circular Progress Representation */}
        <div className="flex items-center gap-4">
          {/* Circular Progress Visual */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="size-20 -rotate-90" viewBox="0 0 36 36">
              {/* Background Circle */}
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-primary/10"
                strokeWidth="3"
              />
              {/* Progress Circle */}
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-rose-500 transition-all duration-500"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${percentage}, 100`}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <Flame className="size-4 text-rose-500" />
              <span className="text-xs font-bold text-foreground">
                {Math.round(percentage)}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {currentCalories.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                / {targetCalories.toLocaleString()} kkal
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sisa{" "}
              <span className="font-medium text-foreground">
                {remaining.toLocaleString()} kkal
              </span>{" "}
              lagi
            </p>
          </div>
        </div>

        {/* Macro Nutrients Pills */}
        <div className="flex items-center gap-2">
          {macros.map((macro) => {
            const macroPercentage = Math.round(
              (macro.current / macro.target) * 100
            );
            return (
              <div
                key={macro.name}
                className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 border border-border/50"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {macro.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {macroPercentage}%
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {macro.current}
                  <span className="text-muted-foreground font-normal">
                    /{macro.target}
                    {macro.unit}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
