"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  HandCoins,
  Handshake,
  Calendar,
  MoreVertical,
  CheckCircle2,
  Banknote,
  Trash2,
  Wallet,
  Landmark,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  recordPayment,
  markDebtAsPaid,
  deleteDebt,
  getUserAccountsForDebt,
  type DebtWithContact,
  type AccountOption,
} from "@/app/(private)/finance/debt-actions";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ========================
// TYPE DEFINITIONS
// ========================

interface DebtCardProps {
  debt: DebtWithContact;
}

// ========================
// ACCOUNT TYPE ICONS
// ========================

const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  BANK: Landmark,
  EWALLET: Wallet,
  CASH: Banknote,
  INVESTMENT: TrendingUp,
  CREDIT: CreditCard,
};

// ========================
// HELPER FUNCTIONS
// ========================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyInput(value: string): string {
  const cleaned = value.replace(/[^\d]/g, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("id-ID");
}

function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

// ========================
// PAYMENT SHEET COMPONENT
// ========================

interface PaymentSheetProps {
  debt: DebtWithContact;
  trigger: React.ReactNode;
}

function PaymentSheet({ debt, trigger }: PaymentSheetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);
  const [accounts, setAccounts] = React.useState<AccountOption[]>([]);
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errors, setErrors] = React.useState<{
    amount?: string;
    account?: string;
  }>({});
  const [serverMessage, setServerMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load accounts when sheet opens
  React.useEffect(() => {
    if (open) {
      setIsLoadingAccounts(true);
      getUserAccountsForDebt()
        .then(setAccounts)
        .finally(() => setIsLoadingAccounts(false));
    }
  }, [open]);

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      setAmount("");
      setAccountId("");
      setDescription("");
      setErrors({});
      setServerMessage(null);
    }
  }, [open]);

  // Get selected account
  const selectedAccount = accounts.find((a) => a.id === accountId);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { amount?: string; account?: string } = {};
    const parsedAmount = parseCurrencyInput(amount);

    if (parsedAmount <= 0) {
      newErrors.amount = "Jumlah pembayaran wajib diisi";
    } else if (parsedAmount > debt.remaining) {
      newErrors.amount = `Jumlah melebihi sisa pinjaman (${formatCurrency(
        debt.remaining
      )})`;
    }

    if (!accountId) {
      newErrors.account = "Akun wajib dipilih";
    }

    // For BORROWING payment (saya bayar), check balance
    if (debt.type === "BORROWING" && selectedAccount && parsedAmount > 0) {
      if (parsedAmount > selectedAccount.balance) {
        newErrors.amount = `Saldo tidak cukup. Tersedia: ${formatCurrency(
          selectedAccount.balance
        )}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setServerMessage(null);

    try {
      const result = await recordPayment({
        debtId: debt.id,
        amount: parseCurrencyInput(amount),
        accountId,
        description: description || null,
      });

      if (result.success) {
        setServerMessage({ type: "success", text: result.message });
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 1500);
      } else {
        setServerMessage({ type: "error", text: result.message });
      }
    } catch {
      setServerMessage({
        type: "error",
        text: "Terjadi kesalahan. Silakan coba lagi.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fill with full remaining amount
  const handlePayFull = () => {
    setAmount(debt.remaining.toLocaleString("id-ID"));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  // Get labels based on debt type
  const isLending = debt.type === "LENDING";
  const typeLabel = isLending
    ? `${debt.contact.name} membayar`
    : `Saya membayar ke ${debt.contact.name}`;
  const accountLabel = isLending ? "Akun Tujuan" : "Akun Sumber";
  const accountHint = isLending
    ? "Uang akan masuk ke akun ini"
    : "Uang akan dikeluarkan dari akun ini";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Catat Pembayaran</SheetTitle>
          <SheetDescription>{typeLabel}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-4 py-6">
          {/* Debt Info Summary */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Pinjaman</span>
              <span className="font-medium">{formatCurrency(debt.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sudah Dibayar</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {formatCurrency(debt.amount - debt.remaining)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sisa</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(debt.remaining)}
              </span>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="paymentAmount">
                Jumlah Pembayaran <span className="text-red-500">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-primary"
                onClick={handlePayFull}
              >
                Bayar Lunas
              </Button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="paymentAmount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                className="pl-10"
                value={amount}
                onChange={(e) => {
                  setAmount(formatCurrencyInput(e.target.value));
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                disabled={isSubmitting}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="paymentAccount">
              {accountLabel} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={accountId}
              onValueChange={(value) => {
                setAccountId(value);
                setErrors((prev) => ({ ...prev, account: undefined }));
              }}
              disabled={isSubmitting || isLoadingAccounts}
            >
              <SelectTrigger id="paymentAccount">
                <SelectValue placeholder="Pilih akun..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingAccounts ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    Belum ada akun tersedia
                  </div>
                ) : (
                  accounts.map((account) => {
                    const Icon = ACCOUNT_TYPE_ICONS[account.type] || Wallet;
                    return (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          <span>{account.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatCurrency(account.balance)})
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{accountHint}</p>
            {selectedAccount && parseCurrencyInput(amount) > 0 && (
              <p
                className={`text-xs ${
                  isLending
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {isLending
                  ? `Saldo akan bertambah: ${formatCurrency(
                      selectedAccount.balance
                    )} → ${formatCurrency(
                      selectedAccount.balance + parseCurrencyInput(amount)
                    )}`
                  : `Saldo akan berkurang: ${formatCurrency(
                      selectedAccount.balance
                    )} → ${formatCurrency(
                      selectedAccount.balance - parseCurrencyInput(amount)
                    )}`}
              </p>
            )}
            {errors.account && (
              <p className="text-xs text-red-500">{errors.account}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="paymentDescription">Catatan (Opsional)</Label>
            <Input
              id="paymentDescription"
              placeholder="Contoh: Cicilan pertama"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Server Message */}
          {serverMessage && (
            <div
              className={`rounded-lg p-3 text-sm ${
                serverMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              }`}
            >
              {serverMessage.text}
            </div>
          )}
        </form>

        <SheetFooter className="border-t border-border/50">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Menyimpan...
              </>
            ) : (
              "Simpan Pembayaran"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ========================
// MAIN COMPONENT
// ========================

export function DebtCard({ debt }: DebtCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = React.useState(false);

  const isLending = debt.type === "LENDING";
  const progress = ((debt.amount - debt.remaining) / debt.amount) * 100;
  const isOverdue = debt.dueDate && new Date(debt.dueDate) < new Date();

  const handleMarkAsPaid = async () => {
    if (isMarkingPaid) return;
    // For now, just mark as paid without account selection
    // User should use "Bayar" button for proper account integration
    setIsMarkingPaid(true);
    try {
      await markDebtAsPaid(debt.id);
      router.refresh();
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!confirm("Yakin ingin menghapus pinjaman ini?")) return;
    setIsDeleting(true);
    try {
      await deleteDebt(debt.id);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon & Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div
              className={`flex items-center justify-center size-10 rounded-full shrink-0 ${
                isLending
                  ? "bg-emerald-100 dark:bg-emerald-500/20"
                  : "bg-orange-100 dark:bg-orange-500/20"
              }`}
            >
              {isLending ? (
                <HandCoins className="size-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Handshake className="size-5 text-orange-600 dark:text-orange-400" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Contact Name & Type Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate">
                  {debt.contact.name}
                </span>
                <Badge
                  variant="secondary"
                  className={`text-xs shrink-0 ${
                    isLending
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                  }`}
                >
                  {isLending ? "Piutang" : "Hutang"}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs shrink-0">
                    Jatuh Tempo
                  </Badge>
                )}
              </div>

              {/* Description */}
              {debt.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {debt.description}
                </p>
              )}

              {/* Due Date */}
              {debt.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  <span>
                    Jatuh tempo:{" "}
                    {format(new Date(debt.dueDate), "dd MMM yyyy", {
                      locale: localeId,
                    })}
                  </span>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-1 pt-1">
                <Progress value={progress} className="h-1.5" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Terbayar {progress.toFixed(0)}%
                  </span>
                  <span className="font-medium text-foreground">
                    Sisa: {formatCurrency(debt.remaining)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Amount & Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`text-lg font-bold ${
                isLending
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-orange-600 dark:text-orange-400"
              }`}
            >
              {formatCurrency(debt.amount)}
            </span>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <PaymentSheet
                debt={debt}
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    <Banknote className="size-3" />
                    Bayar
                  </Button>
                }
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={isDeleting || isMarkingPaid}
                  >
                    {isDeleting || isMarkingPaid ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MoreVertical className="size-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleMarkAsPaid}>
                    <CheckCircle2 className="size-4 mr-2" />
                    Tandai Lunas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================
// DEBT LIST COMPONENT
// ========================

interface DebtListProps {
  debts: DebtWithContact[];
}

export function DebtList({ debts }: DebtListProps) {
  // Separate lending and borrowing
  const lendingDebts = debts.filter((d) => d.type === "LENDING");
  const borrowingDebts = debts.filter((d) => d.type === "BORROWING");

  if (debts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
        <div className="flex items-center justify-center size-12 rounded-full bg-muted">
          <HandCoins className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Tidak ada hutang/piutang aktif
          </p>
          <p className="text-xs text-muted-foreground">
            Semua pinjaman sudah lunas 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Piutang (Lending) Section */}
      {lendingDebts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <HandCoins className="size-4 text-emerald-500" />
            Piutang ({lendingDebts.length})
          </h4>
          <div className="space-y-2">
            {lendingDebts.map((debt) => (
              <DebtCard key={debt.id} debt={debt} />
            ))}
          </div>
        </div>
      )}

      {/* Hutang (Borrowing) Section */}
      {borrowingDebts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Handshake className="size-4 text-orange-500" />
            Hutang ({borrowingDebts.length})
          </h4>
          <div className="space-y-2">
            {borrowingDebts.map((debt) => (
              <DebtCard key={debt.id} debt={debt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
