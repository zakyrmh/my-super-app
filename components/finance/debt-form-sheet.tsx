"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  HandCoins,
  Handshake,
  Calendar as CalendarIcon,
  UserPlus,
  Search,
  Check,
  Wallet,
  Landmark,
  Banknote,
  TrendingUp,
  CreditCard,
  Sparkles,
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
  createDebt,
  getUserContacts,
  getUserAccountsForDebt,
  getAccountTagBalancesForDebt,
  type DebtType,
  type ContactOption,
  type AccountOption,
  type DebtFundAllocation,
} from "@/app/(private)/finance/debt-actions";
import { type TagBalance } from "@/lib/finance/smart-allocation";

// ========================
// TYPE DEFINITIONS
// ========================

interface DebtFormSheetProps {
  /** Optional trigger element */
  trigger?: React.ReactNode;
}

interface FormState {
  type: DebtType | "";
  amount: string;
  accountId: string;
  contactId: string;
  contactName: string; // For new contact
  description: string;
  date: string; // Loan date
  dueDate: string;
  isNewContact: boolean;
  /** Fund allocations for LENDING (tracks which tag money comes from) */
  allocations: DebtFundAllocation[];
  /** Funding source name for BORROWING (semi-automatic) */
  fundingSourceName: string;
  fundingSourceEdited: boolean; // Track if user manually edited the name
}

interface FormErrors {
  type?: string;
  amount?: string;
  account?: string;
  contact?: string;
  dueDate?: string;
  allocations?: string;
}

// ========================
// DEBT TYPE OPTIONS
// ========================

const DEBT_TYPES: {
  value: DebtType;
  label: string;
  description: string;
  accountLabel: string;
  accountHint: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: "LENDING",
    label: "Piutang",
    description: "Teman pinjam uang ke saya",
    accountLabel: "Akun Sumber",
    accountHint: "Uang akan dikeluarkan dari akun ini",
    icon: HandCoins,
    color: "text-emerald-500",
  },
  {
    value: "BORROWING",
    label: "Hutang",
    description: "Saya pinjam uang ke teman",
    accountLabel: "Akun Tujuan",
    accountHint: "Uang akan masuk ke akun ini",
    icon: Handshake,
    color: "text-orange-500",
  },
];

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

// ========================
// MAIN COMPONENT
// ========================

export function DebtFormSheet({ trigger }: DebtFormSheetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [contacts, setContacts] = React.useState<ContactOption[]>([]);
  const [accounts, setAccounts] = React.useState<AccountOption[]>([]);
  const [tagBalances, setTagBalances] = React.useState<TagBalance[]>([]);
  const [isLoadingTags, setIsLoadingTags] = React.useState(false);
  const [contactSearch, setContactSearch] = React.useState("");
  const [showContactDropdown, setShowContactDropdown] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [form, setForm] = React.useState<FormState>({
    type: "",
    amount: "",
    accountId: "",
    contactId: "",
    contactName: "",
    description: "",
    date: getTodayDateString(),
    dueDate: "",
    isNewContact: false,
    allocations: [],
    fundingSourceName: "",
    fundingSourceEdited: false,
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  // Load contacts and accounts when sheet opens
  React.useEffect(() => {
    if (open) {
      setIsLoadingData(true);
      Promise.all([getUserContacts(), getUserAccountsForDebt()])
        .then(([contactsData, accountsData]) => {
          setContacts(contactsData);
          setAccounts(accountsData);
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [open]);

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      setForm({
        type: "",
        amount: "",
        accountId: "",
        contactId: "",
        contactName: "",
        description: "",
        date: getTodayDateString(),
        dueDate: "",
        isNewContact: false,
        allocations: [],
        fundingSourceName: "",
        fundingSourceEdited: false,
      });
      setErrors({});
      setServerMessage(null);
      setContactSearch("");
      setShowContactDropdown(false);
      setTagBalances([]);
    }
  }, [open]);

  // Fetch tag balances when account changes and type is LENDING
  const isLending = form.type === "LENDING";
  React.useEffect(() => {
    if (form.accountId && isLending) {
      setIsLoadingTags(true);
      getAccountTagBalancesForDebt(form.accountId)
        .then((data) => {
          setTagBalances(data);
        })
        .catch(() => {
          setTagBalances([]);
        })
        .finally(() => {
          setIsLoadingTags(false);
        });
    } else {
      setTagBalances([]);
      // Reset allocations when not LENDING
      if (!isLending) {
        setForm((prev) => ({ ...prev, allocations: [] }));
      }
    }
  }, [form.accountId, isLending]);

  // Auto-generate funding source name for BORROWING
  const isBorrowing = form.type === "BORROWING";
  React.useEffect(() => {
    if (isBorrowing && !form.fundingSourceEdited) {
      const contactName = form.isNewContact
        ? form.contactName
        : contacts.find((c) => c.id === form.contactId)?.name || "";
      if (contactName) {
        setForm((prev) => ({
          ...prev,
          fundingSourceName: `Pinjaman: ${contactName}`,
        }));
      }
    }
  }, [
    isBorrowing,
    form.contactId,
    form.contactName,
    form.isNewContact,
    form.fundingSourceEdited,
    contacts,
  ]);

  // Get current debt type config
  const currentTypeConfig = DEBT_TYPES.find((t) => t.value === form.type);

  // Get selected account
  const selectedAccount = accounts.find((a) => a.id === form.accountId);

  // Filtered contacts based on search
  const filteredContacts = React.useMemo(() => {
    if (!contactSearch) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()),
    );
  }, [contacts, contactSearch]);

  // Check if search term matches any existing contact
  const isNewContactName = React.useMemo(() => {
    if (!contactSearch) return false;
    return !contacts.some(
      (c) => c.name.toLowerCase() === contactSearch.toLowerCase(),
    );
  }, [contacts, contactSearch]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.type) {
      newErrors.type = "Tipe pinjaman wajib dipilih";
    }

    const amount = parseCurrencyInput(form.amount);
    if (!form.amount || amount <= 0) {
      newErrors.amount = "Jumlah pinjaman wajib diisi";
    }

    if (!form.accountId) {
      newErrors.account = "Akun wajib dipilih";
    }

    // Check balance for LENDING
    if (form.type === "LENDING" && form.accountId) {
      const account = accounts.find((a) => a.id === form.accountId);
      if (account && amount > account.balance) {
        newErrors.amount = `Saldo tidak cukup. Tersedia: ${formatCurrency(
          account.balance,
        )}`;
      }

      // Validate allocations for LENDING if tag balances exist
      if (tagBalances.length > 0) {
        const totalAllocated = form.allocations.reduce(
          (sum, a) => sum + a.amount,
          0,
        );
        if (totalAllocated !== amount) {
          newErrors.allocations = `Total alokasi (Rp ${totalAllocated.toLocaleString(
            "id-ID",
          )}) harus sama dengan jumlah pinjaman`;
        }
      }
    }

    if (!form.contactId && !form.contactName) {
      newErrors.contact = "Kontak wajib dipilih atau diisi";
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
      const result = await createDebt({
        type: form.type as DebtType,
        amount: parseCurrencyInput(form.amount),
        accountId: form.accountId,
        contactId: form.isNewContact ? null : form.contactId || null,
        contactName: form.isNewContact ? form.contactName : null,
        description: form.description || null,
        date: form.date || null,
        dueDate: form.dueDate || null,
        // Include allocations for LENDING if tag balances exist
        allocations:
          isLending && tagBalances.length > 0 && form.allocations.length > 0
            ? form.allocations
            : null,
        // Include funding source name for BORROWING
        fundingSourceName: isBorrowing ? form.fundingSourceName || null : null,
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

  // Handle input changes
  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear related error
    if (field === "type" && errors.type) {
      setErrors((prev) => ({ ...prev, type: undefined }));
    }
    if (field === "amount" && errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
    if (field === "accountId" && errors.account) {
      setErrors((prev) => ({ ...prev, account: undefined }));
    }
    if ((field === "contactId" || field === "contactName") && errors.contact) {
      setErrors((prev) => ({ ...prev, contact: undefined }));
    }
  };

  // Handle contact selection
  const handleSelectContact = (contact: ContactOption) => {
    setForm((prev) => ({
      ...prev,
      contactId: contact.id,
      contactName: contact.name,
      isNewContact: false,
    }));
    setContactSearch(contact.name);
    setShowContactDropdown(false);
    if (errors.contact) {
      setErrors((prev) => ({ ...prev, contact: undefined }));
    }
  };

  // Handle create new contact
  const handleCreateNewContact = () => {
    setForm((prev) => ({
      ...prev,
      contactId: "",
      contactName: contactSearch.trim(),
      isNewContact: true,
    }));
    setShowContactDropdown(false);
    if (errors.contact) {
      setErrors((prev) => ({ ...prev, contact: undefined }));
    }
  };

  // Get selected contact display
  const getContactDisplay = () => {
    if (form.isNewContact && form.contactName) {
      return `${form.contactName} (baru)`;
    }
    if (form.contactId) {
      const contact = contacts.find((c) => c.id === form.contactId);
      return contact?.name || "";
    }
    return "";
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <HandCoins className="size-4" />
            Hutang/Piutang
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Catat Pinjaman</SheetTitle>
          <SheetDescription>
            Catat hutang atau piutang dengan teman/keluarga.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-4 py-6">
          {/* Debt Type Selection */}
          <div className="space-y-3">
            <Label>
              Tipe Pinjaman <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {DEBT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = form.type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleChange("type", type.value)}
                    disabled={isSubmitting}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center size-10 rounded-full ${
                        isSelected ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <Icon
                        className={`size-5 ${
                          isSelected ? type.color : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-sm font-medium ${
                          isSelected
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {type.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.type && (
              <p className="text-xs text-red-500">{errors.type}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Jumlah Pinjaman <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                className="pl-10"
                value={form.amount}
                onChange={(e) =>
                  handleChange("amount", formatCurrencyInput(e.target.value))
                }
                disabled={isSubmitting}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Account Selection - Only show if type is selected */}
          {form.type && (
            <div className="space-y-2">
              <Label htmlFor="account">
                {currentTypeConfig?.accountLabel}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.accountId}
                onValueChange={(value) => handleChange("accountId", value)}
                disabled={isSubmitting || isLoadingData}
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Pilih akun..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.length === 0 ? (
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
              <p className="text-xs text-muted-foreground">
                {currentTypeConfig?.accountHint}
              </p>
              {selectedAccount && (
                <p
                  className={`text-xs ${
                    form.type === "LENDING"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {form.type === "LENDING"
                    ? `Saldo akan berkurang: ${formatCurrency(
                        selectedAccount.balance,
                      )} → ${formatCurrency(
                        selectedAccount.balance -
                          parseCurrencyInput(form.amount),
                      )}`
                    : `Saldo akan bertambah: ${formatCurrency(
                        selectedAccount.balance,
                      )} → ${formatCurrency(
                        selectedAccount.balance +
                          parseCurrencyInput(form.amount),
                      )}`}
                </p>
              )}
              {errors.account && (
                <p className="text-xs text-red-500">{errors.account}</p>
              )}

              {/* Fund Allocation Editor for LENDING */}
              {isLending && form.accountId && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Pilih Sumber Dana:
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          // Auto-fill using waterfall logic
                          const amount = parseCurrencyInput(form.amount);
                          if (amount <= 0 || tagBalances.length === 0) return;
                          const allocations: DebtFundAllocation[] = [];
                          let remaining = amount;
                          for (const tb of tagBalances) {
                            if (remaining <= 0) break;
                            const used = Math.min(tb.balance, remaining);
                            if (used > 0) {
                              allocations.push({
                                fundingSourceId: tb.fundingSourceId,
                                amount: used,
                              });
                              remaining -= used;
                            }
                          }
                          setForm((prev) => ({ ...prev, allocations }));
                        }}
                        disabled={
                          isSubmitting || parseCurrencyInput(form.amount) <= 0
                        }
                        className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Auto-fill
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, allocations: [] }))
                        }
                        disabled={isSubmitting || form.allocations.length === 0}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {isLoadingTags ? (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        <span>Memuat sumber dana...</span>
                      </div>
                    </div>
                  ) : tagBalances.length === 0 ? (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        ⚠️ Belum ada sumber dana di akun ini. Tambahkan
                        pemasukan dengan label terlebih dahulu.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tagBalances.map((tb, index) => {
                        const allocatedAmount =
                          form.allocations.find(
                            (a) => a.fundingSourceId === tb.fundingSourceId,
                          )?.amount || 0;
                        const remainingBalance = tb.balance - allocatedAmount;
                        const usagePercent =
                          tb.balance > 0
                            ? (allocatedAmount / tb.balance) * 100
                            : 0;
                        const isUsed = allocatedAmount > 0;

                        const handleAllocationChange = (value: string) => {
                          const numValue =
                            parseInt(value.replace(/[^\d]/g, ""), 10) || 0;
                          const clampedValue = Math.min(numValue, tb.balance);
                          const newAllocations = form.allocations.filter(
                            (a) => a.fundingSourceId !== tb.fundingSourceId,
                          );
                          if (clampedValue > 0) {
                            newAllocations.push({
                              fundingSourceId: tb.fundingSourceId,
                              amount: clampedValue,
                            });
                          }
                          setForm((prev) => ({
                            ...prev,
                            allocations: newAllocations,
                          }));
                        };

                        return (
                          <div
                            key={tb.fundingSourceId}
                            className={`p-3 rounded-lg border transition-colors ${
                              isUsed
                                ? "bg-primary/5 border-primary/30"
                                : "bg-muted/30 border-border/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                    isUsed
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  #{index + 1}
                                </span>
                                <span className="text-sm font-medium">
                                  {tb.tagName}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Saldo: {formatCurrency(tb.balance)}
                              </span>
                            </div>

                            {/* Amount input */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  Rp
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={
                                    allocatedAmount > 0
                                      ? allocatedAmount.toLocaleString("id-ID")
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleAllocationChange(e.target.value)
                                  }
                                  disabled={isSubmitting}
                                  className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAllocationChange(String(tb.balance))
                                }
                                disabled={isSubmitting}
                                className="text-xs px-2 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                                title="Gunakan semua saldo"
                              >
                                Max
                              </button>
                            </div>

                            {/* Progress bar */}
                            {isUsed && (
                              <div className="mt-2">
                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${usagePercent}%` }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Sisa setelah transaksi:{" "}
                                  {formatCurrency(remainingBalance)}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Summary */}
                      {(() => {
                        const targetAmount = parseCurrencyInput(form.amount);
                        const totalAllocated = form.allocations.reduce(
                          (sum, a) => sum + a.amount,
                          0,
                        );
                        const totalAvailable = tagBalances.reduce(
                          (sum, tb) => sum + tb.balance,
                          0,
                        );
                        const difference = targetAmount - totalAllocated;
                        const isExact = difference === 0;
                        const isOver = difference < 0;

                        return (
                          <div
                            className={`p-3 rounded-lg border ${
                              isOver
                                ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                                : isExact
                                  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                                  : "bg-muted/30 border-border/50"
                            }`}
                          >
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Total tersedia:
                              </span>
                              <span className="font-medium">
                                {formatCurrency(totalAvailable)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Jumlah pinjaman:
                              </span>
                              <span className="font-medium">
                                {formatCurrency(targetAmount)}
                              </span>
                            </div>
                            <div className="border-t border-border/50 my-2" />
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">
                                Total dialokasikan:
                              </span>
                              <span
                                className={`font-bold ${
                                  isExact
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : isOver
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {formatCurrency(totalAllocated)}
                              </span>
                            </div>
                            {!isExact && targetAmount > 0 && (
                              <p
                                className={`text-xs mt-1 ${
                                  isOver
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {isOver
                                  ? `⚠️ Kelebihan ${formatCurrency(Math.abs(difference))}`
                                  : `⚠️ Kurang ${formatCurrency(difference)}`}
                              </p>
                            )}
                            {isExact && targetAmount > 0 && (
                              <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">
                                ✓ Alokasi sudah pas!
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {errors.allocations && (
                    <p className="text-xs text-red-500">{errors.allocations}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contact Selection */}
          <div className="space-y-2">
            <Label htmlFor="contact">
              {form.type === "LENDING" ? "Peminjam" : "Pemberi Pinjaman"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="contact"
                  type="text"
                  placeholder="Cari atau tambah kontak..."
                  className="pl-9"
                  value={contactSearch || getContactDisplay()}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                    // Clear selection when typing
                    if (form.contactId || form.isNewContact) {
                      setForm((prev) => ({
                        ...prev,
                        contactId: "",
                        contactName: "",
                        isNewContact: false,
                      }));
                    }
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Contact Dropdown */}
              {showContactDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                  <div className="max-h-48 overflow-y-auto p-1">
                    {isLoadingData ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => handleSelectContact(contact)}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <div className="flex items-center justify-center size-6 rounded-full bg-muted">
                              <span className="text-xs font-medium text-muted-foreground">
                                {contact.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span>{contact.name}</span>
                            {form.contactId === contact.id && (
                              <Check className="ml-auto size-4 text-primary" />
                            )}
                          </button>
                        ))}

                        {/* Create New Contact Option */}
                        {contactSearch && isNewContactName && (
                          <button
                            type="button"
                            onClick={handleCreateNewContact}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
                          >
                            <div className="flex items-center justify-center size-6 rounded-full bg-primary/10">
                              <UserPlus className="size-3 text-primary" />
                            </div>
                            <span>
                              Tambah &quot;{contactSearch.trim()}&quot;
                            </span>
                          </button>
                        )}

                        {filteredContacts.length === 0 && !contactSearch && (
                          <p className="py-3 text-center text-sm text-muted-foreground">
                            Belum ada kontak tersimpan
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Contact Badge */}
            {(form.contactId || form.isNewContact) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Dipilih:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    form.isNewContact
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {form.isNewContact && <Plus className="size-3" />}
                  {getContactDisplay()}
                </span>
              </div>
            )}

            {errors.contact && (
              <p className="text-xs text-red-500">{errors.contact}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Catatan (Opsional)</Label>
            <Input
              id="description"
              placeholder="Contoh: Untuk bayar kos"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Loan Date */}
          <div className="space-y-2">
            <Label htmlFor="date">
              Tanggal Pinjaman <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="date"
                type="date"
                className="pl-9"
                max={getTodayDateString()}
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Funding Source Name (BORROWING Only) */}
          {isBorrowing && (
            <div className="space-y-2 p-3 border rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5">
              <Label htmlFor="fundingSourceName">
                Nama Sumber Dana{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (misal: Pinjaman Keluarga, Pinjaman Teman)
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="fundingSourceName"
                  value={form.fundingSourceName}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      fundingSourceName: e.target.value,
                      fundingSourceEdited: true, // Mark as manually edited
                    }));
                  }}
                  placeholder="Contoh: Pinjaman Keluarga"
                  disabled={isSubmitting}
                  className="bg-background"
                />
                {!form.fundingSourceEdited && form.fundingSourceName && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground italic flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" /> Auto
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Label ini akan digunakan untuk melacak sisa dana dari pinjaman
                ini.
              </p>
            </div>
          )}

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Jatuh Tempo (Opsional)</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="dueDate"
                type="date"
                className="pl-9"
                min={getTodayDateString()}
                value={form.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
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
              "Simpan Pinjaman"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
