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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDebtForEdit,
  editDebt,
  type EditDebtInput,
} from "@/app/(private)/finance/edit-actions";
import { getUserContacts } from "@/app/(private)/finance/debt-actions";

// ========================
// TYPE DEFINITIONS
// ========================

interface EditDebtDialogProps {
  debtId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

// ========================
// MAIN COMPONENT
// ========================

export function EditDebtDialog({
  debtId,
  trigger,
  onSuccess,
}: EditDebtDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingData, setLoadingData] = React.useState(true);
  const [error, setError] = React.useState("");

  // Form state
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [debtType, setDebtType] = React.useState<"LENDING" | "BORROWING">(
    "LENDING",
  );

  // Data
  const [contacts, setContacts] = React.useState<
    { id: string; name: string }[]
  >([]);

  const loadDebtData = React.useCallback(async () => {
    try {
      setLoadingData(true);
      setError("");

      const [debtData, contactsData] = await Promise.all([
        getDebtForEdit(debtId),
        getUserContacts(),
      ]);

      if (!debtData) {
        setError("Data pinjaman tidak ditemukan");
        return;
      }

      setDebtType(debtData.type);
      setAmount(debtData.amount.toString());
      setDescription(debtData.description || "");
      setDueDate(debtData.dueDate ? debtData.dueDate.split("T")[0] : "");
      setContactId(debtData.contact.id);
      setContacts(contactsData);
    } catch (error) {
      console.error("Error loading debt:", error);
      setError("Gagal memuat data pinjaman");
    } finally {
      setLoadingData(false);
    }
  }, [debtId]);

  // Load debt data when sheet opens
  React.useEffect(() => {
    if (open) {
      loadDebtData();
    }
  }, [open, loadDebtData]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError("Jumlah harus lebih dari 0");
        return;
      }

      if (!contactId) {
        setError("Kontak wajib dipilih");
        return;
      }

      const input: EditDebtInput = {
        debtId,
        amount: amountNum,
        description: description.trim() || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        contactId,
      };

      const result = await editDebt(input);

      if (result.success) {
        setOpen(false);
        router.refresh();
        onSuccess?.();
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error("Error editing debt:", error);
      setError("Terjadi kesalahan saat mengedit pinjaman");
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
          <SheetTitle>
            Edit {debtType === "LENDING" ? "Piutang" : "Hutang"}
          </SheetTitle>
          <SheetDescription>
            Ubah detail pinjaman. Perubahan jumlah akan menyesuaikan sisa
            pinjaman.
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
            {/* Debt Type (Read-only) */}
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Input
                value={debtType === "LENDING" ? "Piutang" : "Hutang"}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Tipe pinjaman tidak dapat diubah
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <Label htmlFor="contact">
                Kontak <span className="text-destructive">*</span>
              </Label>
              <Select
                value={contactId}
                onValueChange={setContactId}
                disabled={loading}
              >
                <SelectTrigger id="contact">
                  <SelectValue placeholder="Pilih kontak" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <p className="text-xs text-muted-foreground">
                Mengubah jumlah akan menyesuaikan sisa pinjaman
              </p>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Jatuh Tempo</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Catatan</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tambahkan catatan untuk pinjaman ini"
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
