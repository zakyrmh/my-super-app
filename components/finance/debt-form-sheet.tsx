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
  type DebtType,
  type ContactOption,
  type AccountOption,
} from "@/app/(private)/finance/debt-actions";

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
  dueDate: string;
  isNewContact: boolean;
}

interface FormErrors {
  type?: string;
  amount?: string;
  account?: string;
  contact?: string;
  dueDate?: string;
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
    dueDate: "",
    isNewContact: false,
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
        dueDate: "",
        isNewContact: false,
      });
      setErrors({});
      setServerMessage(null);
      setContactSearch("");
      setShowContactDropdown(false);
    }
  }, [open]);

  // Get current debt type config
  const currentTypeConfig = DEBT_TYPES.find((t) => t.value === form.type);

  // Get selected account
  const selectedAccount = accounts.find((a) => a.id === form.accountId);

  // Filtered contacts based on search
  const filteredContacts = React.useMemo(() => {
    if (!contactSearch) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase())
    );
  }, [contacts, contactSearch]);

  // Check if search term matches any existing contact
  const isNewContactName = React.useMemo(() => {
    if (!contactSearch) return false;
    return !contacts.some(
      (c) => c.name.toLowerCase() === contactSearch.toLowerCase()
    );
  }, [contacts, contactSearch]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.type) {
      newErrors.type = "Tipe pinjaman wajib dipilih";
    }

    if (!form.amount || parseCurrencyInput(form.amount) <= 0) {
      newErrors.amount = "Jumlah pinjaman wajib diisi";
    }

    if (!form.accountId) {
      newErrors.account = "Akun wajib dipilih";
    }

    // Check balance for LENDING
    if (form.type === "LENDING" && form.accountId) {
      const account = accounts.find((a) => a.id === form.accountId);
      const amount = parseCurrencyInput(form.amount);
      if (account && amount > account.balance) {
        newErrors.amount = `Saldo tidak cukup. Tersedia: ${formatCurrency(
          account.balance
        )}`;
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
        dueDate: form.dueDate || null,
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
                        selectedAccount.balance
                      )} → ${formatCurrency(
                        selectedAccount.balance -
                          parseCurrencyInput(form.amount)
                      )}`
                    : `Saldo akan bertambah: ${formatCurrency(
                        selectedAccount.balance
                      )} → ${formatCurrency(
                        selectedAccount.balance +
                          parseCurrencyInput(form.amount)
                      )}`}
                </p>
              )}
              {errors.account && (
                <p className="text-xs text-red-500">{errors.account}</p>
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
