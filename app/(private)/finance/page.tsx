import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Inbox,
  HandCoins,
  Handshake,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CashflowChart,
  AccountFormSheet,
  AccountListClient,
  TransactionFormSheet,
  DebtFormSheet,
  DebtList,
} from "@/components/finance";
import type { DebtWithContact } from "@/app/(private)/finance/debt-actions";

export const metadata: Metadata = {
  title: "Keuangan | My Super App",
  description: "Kelola dan lacak keuangan pribadi Anda",
};

// ========================
// HELPER FUNCTIONS
// ========================

/** Format currency to IDR string */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format amount with sign prefix */
function formatSignedCurrency(amount: number, type: string): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat("id-ID").format(absAmount);

  switch (type) {
    case "INCOME":
      return `+Rp ${formatted}`;
    case "EXPENSE":
      return `-Rp ${formatted}`;
    case "TRANSFER":
      return `Rp ${formatted}`;
    default:
      return `Rp ${formatted}`;
  }
}

// ========================
// TYPE DEFINITIONS
// ========================

interface TransactionWithAccounts {
  id: string;
  date: Date;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description: string | null;
  category: string | null;
  fromAccount: { id: string; name: string } | null;
  toAccount: { id: string; name: string } | null;
}

interface ChartDataItem {
  date: string;
  income: number;
  expense: number;
}

// ========================
// MAIN PAGE COMPONENT
// ========================

export default async function FinancePage() {
  // 1. Authentication Check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  // 2. Get date ranges
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  // For chart: last 7 days
  const sevenDaysAgo = subDays(today, 6);

  // 3. Parallel data fetching with Promise.all
  const [accounts, transactions, monthlyStats, chartTransactions, activeDebts] =
    await Promise.all([
      // a. All user accounts with balance
      prisma.account.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
        },
        orderBy: { name: "asc" },
      }),

      // b. Last 20 transactions with account relations
      prisma.transaction.findMany({
        where: {
          userId,
        },
        include: {
          fromAccount: { select: { id: true, name: true } },
          toAccount: { select: { id: true, name: true } },
          category: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 20,
      }),

      // c. Monthly income and expense stats
      prisma.transaction.groupBy({
        by: ["type"],
        where: {
          userId, // Use userId directly, not fromAccount.userId
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          type: {
            in: ["INCOME", "EXPENSE"],
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // d. Transactions for chart (last 7 days)
      prisma.transaction.findMany({
        where: {
          userId, // Use userId directly, not fromAccount.userId
          date: {
            gte: startOfDay(sevenDaysAgo),
            lte: endOfDay(today),
          },
          type: {
            in: ["INCOME", "EXPENSE"],
          },
        },
        select: {
          date: true,
          type: true,
          amount: true,
        },
      }),

      // e. Active debts (hutang/piutang)
      prisma.debt.findMany({
        where: {
          userId,
          isPaid: false,
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // 4. Process Data

  // a. Calculate Net Worth (sum of all account balances)
  const totalNetWorth = accounts.reduce(
    (sum, acc) => sum + Number(acc.balance),
    0,
  );

  // b. Extract monthly income and expense
  const monthlyIncome = Number(
    monthlyStats.find((s) => s.type === "INCOME")?._sum.amount ?? 0,
  );
  const monthlyExpense = Number(
    monthlyStats.find((s) => s.type === "EXPENSE")?._sum.amount ?? 0,
  );

  // d. Process debt data
  const formattedDebts: DebtWithContact[] = activeDebts.map((debt) => ({
    id: debt.id,
    type: debt.type as "LENDING" | "BORROWING",
    amount: Number(debt.amount),
    remaining: Number(debt.remaining),
    description: debt.description,
    dueDate: debt.dueDate,
    isPaid: debt.isPaid,
    createdAt: debt.createdAt,
    contact: debt.contact,
  }));

  // e. Calculate debt summary
  const totalLending = formattedDebts
    .filter((d) => d.type === "LENDING")
    .reduce((sum, d) => sum + d.remaining, 0);
  const totalBorrowing = formattedDebts
    .filter((d) => d.type === "BORROWING")
    .reduce((sum, d) => sum + d.remaining, 0);

  // c. Build chart data (group by date)
  const chartDataMap = new Map<string, { income: number; expense: number }>();

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = format(subDays(today, i), "dd/MM");
    chartDataMap.set(date, { income: 0, expense: 0 });
  }

  // Aggregate transactions
  chartTransactions.forEach((tx) => {
    const dateKey = format(tx.date, "dd/MM");
    const existing = chartDataMap.get(dateKey);
    if (existing) {
      if (tx.type === "INCOME") {
        existing.income += Number(tx.amount);
      } else if (tx.type === "EXPENSE") {
        existing.expense += Number(tx.amount);
      }
    }
  });

  const chartData: ChartDataItem[] = Array.from(chartDataMap.entries()).map(
    ([date, values]) => ({
      date,
      income: values.income,
      expense: values.expense,
    }),
  );

  // d. Format transactions for display
  const formattedTransactions: TransactionWithAccounts[] = transactions.map(
    (tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type as "INCOME" | "EXPENSE" | "TRANSFER",
      amount: Number(tx.amount),
      description: tx.description,
      category: tx.category?.name || null,
      fromAccount: tx.fromAccount,
      toAccount: tx.toAccount,
    }),
  );

  return (
    <div className="space-y-6">
      {/* ======================== */}
      {/* SECTION 1: Header */}
      {/* ======================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Keuangan
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola dan lacak semua transaksi keuangan Anda
          </p>
        </div>
        <div className="flex gap-2">
          <TransactionFormSheet />
          <DebtFormSheet />
        </div>
      </div>

      {/* ======================== */}
      {/* SECTION 2: Summary Cards */}
      {/* ======================== */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Net Worth Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Kekayaan Bersih
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10">
              <Wallet className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalNetWorth >= 0
                  ? "text-foreground"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(totalNetWorth)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dari {accounts.length} akun terdaftar
            </p>
          </CardContent>
        </Card>

        {/* Cashflow Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cashflow Bulan Ini
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-blue-100 dark:bg-blue-500/20">
              <ArrowRightLeft className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Masuk</span>
              </div>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(monthlyIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Keluar</span>
              </div>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(monthlyExpense)}
              </span>
            </div>
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Selisih
                </span>
                <span
                  className={`text-sm font-bold ${
                    monthlyIncome - monthlyExpense >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(monthlyIncome - monthlyExpense)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart Card */}
        <div className="md:col-span-2 lg:col-span-1">
          <CashflowChart data={chartData} />
        </div>

        {/* Piutang Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Piutang
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
              <HandCoins className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalLending)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Uang yang dipinjamkan ke orang lain
            </p>
          </CardContent>
        </Card>

        {/* Hutang Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hutang
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-orange-100 dark:bg-orange-500/20">
              <Handshake className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(totalBorrowing)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Uang yang dipinjam dari orang lain
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ======================== */}
      {/* SECTION 3: My Accounts */}
      {/* ======================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Akun Saya</h2>
          <AccountFormSheet
            trigger={
              <Button variant="ghost" size="sm" className="text-primary gap-1">
                <Plus className="size-3" />
                Tambah Akun
              </Button>
            }
          />
        </div>

        {accounts.length > 0 ? (
          <AccountListClient
            accounts={accounts.map((account) => ({
              id: account.id,
              name: account.name,
              type: account.type,
              balance: Number(account.balance),
            }))}
          />
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                <Wallet className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Belum ada akun
                </p>
                <p className="text-xs text-muted-foreground">
                  Tambahkan akun bank atau e-wallet untuk memulai
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ======================== */}
      {/* SECTION 4: Hutang & Piutang */}
      {/* ======================== */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Hutang & Piutang
            </CardTitle>
            <DebtFormSheet
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary gap-1"
                >
                  <Plus className="size-3" />
                  Catat Pinjaman
                </Button>
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          <DebtList debts={formattedDebts} />
        </CardContent>
      </Card>

      {/* ======================== */}
      {/* SECTION 5: Transaction History */}
      {/* ======================== */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Riwayat Transaksi
            </CardTitle>
            <Link href="/finance/transactions">
              <Button variant="ghost" size="sm" className="text-primary">
                Lihat Semua
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {formattedTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Kategori
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Akun</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formattedTransactions.map((tx) => (
                    <TransactionRow key={tx.id} transaction={tx} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Belum ada transaksi
                </p>
                <p className="text-xs text-muted-foreground">
                  Tambahkan transaksi pertama Anda untuk memulai tracking
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========================
// SUB-COMPONENTS
// ========================

function TransactionRow({
  transaction: tx,
}: {
  transaction: TransactionWithAccounts;
}) {
  // Build description for transfers
  const getDescription = () => {
    if (tx.type === "TRANSFER") {
      const from = tx.fromAccount?.name ?? "?";
      const to = tx.toAccount?.name ?? "?";
      return (
        <div className="flex items-center gap-1.5">
          <span>{from}</span>
          <ArrowRightLeft className="size-3 text-blue-500 shrink-0" />
          <span>{to}</span>
        </div>
      );
    }
    return tx.description ?? "-";
  };

  // Format account display
  const getAccountName = () => {
    if (tx.type === "TRANSFER") {
      return "-";
    }
    if (tx.type === "INCOME" && tx.toAccount) {
      return tx.toAccount.name;
    }
    if (tx.type === "EXPENSE" && tx.fromAccount) {
      return tx.fromAccount.name;
    }
    return tx.fromAccount?.name ?? tx.toAccount?.name ?? "-";
  };

  // Get amount styling
  const getAmountStyle = () => {
    switch (tx.type) {
      case "INCOME":
        return "text-emerald-600 dark:text-emerald-400";
      case "EXPENSE":
        return "text-red-600 dark:text-red-400";
      case "TRANSFER":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-foreground";
    }
  };

  // Get transaction icon
  const getIcon = () => {
    switch (tx.type) {
      case "INCOME":
        return (
          <ArrowDownLeft className="size-4 text-emerald-500 shrink-0 hidden sm:block" />
        );
      case "EXPENSE":
        return (
          <ArrowUpRight className="size-4 text-red-500 shrink-0 hidden sm:block" />
        );
      case "TRANSFER":
        return (
          <ArrowRightLeft className="size-4 text-blue-500 shrink-0 hidden sm:block" />
        );
      default:
        return null;
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
        {format(tx.date, "dd MMM", { locale: localeId })}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-sm font-medium text-foreground truncate max-w-[150px] md:max-w-[250px]">
            {getDescription()}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {tx.category ? (
          <Badge
            variant="secondary"
            className="text-xs font-normal bg-muted/50"
          >
            {tx.category}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">
          {getAccountName()}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className={`text-sm font-semibold ${getAmountStyle()}`}>
          {formatSignedCurrency(tx.amount, tx.type)}
        </span>
      </TableCell>
    </TableRow>
  );
}
