import type { Metadata } from "next";
import {
  FinanceWidget,
  HealthWidget,
  VehicleWidget,
  QuickActions,
  FloatingActionButton,
} from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Utensils,
  Car,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard | My Super App",
  description: "Personal Resource Planning - Your life, simplified",
};

// Dummy data with activity categories
const dashboardData = {
  finance: {
    totalBalance: 45750000,
    percentageChange: 12.5,
  },
  health: {
    currentCalories: 1200,
    targetCalories: 2000,
    macros: [
      { name: "Protein", current: 45, target: 80, unit: "g" },
      { name: "Karbo", current: 120, target: 250, unit: "g" },
      { name: "Lemak", current: 35, target: 65, unit: "g" },
    ],
  },
  vehicle: {
    vehicleName: "Vario 150",
    vehicleType: "Motor",
    currentOdometer: 15500,
    nextServiceAt: 16000,
    fuelLevel: 65,
  },
  recentActivities: [
    {
      id: 1,
      type: "expense" as const,
      category: "general",
      title: "Makan Siang",
      amount: -45000,
      time: "2 jam lalu",
    },
    {
      id: 2,
      type: "income" as const,
      category: "finance",
      title: "Gaji Bulanan",
      amount: 8500000,
      time: "Kemarin",
    },
    {
      id: 3,
      type: "expense" as const,
      category: "vehicle",
      title: "Isi Bensin Pertamax",
      amount: -65000,
      time: "2 hari lalu",
    },
    {
      id: 4,
      type: "expense" as const,
      category: "health",
      title: "Vitamin & Suplemen",
      amount: -125000,
      time: "3 hari lalu",
    },
  ],
};

// Activity icon and color mapping
const getActivityStyle = (
  category: string,
  amount: number
): { bg: string; text: string; icon: React.ElementType } => {
  if (amount > 0) {
    return {
      bg: "bg-green-100 dark:bg-green-500/20",
      text: "text-green-600 dark:text-green-400",
      icon: TrendingUp,
    };
  }

  switch (category) {
    case "finance":
      return {
        bg: "bg-green-100 dark:bg-green-500/20",
        text: "text-green-600 dark:text-green-400",
        icon: Wallet,
      };
    case "health":
      return {
        bg: "bg-rose-100 dark:bg-rose-500/20",
        text: "text-rose-600 dark:text-rose-400",
        icon: Utensils,
      };
    case "vehicle":
      return {
        bg: "bg-blue-100 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        icon: Car,
      };
    default:
      return {
        bg: "bg-gray-100 dark:bg-gray-500/20",
        text: "text-gray-600 dark:text-gray-400",
        icon: TrendingDown,
      };
  }
};

export default function HomePage() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-4" />
            <span className="text-sm">{formattedDate}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan status personal resource Anda
          </p>
        </div>

        {/* Quick Actions - Desktop Only */}
        <QuickActions />
      </div>

      {/* Main Widgets Grid - Fixed for Desktop */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Finance Widget */}
        <FinanceWidget
          totalBalance={dashboardData.finance.totalBalance}
          percentageChange={dashboardData.finance.percentageChange}
        />

        {/* Health Widget */}
        <HealthWidget
          currentCalories={dashboardData.health.currentCalories}
          targetCalories={dashboardData.health.targetCalories}
          macros={dashboardData.health.macros}
        />

        {/* Vehicle Widget */}
        <VehicleWidget
          vehicleName={dashboardData.vehicle.vehicleName}
          vehicleType={dashboardData.vehicle.vehicleType}
          currentOdometer={dashboardData.vehicle.currentOdometer}
          nextServiceAt={dashboardData.vehicle.nextServiceAt}
          fuelLevel={dashboardData.vehicle.fuelLevel}
        />
      </div>

      {/* Recent Activity with Color Coding */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Aktivitas Terkini
            </CardTitle>
            <button className="text-xs text-primary hover:underline">
              Lihat Semua
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {dashboardData.recentActivities.map((activity) => {
            const style = getActivityStyle(activity.category, activity.amount);
            const Icon = style.icon;

            return (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {/* Color-coded icon */}
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-full ${style.bg}`}
                  >
                    <Icon className={`size-4 ${style.text}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.time}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    activity.amount > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  }`}
                >
                  {activity.amount > 0 ? "+" : ""}
                  Rp {Math.abs(activity.amount).toLocaleString("id-ID")}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Insights Card */}
      <Card className="border-border/50 bg-linear-to-br from-primary/5 to-primary/10 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 shrink-0">
              <TrendingUp className="size-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">
                💡 Insight Hari Ini
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pengeluaran Anda bulan ini <strong>12% lebih rendah</strong>{" "}
                dibanding bulan lalu. Pertahankan kebiasaan baik ini! Target
                kalori Anda juga sudah tercapai 60% hari ini.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Action Button - Mobile Only */}
      <FloatingActionButton />
    </div>
  );
}
