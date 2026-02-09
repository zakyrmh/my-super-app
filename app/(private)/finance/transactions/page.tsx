import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/lib/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  ArrowLeft,
  Search,
  Filter,
  Inbox,
  TrendingUp,
  TrendingDown,
  HandCoins,
  Handshake,
  Calendar,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  TransactionFormSheet,
  EditTransactionDialog,
} from "@/components/finance";

export const metadata: Metadata = {
  title: "Riwayat Transaksi | My Super App",
  description: "Lihat semua riwayat transaksi keuangan Anda",
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
    case "REPAYMENT":
      return `+Rp ${formatted}`;
    case "EXPENSE":
    case "LENDING":
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
  type: TransactionType;
  amount: number;
  description: string | null;
  category: string | null;
  fromAccount: { id: string; name: string } | null;
  toAccount: { id: string; name: string } | null;
}

interface PageProps {
  searchParams: Promise<{
    type?: string;
    month?: string;
    search?: string;
    page?: string;
  }>;
}

// Valid transaction types for filtering
const VALID_TYPES: TransactionType[] = [
  TransactionType.INCOME,
  TransactionType.EXPENSE,
  TransactionType.TRANSFER,
  TransactionType.LENDING,
  TransactionType.REPAYMENT,
];

// ========================
// MAIN PAGE COMPONENT
// ========================

export default async function TransactionsPage({ searchParams }: PageProps) {
  // 1. Authentication Check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  // 2. Parse search params
  const params = await searchParams;
  const typeFilter = params.type || "ALL";
  const monthParam = params.month;
  const searchQuery = params.search || "";
  const currentPage = parseInt(params.page || "1", 10);
  const itemsPerPage = 20;

  // 3. Calculate date range based on month filter
  let startDate: Date;
  let endDate: Date;
  let selectedMonth: string;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = endOfMonth(startDate);
    selectedMonth = monthParam;
  } else {
    // Default to current month
    const today = new Date();
    startDate = startOfMonth(today);
    endDate = endOfMonth(today);
    selectedMonth = format(today, "yyyy-MM");
  }

  // 4. Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    userId,
    date: {
      gte: startDate,
      lte: endDate,
    },
  };

  // Type filter
  if (
    typeFilter !== "ALL" &&
    VALID_TYPES.includes(typeFilter as TransactionType)
  ) {
    whereClause.type = typeFilter as TransactionType;
  }

  // Search filter
  if (searchQuery) {
    whereClause.OR = [
      { description: { contains: searchQuery, mode: "insensitive" } },
      {
        category: {
          is: {
            name: { contains: searchQuery, mode: "insensitive" },
          },
        },
      },
    ];
  }

  // 5. Fetch data with pagination
  const [transactions, totalCount, monthlyStats] = await Promise.all([
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        category: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      skip: (currentPage - 1) * itemsPerPage,
      take: itemsPerPage,
    }),

    prisma.transaction.count({
      where: whereClause,
    }),

    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    }),
  ]);

  // 6. Calculate stats
  const totalIncome =
    Number(monthlyStats.find((s) => s.type === "INCOME")?._sum.amount ?? 0) +
    Number(monthlyStats.find((s) => s.type === "REPAYMENT")?._sum.amount ?? 0);
  const totalExpense =
    Number(monthlyStats.find((s) => s.type === "EXPENSE")?._sum.amount ?? 0) +
    Number(monthlyStats.find((s) => s.type === "LENDING")?._sum.amount ?? 0);

  const incomeCount =
    (monthlyStats.find((s) => s.type === "INCOME")?._count ?? 0) +
    (monthlyStats.find((s) => s.type === "REPAYMENT")?._count ?? 0);
  const expenseCount =
    (monthlyStats.find((s) => s.type === "EXPENSE")?._count ?? 0) +
    (monthlyStats.find((s) => s.type === "LENDING")?._count ?? 0);
  const transferCount =
    monthlyStats.find((s) => s.type === "TRANSFER")?._count ?? 0;

  // 7. Format transactions for display
  const formattedTransactions: TransactionWithAccounts[] = transactions.map(
    (tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      category: tx.category?.name || null,
      fromAccount: tx.fromAccount,
      toAccount: tx.toAccount,
    }),
  );

  // 8. Calculate pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // 9. Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: localeId }),
    };
  });

  // 10. Build query string helper
  const buildQueryString = (overrides: Record<string, string>) => {
    const newParams = new URLSearchParams();
    if (typeFilter !== "ALL" || overrides.type) {
      newParams.set("type", overrides.type || typeFilter);
    }
    if (selectedMonth || overrides.month) {
      newParams.set("month", overrides.month || selectedMonth);
    }
    if (searchQuery || overrides.search !== undefined) {
      const s = overrides.search !== undefined ? overrides.search : searchQuery;
      if (s) newParams.set("search", s);
    }
    if (overrides.page) {
      newParams.set("page", overrides.page);
    }
    const qs = newParams.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="space-y-6">
      {/* ======================== */}
      {/* SECTION 1: Header */}
      {/* ======================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/finance">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Riwayat Transaksi
            </h1>
            <p className="text-sm text-muted-foreground">
              Lihat dan kelola semua transaksi keuangan Anda
            </p>
          </div>
        </div>
        <TransactionFormSheet />
      </div>

      {/* ======================== */}
      {/* SECTION 2: Summary Cards */}
      {/* ======================== */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Total Transactions */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transaksi
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10">
              <Calendar className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(startDate, "MMMM yyyy", { locale: localeId })}
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pemasukan
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
              <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalIncome)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {incomeCount} transaksi
            </p>
          </CardContent>
        </Card>

        {/* Expense */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pengeluaran
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-red-100 dark:bg-red-500/20">
              <TrendingDown className="size-5 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalExpense)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {expenseCount} transaksi
            </p>
          </CardContent>
        </Card>

        {/* Net */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Selisih
            </CardTitle>
            <div className="flex items-center justify-center size-9 rounded-xl bg-blue-100 dark:bg-blue-500/20">
              <ArrowRightLeft className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalIncome - totalExpense >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(totalIncome - totalExpense)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {transferCount} transfer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ======================== */}
      {/* SECTION 3: Filters */}
      {/* ======================== */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <form
            action="/finance/transactions"
            method="GET"
            className="flex flex-col md:flex-row gap-4"
          >
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                name="search"
                placeholder="Cari deskripsi atau kategori..."
                defaultValue={searchQuery}
                className="pl-10"
              />
            </div>

            {/* Month Filter */}
            <div className="w-full md:w-[200px]">
              <select
                name="month"
                defaultValue={selectedMonth}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="w-full md:w-[180px]">
              <select
                name="type"
                defaultValue={typeFilter}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="INCOME">Pemasukan</option>
                <option value="EXPENSE">Pengeluaran</option>
                <option value="TRANSFER">Transfer</option>
                <option value="LENDING">Piutang</option>
                <option value="REPAYMENT">Pembayaran</option>
              </select>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="gap-2">
              <Filter className="size-4" />
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ======================== */}
      {/* SECTION 4: Transaction Table */}
      {/* ======================== */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Daftar Transaksi
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {totalCount} transaksi
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {formattedTransactions.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[100px]">Tanggal</TableHead>
                      <TableHead className="w-[100px]">Tipe</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Kategori
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Akun
                      </TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="w-[80px] text-center">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formattedTransactions.map((tx) => (
                      <TransactionRow key={tx.id} transaction={tx} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages}
                  </p>
                  <div className="flex gap-2">
                    {currentPage > 1 && (
                      <Link
                        href={`/finance/transactions${buildQueryString({ page: String(currentPage - 1) })}`}
                      >
                        <Button variant="outline" size="sm">
                          Sebelumnya
                        </Button>
                      </Link>
                    )}
                    {currentPage < totalPages && (
                      <Link
                        href={`/finance/transactions${buildQueryString({ page: String(currentPage + 1) })}`}
                      >
                        <Button variant="outline" size="sm">
                          Selanjutnya
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Tidak ada transaksi
                </p>
                <p className="text-xs text-muted-foreground">
                  Tidak ditemukan transaksi dengan filter yang dipilih
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
  // Get type badge
  const getTypeBadge = () => {
    switch (tx.type) {
      case "INCOME":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
            <TrendingUp className="size-3 mr-1" />
            Masuk
          </Badge>
        );
      case "EXPENSE":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20">
            <TrendingDown className="size-3 mr-1" />
            Keluar
          </Badge>
        );
      case "TRANSFER":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20">
            <ArrowRightLeft className="size-3 mr-1" />
            Transfer
          </Badge>
        );
      case "LENDING":
        return (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20">
            <HandCoins className="size-3 mr-1" />
            Pinjam
          </Badge>
        );
      case "REPAYMENT":
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20">
            <Handshake className="size-3 mr-1" />
            Bayar
          </Badge>
        );
      default:
        return null;
    }
  };

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
    if ((tx.type === "INCOME" || tx.type === "REPAYMENT") && tx.toAccount) {
      return tx.toAccount.name;
    }
    if ((tx.type === "EXPENSE" || tx.type === "LENDING") && tx.fromAccount) {
      return tx.fromAccount.name;
    }
    return tx.fromAccount?.name ?? tx.toAccount?.name ?? "-";
  };

  // Get amount styling
  const getAmountStyle = () => {
    switch (tx.type) {
      case "INCOME":
      case "REPAYMENT":
        return "text-emerald-600 dark:text-emerald-400";
      case "EXPENSE":
      case "LENDING":
        return "text-red-600 dark:text-red-400";
      case "TRANSFER":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-foreground";
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">
            {format(tx.date, "dd MMM", { locale: localeId })}
          </span>
          <span className="text-[10px]">
            {format(tx.date, "yyyy", { locale: localeId })}
          </span>
        </div>
      </TableCell>
      <TableCell>{getTypeBadge()}</TableCell>
      <TableCell>
        <span className="text-sm font-medium text-foreground truncate max-w-[150px] md:max-w-[300px] block">
          {getDescription()}
        </span>
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
      <TableCell className="text-center">
        <EditTransactionDialog transactionId={tx.id} />
      </TableCell>
    </TableRow>
  );
}
