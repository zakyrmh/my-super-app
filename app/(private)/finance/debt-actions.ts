"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

// ========================
// TYPE DEFINITIONS
// ========================

/** Debt type enum matching Prisma schema */
export type DebtType = "LENDING" | "BORROWING";

/** Account option for Select dropdown */
export interface AccountOption {
  id: string;
  name: string;
  type: string;
  balance: number;
}

/** Contact option for Select dropdown */
export interface ContactOption {
  id: string;
  name: string;
}

/** Input data for creating a new contact */
export interface CreateContactInput {
  name: string;
}

/** Input data for creating a new debt */
export interface CreateDebtInput {
  type: DebtType;
  amount: number;
  accountId: string; // Required: account to debit/credit
  contactId?: string | null;
  contactName?: string | null; // For creating new contact on-the-fly
  description?: string | null;
  dueDate?: string | null; // ISO date string
}

/** Input data for recording a payment */
export interface RecordPaymentInput {
  debtId: string;
  amount: number;
  accountId: string; // Required: account to debit/credit
  description?: string | null;
}

/** Debt with contact info for display */
export interface DebtWithContact {
  id: string;
  type: DebtType;
  amount: number;
  remaining: number;
  description: string | null;
  dueDate: Date | null;
  isPaid: boolean;
  createdAt: Date;
  contact: {
    id: string;
    name: string;
  };
}

/** Response type for debt actions */
export interface DebtActionResponse {
  success: boolean;
  message: string;
  debtId?: string;
}

/** Summary of active debts */
export interface DebtSummary {
  totalLending: number; // Total piutang (uang yang dipinjamkan)
  totalBorrowing: number; // Total hutang (uang yang dipinjam)
  activeLendingCount: number;
  activeBorrowingCount: number;
}

// ========================
// GET USER ACCOUNTS ACTION
// ========================

export async function getUserAccountsForDebt(): Promise<AccountOption[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
      },
      orderBy: { name: "asc" },
    });

    return accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: Number(acc.balance),
    }));
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
}

// ========================
// GET USER CONTACTS ACTION
// ========================

export async function getUserContacts(): Promise<ContactOption[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const contacts = await prisma.contact.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return contacts;
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }
}

// ========================
// CREATE CONTACT ACTION
// ========================

export async function createContact(
  input: CreateContactInput
): Promise<{ success: boolean; message: string; contactId?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    if (!input.name || input.name.trim() === "") {
      return {
        success: false,
        message: "Nama kontak wajib diisi.",
      };
    }

    // Check for duplicate contact name
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId: user.id,
        name: { equals: input.name.trim(), mode: "insensitive" },
      },
    });

    if (existingContact) {
      return {
        success: false,
        message: "Kontak dengan nama ini sudah ada.",
      };
    }

    const contact = await prisma.contact.create({
      data: {
        name: input.name.trim(),
        userId: user.id,
      },
    });

    return {
      success: true,
      message: `Kontak "${contact.name}" berhasil dibuat!`,
      contactId: contact.id,
    };
  } catch (error) {
    console.error("Error creating contact:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat membuat kontak.",
    };
  }
}

// ========================
// GET USER DEBTS ACTION
// ========================

export async function getUserDebts(): Promise<DebtWithContact[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const debts = await prisma.debt.findMany({
      where: {
        userId: user.id,
        isPaid: false, // Only active debts
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return debts.map((debt) => ({
      id: debt.id,
      type: debt.type as DebtType,
      amount: Number(debt.amount),
      remaining: Number(debt.remaining),
      description: debt.description,
      dueDate: debt.dueDate,
      isPaid: debt.isPaid,
      createdAt: debt.createdAt,
      contact: debt.contact,
    }));
  } catch (error) {
    console.error("Error fetching debts:", error);
    return [];
  }
}

// ========================
// GET DEBT SUMMARY ACTION
// ========================

export async function getDebtSummary(): Promise<DebtSummary> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        totalLending: 0,
        totalBorrowing: 0,
        activeLendingCount: 0,
        activeBorrowingCount: 0,
      };
    }

    // Get all active debts grouped by type
    const [lendingDebts, borrowingDebts] = await Promise.all([
      prisma.debt.findMany({
        where: { userId: user.id, isPaid: false, type: "LENDING" },
        select: { remaining: true },
      }),
      prisma.debt.findMany({
        where: { userId: user.id, isPaid: false, type: "BORROWING" },
        select: { remaining: true },
      }),
    ]);

    const totalLending = lendingDebts.reduce(
      (sum, d) => sum + Number(d.remaining),
      0
    );
    const totalBorrowing = borrowingDebts.reduce(
      (sum, d) => sum + Number(d.remaining),
      0
    );

    return {
      totalLending,
      totalBorrowing,
      activeLendingCount: lendingDebts.length,
      activeBorrowingCount: borrowingDebts.length,
    };
  } catch (error) {
    console.error("Error fetching debt summary:", error);
    return {
      totalLending: 0,
      totalBorrowing: 0,
      activeLendingCount: 0,
      activeBorrowingCount: 0,
    };
  }
}

// ========================
// CREATE DEBT ACTION
// ========================

/**
 * Create a new debt record with account integration.
 *
 * LENDING (Piutang - teman pinjam uang ke saya):
 * - Saldo akun BERKURANG (uang keluar ke teman)
 * - Tidak tercatat sebagai transaksi pengeluaran
 *
 * BORROWING (Hutang - saya pinjam uang ke teman):
 * - Saldo akun BERTAMBAH (uang masuk dari teman)
 * - Membuat flowTag baru untuk tracking sumber dana
 * - Tidak tercatat sebagai transaksi pemasukan
 */
export async function createDebt(
  input: CreateDebtInput
): Promise<DebtActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    // Validate required fields
    if (!input.type) {
      return {
        success: false,
        message: "Tipe pinjaman wajib dipilih.",
      };
    }

    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        message: "Jumlah pinjaman harus lebih dari 0.",
      };
    }

    if (!input.accountId) {
      return {
        success: false,
        message: "Akun wajib dipilih.",
      };
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, userId: user.id },
    });

    if (!account) {
      return {
        success: false,
        message: "Akun tidak ditemukan.",
      };
    }

    // For LENDING, check if account has sufficient balance
    if (input.type === "LENDING") {
      const currentBalance = Number(account.balance);
      if (currentBalance < input.amount) {
        return {
          success: false,
          message: `Saldo akun tidak mencukupi. Saldo saat ini: Rp ${currentBalance.toLocaleString(
            "id-ID"
          )}`,
        };
      }
    }

    // Resolve contact: use existing or create new
    let contactId: string;
    let contactName: string;

    if (input.contactId) {
      // Verify contact belongs to user
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, userId: user.id },
      });
      if (!contact) {
        return {
          success: false,
          message: "Kontak tidak ditemukan.",
        };
      }
      contactId = contact.id;
      contactName = contact.name;
    } else if (input.contactName) {
      // Create new contact or find existing
      const existingContact = await prisma.contact.findFirst({
        where: {
          userId: user.id,
          name: { equals: input.contactName.trim(), mode: "insensitive" },
        },
      });

      if (existingContact) {
        contactId = existingContact.id;
        contactName = existingContact.name;
      } else {
        const newContact = await prisma.contact.create({
          data: {
            name: input.contactName.trim(),
            userId: user.id,
          },
        });
        contactId = newContact.id;
        contactName = newContact.name;
      }
    } else {
      return {
        success: false,
        message: "Kontak wajib dipilih atau diisi.",
      };
    }

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create the debt
      const debt = await tx.debt.create({
        data: {
          type: input.type,
          amount: input.amount,
          remaining: input.amount,
          description: input.description?.trim() || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          userId: user.id,
          contactId,
        },
      });

      // Update account balance based on debt type
      if (input.type === "LENDING") {
        // PIUTANG: Uang keluar dari akun (dipinjamkan ke teman)
        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: { decrement: input.amount } },
        });
      } else {
        // HUTANG: Uang masuk ke akun (dipinjam dari teman)
        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: { increment: input.amount } },
        });

        // Create a "virtual" INCOME transaction with flowTag for fund tracking
        // This helps with the smart allocation system
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "INCOME",
            amount: input.amount,
            date: new Date(),
            description: `Pinjaman dari ${contactName}`,
            toAccountId: input.accountId,
            isPersonal: true,
            flowTag: `Pinjaman: ${contactName}`, // Special tag for borrowed money
          },
        });
      }

      return debt;
    });

    revalidatePath("/finance");

    const typeLabel = input.type === "LENDING" ? "Piutang" : "Hutang";
    const actionLabel =
      input.type === "LENDING"
        ? `Uang keluar dari ${account.name}`
        : `Uang masuk ke ${account.name}`;

    return {
      success: true,
      message: `${typeLabel} ke ${contactName} berhasil dicatat! ${actionLabel}.`,
      debtId: result.id,
    };
  } catch (error) {
    console.error("Error creating debt:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat mencatat pinjaman.",
    };
  }
}

// ========================
// RECORD PAYMENT ACTION
// ========================

/**
 * Record a payment for an existing debt with account integration.
 *
 * LENDING payment (Teman mengembalikan uang):
 * - Saldo akun BERTAMBAH (uang masuk dari teman)
 * - Membuat flowTag baru untuk tracking sumber dana
 * - Tidak tercatat sebagai transaksi pemasukan reguler
 *
 * BORROWING payment (Saya mengembalikan uang):
 * - Saldo akun BERKURANG (uang keluar ke teman)
 * - Tidak tercatat sebagai transaksi pengeluaran
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<DebtActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    // Validate required fields
    if (!input.debtId) {
      return {
        success: false,
        message: "ID pinjaman wajib diisi.",
      };
    }

    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        message: "Jumlah pembayaran harus lebih dari 0.",
      };
    }

    if (!input.accountId) {
      return {
        success: false,
        message: "Akun wajib dipilih.",
      };
    }

    // Get the debt and verify ownership
    const debt = await prisma.debt.findFirst({
      where: { id: input.debtId, userId: user.id },
      include: { contact: { select: { name: true } } },
    });

    if (!debt) {
      return {
        success: false,
        message: "Pinjaman tidak ditemukan.",
      };
    }

    if (debt.isPaid) {
      return {
        success: false,
        message: "Pinjaman ini sudah lunas.",
      };
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, userId: user.id },
    });

    if (!account) {
      return {
        success: false,
        message: "Akun tidak ditemukan.",
      };
    }

    const currentRemaining = Number(debt.remaining);
    if (input.amount > currentRemaining) {
      return {
        success: false,
        message: `Jumlah pembayaran melebihi sisa pinjaman (Rp ${currentRemaining.toLocaleString(
          "id-ID"
        )}).`,
      };
    }

    // For BORROWING payment, check if account has sufficient balance
    if (debt.type === "BORROWING") {
      const currentBalance = Number(account.balance);
      if (currentBalance < input.amount) {
        return {
          success: false,
          message: `Saldo akun tidak mencukupi. Saldo saat ini: Rp ${currentBalance.toLocaleString(
            "id-ID"
          )}`,
        };
      }
    }

    // Calculate new remaining amount
    const newRemaining = currentRemaining - input.amount;
    const isNowPaid = newRemaining <= 0;

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Update the debt
      await tx.debt.update({
        where: { id: input.debtId },
        data: {
          remaining: newRemaining,
          isPaid: isNowPaid,
        },
      });

      // Update account balance based on debt type
      if (debt.type === "LENDING") {
        // PIUTANG payment: Uang masuk ke akun (teman mengembalikan)
        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: { increment: input.amount } },
        });

        // Create a "virtual" INCOME transaction with flowTag for fund tracking
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "INCOME",
            amount: input.amount,
            date: new Date(),
            description: `Pengembalian dari ${debt.contact.name}`,
            toAccountId: input.accountId,
            isPersonal: true,
            flowTag: `Pengembalian: ${debt.contact.name}`, // Special tag
          },
        });
      } else {
        // HUTANG payment: Uang keluar dari akun (saya mengembalikan)
        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: { decrement: input.amount } },
        });
      }
    });

    revalidatePath("/finance");

    const typeLabel = debt.type === "LENDING" ? "piutang" : "hutang";
    const actionLabel =
      debt.type === "LENDING"
        ? `Uang masuk ke ${account.name}`
        : `Uang keluar dari ${account.name}`;

    if (isNowPaid) {
      return {
        success: true,
        message: `🎉 ${debt.contact.name} telah melunasi ${typeLabel}! ${actionLabel}.`,
        debtId: debt.id,
      };
    } else {
      return {
        success: true,
        message: `Pembayaran Rp ${input.amount.toLocaleString(
          "id-ID"
        )} berhasil. ${actionLabel}. Sisa ${typeLabel}: Rp ${newRemaining.toLocaleString(
          "id-ID"
        )}.`,
        debtId: debt.id,
      };
    }
  } catch (error) {
    console.error("Error recording payment:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat mencatat pembayaran.",
    };
  }
}

// ========================
// DELETE DEBT ACTION
// ========================

export async function deleteDebt(debtId: string): Promise<DebtActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    // Verify debt belongs to user
    const debt = await prisma.debt.findFirst({
      where: { id: debtId, userId: user.id },
    });

    if (!debt) {
      return {
        success: false,
        message: "Pinjaman tidak ditemukan.",
      };
    }

    await prisma.debt.delete({
      where: { id: debtId },
    });

    revalidatePath("/finance");

    return {
      success: true,
      message: "Pinjaman berhasil dihapus.",
    };
  } catch (error) {
    console.error("Error deleting debt:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat menghapus pinjaman.",
    };
  }
}

// ========================
// MARK DEBT AS PAID ACTION
// ========================

/**
 * Mark a debt as fully paid.
 * Note: This does NOT update account balance - use recordPayment for that.
 * This is only for manual marking without balance changes.
 */
export async function markDebtAsPaid(
  debtId: string,
  accountId?: string
): Promise<DebtActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    // Verify debt belongs to user
    const debt = await prisma.debt.findFirst({
      where: { id: debtId, userId: user.id },
      include: { contact: { select: { name: true } } },
    });

    if (!debt) {
      return {
        success: false,
        message: "Pinjaman tidak ditemukan.",
      };
    }

    const remainingAmount = Number(debt.remaining);

    // If accountId is provided, process with balance update
    if (accountId && remainingAmount > 0) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: user.id },
      });

      if (!account) {
        return {
          success: false,
          message: "Akun tidak ditemukan.",
        };
      }

      // For BORROWING, check if account has sufficient balance
      if (debt.type === "BORROWING") {
        const currentBalance = Number(account.balance);
        if (currentBalance < remainingAmount) {
          return {
            success: false,
            message: `Saldo akun tidak mencukupi untuk melunasi. Saldo: Rp ${currentBalance.toLocaleString(
              "id-ID"
            )}, Sisa hutang: Rp ${remainingAmount.toLocaleString("id-ID")}`,
          };
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.debt.update({
          where: { id: debtId },
          data: {
            remaining: 0,
            isPaid: true,
          },
        });

        if (debt.type === "LENDING") {
          // Piutang: uang masuk
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: remainingAmount } },
          });

          await tx.transaction.create({
            data: {
              userId: user.id,
              type: "INCOME",
              amount: remainingAmount,
              date: new Date(),
              description: `Pelunasan dari ${debt.contact.name}`,
              toAccountId: accountId,
              isPersonal: true,
              flowTag: `Pengembalian: ${debt.contact.name}`,
            },
          });
        } else {
          // Hutang: uang keluar
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { decrement: remainingAmount } },
          });
        }
      });
    } else {
      // Just mark as paid without balance update
      await prisma.debt.update({
        where: { id: debtId },
        data: {
          remaining: 0,
          isPaid: true,
        },
      });
    }

    revalidatePath("/finance");

    const typeLabel = debt.type === "LENDING" ? "Piutang" : "Hutang";
    return {
      success: true,
      message: `${typeLabel} dari ${debt.contact.name} telah dilunasi!`,
    };
  } catch (error) {
    console.error("Error marking debt as paid:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat memperbarui status pinjaman.",
    };
  }
}
