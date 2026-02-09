"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getUserAccounts,
  type AccountOption,
} from "@/app/(private)/finance/actions";
import {
  getTransactionForEdit,
  editTransaction,
  type EditTransactionInput,
} from "@/app/(private)/finance/edit-actions";

// ========================
// TYPE DEFINITIONS
// ========================

interface EditTransactionDialogProps {
  transactionId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

//========================
// MAIN COMPONENT
// ========================

export function EditTransactionDialog({
  transactionId,
  trigger,
  onSuccess,
}: EditTransactionDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingData, setLoadingData] = React.useState(true);
  const [error, setError] = React.useState("");

  // Form state
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [fromAccountId, setFromAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [transactionType, setTransactionType] = React.useState<
    "INCOME" | "EXPENSE" | "TRANSFER" | ""
  >("");

  // Data
  const [accounts, setAccounts] = React.useState<AccountOption[]>([]);

  const loadTransactionData = React.useCallback(async () => {
    try {
      setLoadingData(true);
      setError("");

      const [txData, accountsData] = await Promise.all([
        getTransactionForEdit(transactionId),
        getUserAccounts(),
      ]);

      if (!txData) {
        setError("Transaksi tidak ditemukan");
        return;
      }

      // Only allow editing INCOME, EXPENSE, TRANSFER (not debt-related)
      if (!["INCOME", "EXPENSE", "TRANSFER"].includes(txData.type)) {
        setError(
          "Transaksi hutang/piutang harus diedit dari menu Hutang & Piutang",
        );
        return;
      }

      setTransactionType(txData.type as "INCOME" | "EXPENSE" | "TRANSFER");
      setAmount(txData.amount.toString());
      setDate(txData.date.split("T")[0]);
      setDescription(txData.description || "");
      setCategory(txData.category || "");
      setFromAccountId(txData.fromAccount?.id || "");
      setToAccountId(txData.toAccount?.id || "");
      setAccounts(accountsData);
    } catch (error) {
      console.error("Error loading transaction:", error);
      setError("Gagal memuat data transaksi");
    } finally {
      setLoadingData(false);
    }
  }, [transactionId]);

  // Load transaction data when sheet opens
  React.useEffect(() => {
    if (open) {
      loadTransactionData();
    }
  }, [open, loadTransactionData]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");

      // Validation
      if (!transactionType) {
        setError("Tipe transaksi tidak valid");
        return;
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError("Jumlah harus lebih dari 0");
        return;
      }

      if (transactionType === "INCOME" && !toAccountId) {
        setError("Akun tujuan wajib dipilih untuk pemasukan");
        return;
      }

      if (transactionType === "EXPENSE" && !fromAccountId) {
        setError("Akun sumber wajib dipilih untuk pengeluaran");
        return;
      }

      if (transactionType === "TRANSFER") {
        if (!fromAccountId || !toAccountId) {
          setError("Akun asal dan tujuan wajib dipilih untuk transfer");
          return;
        }
        if (fromAccountId === toAccountId) {
          setError("Akun asal dan tujuan tidak boleh sama");
          return;
        }
      }

      const input: EditTransactionInput = {
        transactionId,
        type: transactionType,
        amount: amountNum,
        date: new Date(date).toISOString(),
        description: description.trim() || null,
        category: category.trim() || null,
        fromAccountId: fromAccountId || null,
        toAccountId: toAccountId || null,
      };

      const result = await editTransaction(input);

      if (result.success) {
        setOpen(false);
        router.refresh();
        onSuccess?.();
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error("Error editing transaction:", error);
      setError("Terjadi kesalahan saat mengedit transaksi");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value.replace(/[^0-9]/g, ""));
    if (isNaN(num)) return "";
    return new Intl.NumberFormat("id-ID").format(num);
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    setAmount(cleaned);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Transaksi</SheetTitle>
          <SheetDescription>
            Ubah detail transaksi. Pastikan data yang Anda masukkan sudah benar.
          </SheetDescription>
        </SheetHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8">
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-6">
            {/* Transaction Type (Read-only) */}
            <div className="space-y-2">
              <Label>Tipe Transaksi</Label>
              <Input
                value={
                  transactionType === "INCOME"
                    ? "Pemasukan"
                    : transactionType === "EXPENSE"
                      ? "Pengeluaran"
                      : "Transfer"
                }
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Tipe transaksi tidak dapat diubah
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Jumlah <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="amount"
                  value={formatCurrency(amount)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">
                Tanggal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* From Account (for EXPENSE and TRANSFER) */}
            {(transactionType === "EXPENSE" ||
              transactionType === "TRANSFER") && (
              <div className="space-y-2">
                <Label htmlFor="fromAccount">
                  Akun Sumber <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={fromAccountId}
                  onValueChange={setFromAccountId}
                  disabled={loading}
                >
                  <SelectTrigger id="fromAccount">
                    <SelectValue placeholder="Pilih akun sumber" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} (
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          minimumFractionDigits: 0,
                        }).format(acc.balance)}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* To Account (for INCOME and TRANSFER) */}
            {(transactionType === "INCOME" ||
              transactionType === "TRANSFER") && (
              <div className="space-y-2">
                <Label htmlFor="toAccount">
                  Akun Tujuan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={toAccountId}
                  onValueChange={setToAccountId}
                  disabled={loading}
                >
                  <SelectTrigger id="toAccount">
                    <SelectValue placeholder="Pilih akun tujuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} (
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          minimumFractionDigits: 0,
                        }).format(acc.balance)}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category (for INCOME and EXPENSE) */}
            {transactionType !== "TRANSFER" && (
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Masukkan kategori"
                  disabled={loading}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tambahkan catatan untuk transaksi ini"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading || loadingData}
            className="w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || loadingData || !!error}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Simpan Perubahan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
