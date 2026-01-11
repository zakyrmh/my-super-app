"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
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
  createTransaction,
  getUserAccounts,
  getAccountTagBalances,
  type TransactionType,
  type CreateTransactionInput,
  type AccountOption,
} from "@/app/(private)/finance/actions";
import { type TagBalance } from "@/lib/finance/smart-allocation";

// ========================
// TYPE DEFINITIONS
// ========================

interface TransactionFormSheetProps {
  /** Optional trigger element, defaults to "Tambah Transaksi" button */
  trigger?: React.ReactNode;
}

/** Manual allocation entry for fund sources */
interface ManualAllocation {
  sourceTag: string;
  amount: number;
}

/** Expense item entry for itemized transactions */
interface ExpenseItem {
  id: string; // Temporary ID for UI
  name: string;
  price: string; // String for input, converted to number on submit
  qty: number;
  category: string;
}

interface FormState {
  type: TransactionType | "";
  amount: string;
  date: string;
  description: string;
  category: string;
  fromAccountId: string;
  toAccountId: string;
  isPersonal: boolean;
  flowTag: string;
  /** Manual fund allocations for EXPENSE/TRANSFER */
  allocations: ManualAllocation[];
  /** Whether this expense has itemized details */
  hasItems: boolean;
  /** Itemized expense entries */
  items: ExpenseItem[];
}

interface FormErrors {
  type?: string;
  amount?: string;
  date?: string;
  fromAccountId?: string;
  toAccountId?: string;
  allocations?: string;
  items?: string;
}

// ========================
// TRANSACTION TYPE OPTIONS
// ========================

const TRANSACTION_TYPES: {
  value: TransactionType;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
}[] = [
  {
    value: "INCOME",
    label: "Pemasukan",
    icon: ArrowDownLeft,
    description: "Uang masuk ke akun Anda",
    color: "text-emerald-500",
  },
  {
    value: "EXPENSE",
    label: "Pengeluaran",
    icon: ArrowUpRight,
    description: "Uang keluar dari akun Anda",
    color: "text-red-500",
  },
  {
    value: "TRANSFER",
    label: "Transfer",
    icon: ArrowRightLeft,
    description: "Pindah saldo antar akun",
    color: "text-blue-500",
  },
];

// ========================
// COMMON CATEGORIES
// ========================

const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan & Utilitas",
  "Hiburan",
  "Kesehatan",
  "Pendidikan",
  "Lainnya",
];

const INCOME_CATEGORIES = [
  "Gaji",
  "Bonus",
  "Investasi",
  "Hadiah",
  "Penjualan",
  "Lainnya",
];

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

function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Generates an automatic flowTag (Label Sumber Dana) for INCOME transactions.
 * Priority: Category > Description (first 2 words) > "Pemasukan"
 */
function generateFlowTag(category: string, description: string): string {
  // Priority 1: Use category if available
  if (category && category.trim() !== "") {
    return category.trim();
  }

  // Priority 2: Use first 2 meaningful words from description
  if (description && description.trim() !== "") {
    const words = description
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 2) // Filter out short words
      .slice(0, 2); // Take first 2 words

    if (words.length > 0) {
      // Capitalize first letter of each word
      return words
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    }
  }

  // Default fallback
  return "Pemasukan";
}

/**
 * Calculates waterfall allocation for auto-fill purposes.
 */
function calculateWaterfallAllocation(
  tagBalances: TagBalance[],
  amount: number
): ManualAllocation[] {
  if (amount <= 0 || tagBalances.length === 0) {
    return [];
  }

  const allocations: ManualAllocation[] = [];
  let remaining = amount;

  for (const tb of tagBalances) {
    if (remaining <= 0) break;
    const used = Math.min(tb.balance, remaining);
    if (used > 0) {
      allocations.push({ sourceTag: tb.tag, amount: used });
      remaining -= used;
    }
  }

  return allocations;
}

// ========================
// FUND ALLOCATION EDITOR COMPONENT
// ========================

interface FundAllocationEditorProps {
  tagBalances: TagBalance[];
  targetAmount: number;
  allocations: ManualAllocation[];
  onAllocationsChange: (allocations: ManualAllocation[]) => void;
  isLoading: boolean;
  disabled: boolean;
}

function FundAllocationEditor({
  tagBalances,
  targetAmount,
  allocations,
  onAllocationsChange,
  isLoading,
  disabled,
}: FundAllocationEditorProps) {
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const totalAvailable = tagBalances.reduce((sum, tb) => sum + tb.balance, 0);
  const difference = targetAmount - totalAllocated;
  const isExact = difference === 0;
  const isOver = difference < 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);

  // Get allocation amount for a specific tag
  const getAllocationAmount = (tag: string): number => {
    const alloc = allocations.find((a) => a.sourceTag === tag);
    return alloc?.amount || 0;
  };

  // Get remaining balance for a tag (original - allocated)
  const getRemainingBalance = (tag: string, balance: number): number => {
    return balance - getAllocationAmount(tag);
  };

  // Handle allocation change for a specific tag
  const handleAllocationChange = (tag: string, value: string) => {
    const numValue = parseInt(value.replace(/[^\d]/g, ""), 10) || 0;
    const tagBalance = tagBalances.find((tb) => tb.tag === tag)?.balance || 0;
    const clampedValue = Math.min(numValue, tagBalance); // Can't exceed tag balance

    const newAllocations = allocations.filter((a) => a.sourceTag !== tag);
    if (clampedValue > 0) {
      newAllocations.push({ sourceTag: tag, amount: clampedValue });
    }
    onAllocationsChange(newAllocations);
  };

  // Auto-fill using waterfall logic
  const handleAutoFill = () => {
    const autoAllocations = calculateWaterfallAllocation(
      tagBalances,
      targetAmount
    );
    onAllocationsChange(autoAllocations);
  };

  // Clear all allocations
  const handleClear = () => {
    onAllocationsChange([]);
  };

  if (isLoading) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Memuat sumber dana...</span>
        </div>
      </div>
    );
  }

  if (tagBalances.length === 0) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          ⚠️ Belum ada sumber dana di akun ini. Tambahkan pemasukan dengan label
          terlebih dahulu.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Pilih Sumber Dana:
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={disabled || targetAmount <= 0}
            className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Auto-fill
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || allocations.length === 0}
            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Fund source entries */}
      <div className="space-y-2">
        {tagBalances.map((tb, index) => {
          const allocatedAmount = getAllocationAmount(tb.tag);
          const remainingBalance = getRemainingBalance(tb.tag, tb.balance);
          const usagePercent =
            tb.balance > 0 ? (allocatedAmount / tb.balance) * 100 : 0;
          const isUsed = allocatedAmount > 0;

          return (
            <div
              key={tb.tag}
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
                  <span className="text-sm font-medium">{tb.tag}</span>
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
                      handleAllocationChange(tb.tag, e.target.value)
                    }
                    disabled={disabled}
                    className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleAllocationChange(tb.tag, String(tb.balance))
                  }
                  disabled={disabled}
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
                    Sisa setelah transaksi: {formatCurrency(remainingBalance)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
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
          <span className="text-muted-foreground">Total tersedia:</span>
          <span className="font-medium">{formatCurrency(totalAvailable)}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Jumlah transaksi:</span>
          <span className="font-medium">{formatCurrency(targetAmount)}</span>
        </div>
        <div className="border-t border-border/50 my-2" />
        <div className="flex justify-between text-sm">
          <span className="font-medium">Total dialokasikan:</span>
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
    </div>
  );
}

// ========================
// EXPENSE ITEMS EDITOR COMPONENT
// ========================

interface ExpenseItemsEditorProps {
  items: ExpenseItem[];
  onItemsChange: (items: ExpenseItem[]) => void;
  disabled: boolean;
}

function ExpenseItemsEditor({
  items,
  onItemsChange,
  disabled,
}: ExpenseItemsEditorProps) {
  // Generate unique ID for new items
  const generateId = () =>
    `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Add new item
  const handleAddItem = () => {
    onItemsChange([
      ...items,
      { id: generateId(), name: "", price: "", qty: 1, category: "" },
    ]);
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  // Update item field
  const handleItemChange = (
    id: string,
    field: keyof Omit<ExpenseItem, "id">,
    value: string | number
  ) => {
    onItemsChange(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Format price for display
  const formatPrice = (value: string): string => {
    const cleaned = value.replace(/[^\d]/g, "");
    const num = parseInt(cleaned, 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  // Calculate total from items
  const totalFromItems = items.reduce((sum, item) => {
    const price = parseInt(item.price.replace(/[^\d]/g, ""), 10) || 0;
    return sum + price * item.qty;
  }, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-3">
      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Item #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={disabled}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 disabled:opacity-50 transition-colors"
                  title="Hapus item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* Item Name */}
              <div>
                <input
                  type="text"
                  placeholder="Nama item (contoh: Indomie Goreng)"
                  value={item.name}
                  onChange={(e) =>
                    handleItemChange(item.id, "name", e.target.value)
                  }
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                />
              </div>

              {/* Price and Qty in a row */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Harga"
                    value={item.price}
                    onChange={(e) =>
                      handleItemChange(
                        item.id,
                        "price",
                        formatPrice(e.target.value)
                      )
                    }
                    disabled={disabled}
                    className="w-full pl-7 pr-2 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                  />
                </div>
                <div className="w-20">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "qty",
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      disabled={disabled}
                      className="w-full px-2 py-2 text-sm text-center rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      x
                    </span>
                  </div>
                </div>
              </div>

              {/* Category (optional) */}
              <input
                type="text"
                placeholder="Kategori item (opsional)"
                value={item.category}
                onChange={(e) =>
                  handleItemChange(item.id, "category", e.target.value)
                }
                disabled={disabled}
                className="w-full px-3 py-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              />

              {/* Item subtotal */}
              {item.price && (
                <p className="text-xs text-right text-muted-foreground">
                  Subtotal:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(
                      (parseInt(item.price.replace(/[^\d]/g, ""), 10) || 0) *
                        item.qty
                    )}
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add item button */}
      <button
        type="button"
        onClick={handleAddItem}
        disabled={disabled}
        className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="size-4" />
        Tambah Item
      </button>

      {/* Total from items */}
      {items.length > 0 && (
        <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Total dari {items.length} item:</span>
            <span className="font-bold text-primary">
              {formatCurrency(totalFromItems)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// MAIN COMPONENT
// ========================

export function TransactionFormSheet({ trigger }: TransactionFormSheetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);
  const [isLoadingTags, setIsLoadingTags] = React.useState(false);
  const [accounts, setAccounts] = React.useState<AccountOption[]>([]);
  const [tagBalances, setTagBalances] = React.useState<TagBalance[]>([]);
  const [serverMessage, setServerMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [form, setForm] = React.useState<FormState>({
    type: "",
    amount: "",
    date: getTodayDateString(),
    description: "",
    category: "",
    fromAccountId: "",
    toAccountId: "",
    isPersonal: true,
    flowTag: "",
    allocations: [],
    hasItems: false,
    items: [],
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  // Derived states
  const isIncome = form.type === "INCOME";
  const isExpense = form.type === "EXPENSE";
  const isTransfer = form.type === "TRANSFER";

  // Fetch accounts when sheet opens
  React.useEffect(() => {
    if (open) {
      setIsLoadingAccounts(true);
      getUserAccounts()
        .then((data) => {
          setAccounts(data);
        })
        .catch(() => {
          setAccounts([]);
        })
        .finally(() => {
          setIsLoadingAccounts(false);
        });
    }
  }, [open]);

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      setForm({
        type: "",
        amount: "",
        date: getTodayDateString(),
        description: "",
        category: "",
        fromAccountId: "",
        toAccountId: "",
        isPersonal: true,
        flowTag: "",
        allocations: [],
        hasItems: false,
        items: [],
      });
      setErrors({});
      setServerMessage(null);
      setTagBalances([]);
    }
  }, [open]);

  // Fetch tag balances when fromAccountId changes (for EXPENSE/TRANSFER)
  React.useEffect(() => {
    if (form.fromAccountId && (isExpense || isTransfer)) {
      setIsLoadingTags(true);
      getAccountTagBalances(form.fromAccountId)
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
    }
  }, [form.fromAccountId, isExpense, isTransfer]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.type) {
      newErrors.type = "Tipe transaksi wajib dipilih";
    }

    const amount = parseCurrencyInput(form.amount);
    if (!amount || amount <= 0) {
      newErrors.amount = "Jumlah harus lebih dari 0";
    }

    if (!form.date) {
      newErrors.date = "Tanggal wajib diisi";
    }

    // Validate accounts based on type
    if (isIncome && !form.toAccountId) {
      newErrors.toAccountId = "Akun tujuan wajib dipilih";
    }

    if (isExpense && !form.fromAccountId) {
      newErrors.fromAccountId = "Akun sumber wajib dipilih";
    }

    if (isTransfer) {
      if (!form.fromAccountId) {
        newErrors.fromAccountId = "Akun asal wajib dipilih";
      }
      if (!form.toAccountId) {
        newErrors.toAccountId = "Akun tujuan wajib dipilih";
      }
      if (form.fromAccountId && form.fromAccountId === form.toAccountId) {
        newErrors.toAccountId = "Akun asal dan tujuan tidak boleh sama";
      }
    }

    // Validate allocations for EXPENSE (must match transaction amount)
    if (isExpense && form.fromAccountId && tagBalances.length > 0) {
      const totalAllocated = form.allocations.reduce(
        (sum, a) => sum + a.amount,
        0
      );
      if (totalAllocated !== amount) {
        newErrors.allocations = `Total alokasi (Rp ${totalAllocated.toLocaleString(
          "id-ID"
        )}) harus sama dengan jumlah transaksi`;
      }
    }

    // Validate items for itemized EXPENSE
    if (isExpense && form.hasItems) {
      const validItems = form.items.filter(
        (item) => item.name.trim() !== "" && item.price !== ""
      );
      if (validItems.length === 0) {
        newErrors.items = "Minimal satu item harus diisi dengan nama dan harga";
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
      // Auto-generate flowTag for INCOME transactions
      const autoFlowTag =
        form.type === "INCOME"
          ? generateFlowTag(form.category, form.description)
          : null;

      const input: CreateTransactionInput = {
        type: form.type as TransactionType,
        amount: parseCurrencyInput(form.amount),
        date: form.date,
        description: form.description || null,
        category: form.category || null,
        fromAccountId: form.fromAccountId || null,
        toAccountId: form.toAccountId || null,
        isPersonal: form.isPersonal,
        flowTag: autoFlowTag,
        // Include manual allocations for EXPENSE transactions
        manualAllocations:
          form.type === "EXPENSE" && form.allocations.length > 0
            ? form.allocations
            : null,
        // Include itemized expense details
        items:
          form.type === "EXPENSE" && form.hasItems && form.items.length > 0
            ? form.items
                .filter((item) => item.name.trim() !== "" && item.price !== "")
                .map((item) => ({
                  name: item.name.trim(),
                  price: parseInt(item.price.replace(/[^\d]/g, ""), 10) || 0,
                  qty: item.qty,
                  category: item.category.trim() || null,
                }))
            : null,
      };

      const result = await createTransaction(input);

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
    // Clear error when user starts typing
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle currency input
  const handleAmountChange = (value: string) => {
    const formatted = formatCurrencyInput(value);
    handleChange("amount", formatted);
  };

  // Get categories based on transaction type
  const categoryOptions = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button className="w-full md:w-auto gap-2">
            <Plus className="size-4" />
            Tambah Transaksi
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tambah Transaksi</SheetTitle>
          <SheetDescription>
            Catat pemasukan, pengeluaran, atau transfer antar akun.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-4 py-6">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>
              Tipe Transaksi <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {TRANSACTION_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = form.type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      handleChange("type", type.value);
                      // Reset account selections when type changes
                      setForm((prev) => ({
                        ...prev,
                        type: type.value,
                        fromAccountId: "",
                        toAccountId: "",
                        category: "",
                      }));
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                    disabled={isSubmitting}
                  >
                    <Icon className={`size-5 ${type.color}`} />
                    <span className="text-xs font-medium">{type.label}</span>
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
              Jumlah <span className="text-red-500">*</span>
            </Label>

            {/* Itemized expense toggle - only for EXPENSE */}
            {isExpense && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-sm text-muted-foreground">
                  Rincian per item
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newHasItems = !form.hasItems;
                    setForm((prev) => ({
                      ...prev,
                      hasItems: newHasItems,
                      // If enabling items and no items yet, add first item
                      items:
                        newHasItems && prev.items.length === 0
                          ? [
                              {
                                id: `item-${Date.now()}`,
                                name: "",
                                price: "",
                                qty: 1,
                                category: "",
                              },
                            ]
                          : prev.items,
                      // Clear amount when switching to items mode
                      amount: newHasItems ? "" : prev.amount,
                    }));
                  }}
                  disabled={isSubmitting}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    form.hasItems ? "bg-primary" : "bg-muted"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.hasItems ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Amount input - show when NOT using items */}
            {(!isExpense || !form.hasItems) && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  className="pl-10 text-lg font-semibold"
                  value={form.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Expense Items Editor - show when using items */}
            {isExpense && form.hasItems && (
              <ExpenseItemsEditor
                items={form.items}
                onItemsChange={(items) => {
                  // Calculate total from items and update amount
                  const total = items.reduce((sum, item) => {
                    const price =
                      parseInt(item.price.replace(/[^\d]/g, ""), 10) || 0;
                    return sum + price * item.qty;
                  }, 0);
                  setForm((prev) => ({
                    ...prev,
                    items,
                    amount: total > 0 ? total.toLocaleString("id-ID") : "",
                  }));
                }}
                disabled={isSubmitting}
              />
            )}

            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount}</p>
            )}
            {errors.items && (
              <p className="text-xs text-red-500">{errors.items}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">
              Tanggal <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="date"
                type="date"
                className="pl-10"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {form.date && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(form.date), "EEEE, dd MMMM yyyy", {
                  locale: localeId,
                })}
              </p>
            )}
            {errors.date && (
              <p className="text-xs text-red-500">{errors.date}</p>
            )}
          </div>

          {/* From Account - Show for EXPENSE and TRANSFER */}
          {(isExpense || isTransfer) && (
            <div className="space-y-2">
              <Label htmlFor="fromAccountId">
                {isTransfer ? "Dari Akun" : "Akun Sumber"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.fromAccountId}
                onValueChange={(value: string) =>
                  handleChange("fromAccountId", value)
                }
                disabled={isSubmitting || isLoadingAccounts}
              >
                <SelectTrigger id="fromAccountId">
                  <SelectValue
                    placeholder={
                      isLoadingAccounts ? "Memuat..." : "Pilih akun sumber"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{account.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            minimumFractionDigits: 0,
                          }).format(account.balance)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fromAccountId && (
                <p className="text-xs text-red-500">{errors.fromAccountId}</p>
              )}

              {/* Fund Source Allocation Editor */}
              {form.fromAccountId && (
                <FundAllocationEditor
                  tagBalances={tagBalances}
                  targetAmount={parseCurrencyInput(form.amount)}
                  allocations={form.allocations}
                  onAllocationsChange={(allocations) =>
                    setForm((prev) => ({ ...prev, allocations }))
                  }
                  isLoading={isLoadingTags}
                  disabled={isSubmitting}
                />
              )}
              {errors.allocations && (
                <p className="text-xs text-red-500 mt-2">
                  {errors.allocations}
                </p>
              )}
            </div>
          )}

          {/* To Account - Show for INCOME and TRANSFER */}
          {(isIncome || isTransfer) && (
            <div className="space-y-2">
              <Label htmlFor="toAccountId">
                {isTransfer ? "Ke Akun" : "Akun Tujuan"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.toAccountId}
                onValueChange={(value: string) =>
                  handleChange("toAccountId", value)
                }
                disabled={isSubmitting || isLoadingAccounts}
              >
                <SelectTrigger id="toAccountId">
                  <SelectValue
                    placeholder={
                      isLoadingAccounts ? "Memuat..." : "Pilih akun tujuan"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((acc) => acc.id !== form.fromAccountId)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span>{account.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              minimumFractionDigits: 0,
                            }).format(account.balance)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.toAccountId && (
                <p className="text-xs text-red-500">{errors.toAccountId}</p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Input
              id="description"
              placeholder="Contoh: Makan siang di restoran"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Category - Only for INCOME and EXPENSE */}
          {(isIncome || isExpense) && (
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(value: string) =>
                  handleChange("category", value)
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Show auto-generated flowTag preview for INCOME */}
              {isIncome && (
                <p className="text-xs text-muted-foreground">
                  Label sumber dana:{" "}
                  <span className="font-medium text-primary">
                    {generateFlowTag(form.category, form.description)}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="mt-4 space-y-4">
            {/* Is Personal */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPersonal"
                checked={form.isPersonal}
                onChange={(e) => handleChange("isPersonal", e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-border"
              />
              <Label htmlFor="isPersonal" className="font-normal">
                Transaksi Pribadi
              </Label>
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
            disabled={isSubmitting || !form.type}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Menyimpan...
              </>
            ) : (
              "Simpan Transaksi"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
