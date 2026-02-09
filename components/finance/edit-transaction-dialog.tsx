"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Info,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

interface FundingSource {
  id: string;
  name: string;
  amount: number;
}

// ========================
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
  const [fundingSourceName, setFundingSourceName] = React.useState("");
  const [transactionType, setTransactionType] = React.useState<
    "INCOME" | "EXPENSE" | "TRANSFER" | ""
  >("");

  // Data
  const [accounts, setAccounts] = React.useState<AccountOption[]>([]);
  const [originalFundings, setOriginalFundings] = React.useState<
    FundingSource[]
  >([]);

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

      // Load funding sources
      if (txData.fundings && txData.fundings.length > 0) {
        const fundings = txData.fundings.map((f) => ({
          id: f.fundingSourceId,
          name: f.fundingSourceName,
          amount: f.amount,
        }));
        setOriginalFundings(fundings);
        // Set the first (or primary) funding source name
        setFundingSourceName(fundings[0]?.name || "");
      }
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
        fundingSourceName:
          transactionType === "INCOME" && fundingSourceName.trim()
            ? fundingSourceName.trim()
            : null,
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

  const getTypeIcon = () => {
    switch (transactionType) {
      case "INCOME":
        return <TrendingUp className="size-4 text-green-600" />;
      case "EXPENSE":
        return <TrendingDown className="size-4 text-red-600" />;
      case "TRANSFER":
        return <ArrowRightLeft className="size-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeBadge = () => {
    const badges = {
      INCOME: (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <TrendingUp className="size-3 mr-1" />
          Pemasukan
        </Badge>
      ),
      EXPENSE: (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200"
        >
          <TrendingDown className="size-3 mr-1" />
          Pengeluaran
        </Badge>
      ),
      TRANSFER: (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          <ArrowRightLeft className="size-3 mr-1" />
          Transfer
        </Badge>
      ),
    };
    return transactionType ? badges[transactionType] : null;
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
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            <SheetTitle>Edit Transaksi</SheetTitle>
          </div>
          <SheetDescription>
            Ubah detail transaksi. Perubahan akan mempengaruhi saldo akun Anda.
          </SheetDescription>
        </SheetHeader>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="py-8">
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg flex items-start gap-3">
              <Info className="size-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Terjadi Kesalahan
                </p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {/* Transaction Type Badge */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">
                Tipe Transaksi
              </span>
              {getTypeBadge()}
            </div>

            <Separator />

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base font-semibold">
                Jumlah <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  Rp
                </span>
                <Input
                  id="amount"
                  value={formatCurrency(amount)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="pl-12 h-12 text-lg font-semibold"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="text-base font-semibold">
                Tanggal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>

            {/* Accounts Section */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Akun Transaksi
              </h3>

              {/* From Account (for EXPENSE and TRANSFER) */}
              {(transactionType === "EXPENSE" ||
                transactionType === "TRANSFER") && (
                <div className="space-y-2">
                  <Label htmlFor="fromAccount" className="font-medium">
                    Dari Akun <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={fromAccountId}
                    onValueChange={setFromAccountId}
                    disabled={loading}
                  >
                    <SelectTrigger id="fromAccount" className="h-11">
                      <SelectValue placeholder="Pilih akun sumber" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center justify-between w-full gap-3">
                            <span className="font-medium">{acc.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0,
                              }).format(acc.balance)}
                            </span>
                          </div>
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
                  <Label htmlFor="toAccount" className="font-medium">
                    Ke Akun <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={toAccountId}
                    onValueChange={setToAccountId}
                    disabled={loading}
                  >
                    <SelectTrigger id="toAccount" className="h-11">
                      <SelectValue placeholder="Pilih akun tujuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center justify-between w-full gap-3">
                            <span className="font-medium">{acc.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0,
                              }).format(acc.balance)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Category and Funding Source */}
            <div className="space-y-4">
              {/* Category (for INCOME and EXPENSE) */}
              {transactionType !== "TRANSFER" && (
                <div className="space-y-2">
                  <Label htmlFor="category" className="font-medium">
                    Kategori
                  </Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Masukkan kategori"
                    disabled={loading}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Opsional - untuk memudahkan pelacakan
                  </p>
                </div>
              )}

              {/* Funding Source Name (for INCOME only) */}
              {transactionType === "INCOME" && (
                <div className="space-y-2">
                  <Label htmlFor="fundingSource" className="font-medium">
                    Sumber Dana
                  </Label>
                  <Input
                    id="fundingSource"
                    value={fundingSourceName}
                    onChange={(e) => setFundingSourceName(e.target.value)}
                    placeholder="e.g. Gaji, Bonus, Freelance"
                    disabled={loading}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Label sumber pemasukan untuk pelacakan dana
                  </p>
                  {originalFundings.length > 0 && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-xs font-medium text-blue-900 mb-2">
                        Sumber Dana Sebelumnya:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {originalFundings.map((f, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-blue-100 text-blue-900"
                          >
                            {f.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-medium">
                Deskripsi
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tambahkan catatan untuk transaksi ini"
                disabled={loading}
                className="h-11"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md flex items-start gap-3">
                <Info className="size-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
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
