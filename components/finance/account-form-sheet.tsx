"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Landmark,
  Wallet,
  Banknote,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createAccount,
  type AccountType,
  type CreateAccountInput,
} from "@/app/(private)/finance/actions";

// ========================
// TYPE DEFINITIONS
// ========================

interface AccountFormSheetProps {
  /** Optional trigger element, defaults to "Tambah Akun" button */
  trigger?: React.ReactNode;
}

interface FormState {
  name: string;
  type: AccountType | "";
  balance: string;
  creditLimit: string;
  statementDate: string;
  dueDate: string;
}

interface FormErrors {
  name?: string;
  type?: string;
  balance?: string;
  creditLimit?: string;
  statementDate?: string;
  dueDate?: string;
}

// ========================
// ACCOUNT TYPE OPTIONS
// ========================

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: "BANK",
    label: "Bank",
    icon: Landmark,
    description: "Rekening bank (BCA, BRI, Mandiri, dll)",
  },
  {
    value: "EWALLET",
    label: "E-Wallet",
    icon: Wallet,
    description: "Dompet digital (GoPay, OVO, Dana, dll)",
  },
  {
    value: "CASH",
    label: "Tunai",
    icon: Banknote,
    description: "Uang tunai di tangan",
  },
  {
    value: "INVESTMENT",
    label: "Investasi",
    icon: TrendingUp,
    description: "Reksa dana, saham, deposito, dll",
  },
  {
    value: "CREDIT",
    label: "Kartu Kredit",
    icon: CreditCard,
    description: "Kartu kredit atau paylater",
  },
];

// ========================
// HELPER FUNCTIONS
// ========================

function formatCurrencyInput(value: string): string {
  // Remove non-numeric characters except minus
  const cleaned = value.replace(/[^\d-]/g, "");

  // Parse as number
  const num = parseInt(cleaned, 10);

  if (isNaN(num)) return "";

  // Format with thousand separator
  return num.toLocaleString("id-ID");
}

function parseCurrencyInput(value: string): number {
  // Remove all non-numeric characters except minus
  const cleaned = value.replace(/[^\d-]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

// ========================
// MAIN COMPONENT
// ========================

export function AccountFormSheet({ trigger }: AccountFormSheetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [form, setForm] = React.useState<FormState>({
    name: "",
    type: "",
    balance: "",
    creditLimit: "",
    statementDate: "",
    dueDate: "",
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  // Check if selected type is CREDIT
  const isCredit = form.type === "CREDIT";

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      setForm({
        name: "",
        type: "",
        balance: "",
        creditLimit: "",
        statementDate: "",
        dueDate: "",
      });
      setErrors({});
      setServerMessage(null);
    }
  }, [open]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Nama akun wajib diisi";
    }

    if (!form.type) {
      newErrors.type = "Tipe akun wajib dipilih";
    }

    // Validate credit-specific fields
    if (isCredit) {
      if (form.statementDate) {
        const day = parseInt(form.statementDate, 10);
        if (isNaN(day) || day < 1 || day > 31) {
          newErrors.statementDate = "Tanggal harus antara 1-31";
        }
      }

      if (form.dueDate) {
        const day = parseInt(form.dueDate, 10);
        if (isNaN(day) || day < 1 || day > 31) {
          newErrors.dueDate = "Tanggal harus antara 1-31";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setServerMessage(null);

    try {
      const input: CreateAccountInput = {
        name: form.name.trim(),
        type: form.type as AccountType,
        balance: parseCurrencyInput(form.balance),
        creditLimit:
          isCredit && form.creditLimit
            ? parseCurrencyInput(form.creditLimit)
            : null,
        statementDate:
          isCredit && form.statementDate
            ? parseInt(form.statementDate, 10)
            : null,
        dueDate: isCredit && form.dueDate ? parseInt(form.dueDate, 10) : null,
      };

      const result = await createAccount(input);

      if (result.success) {
        setServerMessage({ type: "success", text: result.message });
        // Close sheet after short delay
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

  // Handle input changes
  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle currency input changes
  const handleCurrencyChange = (
    field: "balance" | "creditLimit",
    value: string
  ) => {
    const formatted = formatCurrencyInput(value);
    handleChange(field, formatted);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="size-4" />
            Tambah Akun
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tambah Akun Baru</SheetTitle>
          <SheetDescription>
            Buat akun keuangan baru untuk melacak saldo dan transaksi Anda.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-4 py-6">
          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Akun <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Contoh: BCA Utama, GoPay"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Tipe Akun <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.type}
              onValueChange={(value: string) => handleChange("type", value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Pilih tipe akun" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-red-500">{errors.type}</p>
            )}
            {form.type && (
              <p className="text-xs text-muted-foreground">
                {ACCOUNT_TYPES.find((t) => t.value === form.type)?.description}
              </p>
            )}
          </div>

          {/* Initial Balance */}
          <div className="space-y-2">
            <Label htmlFor="balance">
              Saldo Awal
              {isCredit && (
                <span className="text-xs text-muted-foreground ml-1">
                  (Gunakan nilai negatif untuk hutang)
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="balance"
                type="text"
                inputMode="numeric"
                placeholder="0"
                className="pl-10"
                value={form.balance}
                onChange={(e) =>
                  handleCurrencyChange("balance", e.target.value)
                }
                disabled={isSubmitting}
              />
            </div>
            {errors.balance && (
              <p className="text-xs text-red-500">{errors.balance}</p>
            )}
          </div>

          {/* Credit-specific fields */}
          {isCredit && (
            <div className="space-y-5 rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">
                Detail Kartu Kredit / Paylater
              </p>

              {/* Credit Limit */}
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Limit Kredit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="creditLimit"
                    type="text"
                    inputMode="numeric"
                    placeholder="10.000.000"
                    className="pl-10"
                    value={form.creditLimit}
                    onChange={(e) =>
                      handleCurrencyChange("creditLimit", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Statement Date */}
              <div className="space-y-2">
                <Label htmlFor="statementDate">Tanggal Cetak Tagihan</Label>
                <div className="relative">
                  <Input
                    id="statementDate"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="20"
                    value={form.statementDate}
                    onChange={(e) =>
                      handleChange("statementDate", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    setiap tanggal
                  </span>
                </div>
                {errors.statementDate && (
                  <p className="text-xs text-red-500">{errors.statementDate}</p>
                )}
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">Tanggal Jatuh Tempo</Label>
                <div className="relative">
                  <Input
                    id="dueDate"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="5"
                    value={form.dueDate}
                    onChange={(e) => handleChange("dueDate", e.target.value)}
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    setiap tanggal
                  </span>
                </div>
                {errors.dueDate && (
                  <p className="text-xs text-red-500">{errors.dueDate}</p>
                )}
              </div>
            </div>
          )}

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
              "Simpan Akun"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
