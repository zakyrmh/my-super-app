"use client";

import * as React from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Landmark,
  Wallet,
  Banknote,
  TrendingUp,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Loader2,
  Tag,
  Receipt,
  CalendarDays,
  HandCoins,
  Handshake,
} from "lucide-react";
import {
  getAccountDetail,
  getAccountTagBalances,
  getAccountTransactions,
  type AccountDetail,
  type AccountTransaction,
} from "@/app/(private)/finance/actions";
import { type TagBalance } from "@/lib/finance/smart-allocation";

// ========================
// TYPE DEFINITIONS
// ========================

interface AccountDetailSheetProps {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ========================
// HELPER FUNCTIONS
// ========================

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
        gradient: "from-blue-500/20 to-blue-600/5",
      };
    case "EWALLET":
      return {
        icon: Wallet,
        bg: "bg-violet-100 dark:bg-violet-500/20",
        text: "text-violet-600 dark:text-violet-400",
        badge:
          "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
        gradient: "from-violet-500/20 to-violet-600/5",
      };
    case "CASH":
      return {
        icon: Banknote,
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        badge:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        gradient: "from-emerald-500/20 to-emerald-600/5",
      };
    case "INVESTMENT":
      return {
        icon: TrendingUp,
        bg: "bg-amber-100 dark:bg-amber-500/20",
        text: "text-amber-600 dark:text-amber-400",
        badge:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        gradient: "from-amber-500/20 to-amber-600/5",
      };
    case "CREDIT":
      return {
        icon: CreditCard,
        bg: "bg-rose-100 dark:bg-rose-500/20",
        text: "text-rose-600 dark:text-rose-400",
        badge:
          "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        gradient: "from-rose-500/20 to-rose-600/5",
      };
    default:
      return {
        icon: Wallet,
        bg: "bg-gray-100 dark:bg-gray-500/20",
        text: "text-gray-600 dark:text-gray-400",
        badge:
          "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
        gradient: "from-gray-500/20 to-gray-600/5",
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

// ========================
// MAIN COMPONENT
// ========================

export function AccountDetailSheet({
  accountId,
  open,
  onOpenChange,
}: AccountDetailSheetProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [account, setAccount] = React.useState<AccountDetail | null>(null);
  const [tagBalances, setTagBalances] = React.useState<TagBalance[]>([]);
  const [transactions, setTransactions] = React.useState<AccountTransaction[]>(
    [],
  );

  // Fetch data when sheet opens
  React.useEffect(() => {
    if (open && accountId) {
      setIsLoading(true);

      Promise.all([
        getAccountDetail(accountId),
        getAccountTagBalances(accountId),
        getAccountTransactions(accountId, 0), // 0 = no limit, get all transactions
      ])
        .then(([detail, tags, txs]) => {
          setAccount(detail);
          setTagBalances(tags);
          setTransactions(txs);
        })
        .catch((error) => {
          console.error("Error fetching account data:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, accountId]);

  // Reset state when sheet closes
  React.useEffect(() => {
    if (!open) {
      setAccount(null);
      setTagBalances([]);
      setTransactions([]);
    }
  }, [open]);

  const style = account ? getAccountStyle(account.type) : null;
  const Icon = style?.icon ?? Wallet;
  const isNegative = account ? account.balance < 0 : false;

  // Calculate total tag balances
  const totalTagBalance = tagBalances.reduce((sum, tb) => sum + tb.balance, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            {/* Hidden title for accessibility */}
            <SheetHeader className="sr-only">
              <SheetTitle>Memuat Detail Akun</SheetTitle>
              <SheetDescription>Sedang memuat data akun...</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Memuat data...</p>
            </div>
          </div>
        ) : !account ? (
          <div className="flex items-center justify-center h-full">
            {/* Hidden title for accessibility */}
            <SheetHeader className="sr-only">
              <SheetTitle>Akun Tidak Ditemukan</SheetTitle>
              <SheetDescription>
                Akun yang diminta tidak dapat ditemukan
              </SheetDescription>
            </SheetHeader>
            <p className="text-sm text-muted-foreground">
              Akun tidak ditemukan
            </p>
          </div>
        ) : (
          <>
            {/* Header with gradient background */}
            <div
              className={`relative bg-linear-to-b ${style?.gradient} border-b border-border/50`}
            >
              <SheetHeader className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex items-center justify-center size-14 rounded-2xl ${style?.bg} shadow-sm`}
                  >
                    <Icon className={`size-7 ${style?.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-xl font-bold text-foreground truncate">
                      {account.name}
                    </SheetTitle>
                    <SheetDescription className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${style?.badge}`}
                      >
                        {getTypeLabel(account.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {account.transactionCount} transaksi
                      </span>
                    </SheetDescription>
                  </div>
                </div>

                {/* Balance Display */}
                <div className="mt-4 p-4 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Saldo Saat Ini
                  </p>
                  <p
                    className={`text-3xl font-bold tracking-tight ${
                      isNegative
                        ? "text-red-600 dark:text-red-400"
                        : "text-foreground"
                    }`}
                  >
                    {formatCurrency(account.balance)}
                  </p>
                </div>
              </SheetHeader>
            </div>

            {/* Scrollable Content */}
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDownLeft className="size-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">
                          Total Masuk
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(account.totalIncome)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="size-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">
                          Total Keluar
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(account.totalExpense)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Credit Card specific info */}
                {account.type === "CREDIT" && account.creditLimit && (
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="size-4 text-rose-500" />
                        <span className="text-sm font-medium">Info Kredit</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Limit</span>
                          <span className="font-medium">
                            {formatCurrency(account.creditLimit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Terpakai
                          </span>
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {formatCurrency(Math.abs(account.balance))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tersisa</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(
                              account.creditLimit + account.balance,
                            )}
                          </span>
                        </div>
                        {account.statementDate && (
                          <div className="flex justify-between pt-2 border-t border-border/50">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="size-3" /> Tanggal
                              Tagihan
                            </span>
                            <span className="font-medium">
                              Tgl {account.statementDate}
                            </span>
                          </div>
                        )}
                        {account.dueDate && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="size-3" /> Jatuh Tempo
                            </span>
                            <span className="font-medium">
                              Tgl {account.dueDate}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Fund Sources (Tags) */}
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Tag className="size-4 text-primary" />
                        <span className="text-sm font-medium">Sumber Dana</span>
                      </div>
                      {tagBalances.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Total: {formatCurrency(totalTagBalance)}
                        </span>
                      )}
                    </div>

                    {tagBalances.length > 0 ? (
                      <div className="space-y-2">
                        {tagBalances.map((tb) => {
                          const percentage =
                            totalTagBalance > 0
                              ? (tb.balance / totalTagBalance) * 100
                              : 0;

                          return (
                            <div
                              key={tb.tag}
                              className="p-3 rounded-lg bg-muted/30 border border-border/30"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium flex items-center gap-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-primary/10 text-primary"
                                  >
                                    {tb.tag}
                                  </Badge>
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatCurrency(tb.balance)}
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                                <span>Masuk: {formatCurrency(tb.credit)}</span>
                                <span>Keluar: {formatCurrency(tb.debit)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <Tag className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Belum ada sumber dana tercatat
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Tambahkan pemasukan dengan kategori untuk melacak
                          sumber dana
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* All Transactions */}
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-primary" />
                        <span className="text-sm font-medium">
                          Seluruh Transaksi
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {transactions.length} transaksi
                      </span>
                    </div>

                    {transactions.length > 0 ? (
                      <TransactionList
                        transactions={transactions}
                        currentAccountId={account.id}
                      />
                    ) : (
                      <div className="py-6 text-center">
                        <Receipt className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Belum ada transaksi
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ========================
// SUB-COMPONENTS
// ========================

interface TransactionListProps {
  transactions: AccountTransaction[];
  currentAccountId: string;
}

interface DayGroup {
  date: string;
  dateLabel: string;
  dayName: string;
  transactions: AccountTransaction[];
  totalIn: number;
  totalOut: number;
}

function TransactionList({
  transactions,
  currentAccountId,
}: TransactionListProps) {
  // Group transactions by day with income/expense summary
  const groupedByDay = React.useMemo(() => {
    const groups = new Map<string, DayGroup>();

    transactions.forEach((tx) => {
      const dateKey = format(tx.date, "yyyy-MM-dd");
      const existing = groups.get(dateKey);

      // Calculate if this transaction is incoming or outgoing for this account
      // REPAYMENT to this account is incoming (friend repays loan)
      // LENDING from this account is outgoing (lending money to friend)
      const isIncoming =
        tx.type === "INCOME" ||
        tx.type === "REPAYMENT" ||
        (tx.type === "TRANSFER" && tx.toAccountId === currentAccountId);

      const amount = tx.amount;

      if (existing) {
        existing.transactions.push(tx);
        if (isIncoming) {
          existing.totalIn += amount;
        } else {
          existing.totalOut += amount;
        }
      } else {
        groups.set(dateKey, {
          date: dateKey,
          dateLabel: format(tx.date, "dd MMMM yyyy", { locale: localeId }),
          dayName: format(tx.date, "EEEE", { locale: localeId }),
          transactions: [tx],
          totalIn: isIncoming ? amount : 0,
          totalOut: isIncoming ? 0 : amount,
        });
      }
    });

    return Array.from(groups.values());
  }, [transactions, currentAccountId]);

  return (
    <div className="space-y-4">
      {groupedByDay.map((dayGroup) => (
        <div key={dayGroup.date}>
          {/* Day Header */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm py-2 mb-2 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {dayGroup.dayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dayGroup.dateLabel}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {dayGroup.totalIn > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatCurrency(dayGroup.totalIn).replace("Rp", "").trim()}
                  </span>
                )}
                {dayGroup.totalOut > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    -
                    {formatCurrency(dayGroup.totalOut).replace("Rp", "").trim()}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Transactions for this day */}
          <div className="space-y-1">
            {dayGroup.transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                currentAccountId={currentAccountId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TransactionItemProps {
  transaction: AccountTransaction;
  currentAccountId: string;
}

function TransactionItem({
  transaction: tx,
  currentAccountId,
}: TransactionItemProps) {
  // Determine if this is incoming or outgoing for the current account
  // REPAYMENT = friend repays loan (incoming money)
  // LENDING = lending money to friend (outgoing money)
  const isIncoming =
    tx.type === "INCOME" ||
    tx.type === "REPAYMENT" ||
    (tx.type === "TRANSFER" && tx.toAccountId === currentAccountId);
  const isOutgoing =
    tx.type === "EXPENSE" ||
    tx.type === "LENDING" ||
    (tx.type === "TRANSFER" && tx.fromAccountId === currentAccountId);

  const getIcon = () => {
    switch (tx.type) {
      case "INCOME":
        return <ArrowDownLeft className="size-4 text-emerald-500" />;
      case "EXPENSE":
        return <ArrowUpRight className="size-4 text-red-500" />;
      case "TRANSFER":
        return <ArrowRightLeft className="size-4 text-blue-500" />;
      case "LENDING":
        return <HandCoins className="size-4 text-orange-500" />;
      case "REPAYMENT":
        return <Handshake className="size-4 text-emerald-500" />;
      default:
        return null;
    }
  };

  const getAmountStyle = () => {
    if (tx.type === "TRANSFER") {
      return isIncoming
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";
    }
    switch (tx.type) {
      case "INCOME":
      case "REPAYMENT":
        return "text-emerald-600 dark:text-emerald-400";
      case "EXPENSE":
      case "LENDING":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-foreground";
    }
  };

  const getAmountPrefix = () => {
    if (isIncoming) return "+";
    if (isOutgoing) return "-";
    return "";
  };

  const getDescription = () => {
    if (tx.type === "TRANSFER") {
      if (isIncoming) {
        return `Transfer dari ${tx.fromAccountName ?? "?"}`;
      } else {
        return `Transfer ke ${tx.toAccountName ?? "?"}`;
      }
    }
    return tx.description || tx.category || "Transaksi";
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-center size-8 rounded-full bg-muted/50">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {getDescription()}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>{format(tx.date, "dd MMM", { locale: localeId })}</span>
          {/* Show flowTag for INCOME/REPAYMENT transactions */}
          {tx.flowTag && (
            <>
              <span>•</span>
              <Badge
                variant="secondary"
                className="text-xs py-0 px-1.5 bg-primary/5"
              >
                {tx.flowTag}
              </Badge>
            </>
          )}
          {/* Show funding source tags for EXPENSE/LENDING transactions */}
          {(tx.type === "EXPENSE" || tx.type === "LENDING") &&
            tx.fundings &&
            tx.fundings.length > 0 && (
              <>
                <span>•</span>
                <span className="text-xs text-muted-foreground">dari:</span>
                {tx.fundings.map((funding, idx) => (
                  <Badge
                    key={`${tx.id}-funding-${idx}`}
                    variant="outline"
                    className="text-xs py-0 px-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                  >
                    {funding.sourceTag}
                  </Badge>
                ))}
              </>
            )}
        </div>
      </div>
      <p className={`text-sm font-semibold ${getAmountStyle()}`}>
        {getAmountPrefix()}
        {formatCurrency(tx.amount).replace("Rp", "").trim()}
      </p>
    </div>
  );
}
