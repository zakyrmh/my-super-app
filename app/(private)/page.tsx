import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
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
  Utensils,
  Car,
  Inbox,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard | My Super App",
  description: "Personal Resource Planning - Your life, simplified",
};

// Type definitions
interface RecentActivity {
  id: string;
  type: "transaction" | "food";
  category: string;
  title: string;
  amount: number;
  createdAt: Date;
}

// Activity icon and color mapping
const getActivityStyle = (
  type: string,
  category: string,
  amount: number
): { bg: string; text: string; icon: React.ElementType } => {
  // Food logs always use health style
  if (type === "food") {
    return {
      bg: "bg-rose-100 dark:bg-rose-500/20",
      text: "text-rose-600 dark:text-rose-400",
      icon: Utensils,
    };
  }

  // Income transactions
  if (amount > 0) {
    return {
      bg: "bg-green-100 dark:bg-green-500/20",
      text: "text-green-600 dark:text-green-400",
      icon: TrendingUp,
    };
  }

  // Expense by category
  switch (category?.toLowerCase()) {
    case "transport":
    case "kendaraan":
    case "bensin":
      return {
        bg: "bg-blue-100 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        icon: Car,
      };
    case "makanan":
    case "food":
      return {
        bg: "bg-rose-100 dark:bg-rose-500/20",
        text: "text-rose-600 dark:text-rose-400",
        icon: Utensils,
      };
    default:
      return {
        bg: "bg-gray-100 dark:bg-gray-500/20",
        text: "text-gray-600 dark:text-gray-400",
        icon: TrendingDown,
      };
  }
};

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return "Baru saja";
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  if (diffInDays === 1) return "Kemarin";
  if (diffInDays < 7) return `${diffInDays} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount);
}

export default async function HomePage() {
  // 1. Authentication Check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  // 2. Get today's date range
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // 3. Parallel data fetching with Promise.all
  const [
    accountsData,
    todayFoodLogs,
    primaryVehicle,
    recentTransactions,
    recentFoodLogs,
  ] = await Promise.all([
    // a. Finance: Total balance from all accounts
    prisma.account.findMany({
      where: { userId },
      select: { balance: true },
    }),

    // b. Health: Today's calorie sum
    prisma.foodLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    }),

    // c. Vehicle: Get primary (first) vehicle
    prisma.vehicle.findFirst({
      where: { userId },
      include: {
        serviceLogs: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),

    // d. Recent transactions
    prisma.transaction.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        category: true,
        createdAt: true,
      },
    }),

    // e. Recent food logs
    prisma.foodLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        description: true,
        calories: true,
        createdAt: true,
      },
    }),
  ]);

  // 4. Process Finance Data
  const totalBalance = accountsData.reduce(
    (sum, acc) => sum + Number(acc.balance),
    0
  );
  // For now, percentage change is 0 (can be calculated with last month data later)
  const percentageChange = 0;

  // 5. Process Health Data
  const currentCalories = todayFoodLogs.reduce(
    (sum, log) => sum + (log.calories || 0),
    0
  );
  const currentProtein = todayFoodLogs.reduce(
    (sum, log) => sum + (log.protein || 0),
    0
  );
  const currentCarbs = todayFoodLogs.reduce(
    (sum, log) => sum + (log.carbs || 0),
    0
  );
  const currentFat = todayFoodLogs.reduce(
    (sum, log) => sum + (log.fat || 0),
    0
  );

  const targetCalories = 2000; // Hardcoded for now
  const macros = [
    {
      name: "Protein",
      current: Math.round(currentProtein),
      target: 80,
      unit: "g",
    },
    {
      name: "Karbo",
      current: Math.round(currentCarbs),
      target: 250,
      unit: "g",
    },
    { name: "Lemak", current: Math.round(currentFat), target: 65, unit: "g" },
  ];

  // 6. Process Vehicle Data
  const vehicleData = primaryVehicle
    ? {
        vehicleName: primaryVehicle.name,
        vehicleType: "Kendaraan",
        currentOdometer: primaryVehicle.currentOdo,
        // Simple service logic: alert every 2000 KM from last service
        nextServiceAt: primaryVehicle.serviceLogs[0]?.odometer
          ? primaryVehicle.serviceLogs[0].odometer + 2000
          : primaryVehicle.currentOdo + 2000,
        fuelLevel: 50, // Default, can be enhanced later
      }
    : null;

  // 7. Merge and sort recent activities
  const recentActivities: RecentActivity[] = [
    ...recentTransactions.map((tx) => ({
      id: tx.id,
      type: "transaction" as const,
      category: tx.category?.name || "general",
      title: tx.description || `${tx.type}`,
      amount: tx.type === "INCOME" ? Number(tx.amount) : -Number(tx.amount),
      createdAt: tx.createdAt,
    })),
    ...recentFoodLogs.map((food) => ({
      id: food.id,
      type: "food" as const,
      category: "health",
      title: food.description || "Makanan",
      amount: -(food.calories || 0), // Show calories as negative for visual consistency
      createdAt: food.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  // 8. Format date
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

      {/* Main Widgets Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Finance Widget */}
        <FinanceWidget
          totalBalance={totalBalance}
          percentageChange={percentageChange}
        />

        {/* Health Widget */}
        <HealthWidget
          currentCalories={currentCalories}
          targetCalories={targetCalories}
          macros={macros}
        />

        {/* Vehicle Widget */}
        {vehicleData ? (
          <VehicleWidget
            vehicleName={vehicleData.vehicleName}
            vehicleType={vehicleData.vehicleType}
            currentOdometer={vehicleData.currentOdometer}
            nextServiceAt={vehicleData.nextServiceAt}
            fuelLevel={vehicleData.fuelLevel}
          />
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Car className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Belum ada kendaraan
                </p>
                <p className="text-xs text-muted-foreground">
                  Tambahkan kendaraan untuk mulai tracking
                </p>
              </div>
            </CardContent>
          </Card>
        )}
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
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => {
              const style = getActivityStyle(
                activity.type,
                activity.category,
                activity.amount
              );
              const Icon = style.icon;
              const isFood = activity.type === "food";

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
                        {formatRelativeTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      !isFood && activity.amount > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground"
                    }`}
                  >
                    {isFood ? (
                      <>{Math.abs(activity.amount)} kkal</>
                    ) : (
                      <>
                        {activity.amount > 0 ? "+" : ""}
                        Rp {formatCurrency(Math.abs(activity.amount))}
                      </>
                    )}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Belum ada aktivitas
                </p>
                <p className="text-xs text-muted-foreground">
                  Mulai catat aktivitas keuangan dan makanan Anda
                </p>
              </div>
            </div>
          )}
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
                {totalBalance > 0 ? (
                  <>
                    Total saldo Anda saat ini{" "}
                    <strong>Rp {formatCurrency(totalBalance)}</strong>.{" "}
                  </>
                ) : (
                  <>Mulai tambahkan akun untuk tracking keuangan. </>
                )}
                {currentCalories > 0 ? (
                  <>
                    Target kalori sudah tercapai{" "}
                    <strong>
                      {Math.round((currentCalories / targetCalories) * 100)}%
                    </strong>{" "}
                    hari ini.
                  </>
                ) : (
                  <>Belum ada log makanan hari ini.</>
                )}
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
