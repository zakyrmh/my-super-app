"use client";

import { Car, AlertTriangle, Wrench, Fuel, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VehicleWidgetProps {
  vehicleName: string;
  vehicleType: string;
  currentOdometer: number;
  nextServiceAt: number;
  fuelLevel?: number;
  onScheduleService?: () => void;
}

export function VehicleWidget({
  vehicleName = "Vario 150",
  vehicleType = "Motor",
  currentOdometer = 15500,
  nextServiceAt = 16000,
  fuelLevel = 65,
  onScheduleService,
}: VehicleWidgetProps) {
  const kmUntilService = nextServiceAt - currentOdometer;
  const isServiceSoon = kmUntilService <= 500;
  const isServiceOverdue = kmUntilService <= 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Kendaraan Utama
        </CardTitle>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
          <Car className="size-5 text-blue-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vehicle Info */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {vehicleName}
            </h3>
            <p className="text-xs text-muted-foreground">{vehicleType}</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {currentOdometer.toLocaleString()} km
          </Badge>
        </div>

        {/* Service Alert - Now Actionable */}
        {(isServiceSoon || isServiceOverdue) && (
          <button
            onClick={onScheduleService}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group cursor-pointer ${
              isServiceOverdue
                ? "bg-destructive/10 border border-destructive/20 hover:bg-destructive/15"
                : "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
            }`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                isServiceOverdue ? "bg-destructive/20" : "bg-amber-500/20"
              }`}
            >
              {isServiceOverdue ? (
                <AlertTriangle className="size-4 text-destructive" />
              ) : (
                <Wrench className="size-4 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p
                className={`text-sm font-medium ${
                  isServiceOverdue
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {isServiceOverdue ? "Servis Terlambat!" : "Servis Segera"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isServiceOverdue
                  ? `Sudah lewat ${Math.abs(kmUntilService)} km`
                  : `Tersisa ${kmUntilService} km lagi`}
              </p>
            </div>
            {/* Action indicator */}
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`text-xs font-medium ${
                  isServiceOverdue
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                Jadwalkan
              </span>
              <ChevronRight
                className={`size-4 transition-transform group-hover:translate-x-0.5 ${
                  isServiceOverdue
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              />
            </div>
          </button>
        )}

        {/* Fuel Level - Improved Layout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 shrink-0">
            <Fuel className="size-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Bensin</span>
              {/* Progress bar with inline percentage */}
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${fuelLevel}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground min-w-[32px] text-right">
                {fuelLevel}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
