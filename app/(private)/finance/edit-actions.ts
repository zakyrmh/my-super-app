"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  allocateFundsForExpense,
  type FundingAllocation,
} from "@/lib/finance/smart-allocation";

// ========================
// TYPE DEFINITIONS
// ========================

/** Transaction type enum matching Prisma schema */
export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "LENDING"
  | "REPAYMENT";

/** Input data for editing a transaction */
export interface EditTransactionInput {
  transactionId: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO date string
  description?: string | null;
  category?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  isPersonal?: boolean;

  /** Name of the funding source (e.g. "Gaji", "Bonus") - For INCOME only */
  fundingSourceName?: string | null;

  /** Manual fund allocations for EXPENSE (optional - if not provided, auto-allocation is used) */
  manualAllocations?: { fundingSourceId: string; amount: number }[] | null;

  /** Itemized expense details (optional) */
  items?:
    | { name: string; price: number; qty: number; category?: string | null }[]
    | null;
}

/** Input for editing debt */
export interface EditDebtInput {
  debtId: string;
  amount: number;
  description?: string | null;
  date?: string | null; // loan creation date
  dueDate?: string | null;
  contactId?: string | null;
  contactName?: string | null;
}

/** Input for editing debt payment */
export interface EditDebtPaymentInput {
  transactionId: string;
  amount: number;
  description?: string | null;
  date?: string | null;
}

/** Response type for edit actions */
export interface EditActionResponse {
  success: boolean;
  message: string;
}

// ========================
// GET TRANSACTION DETAIL FOR EDIT
// ========================

export async function getTransactionForEdit(transactionId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: user.id,
      },
      include: {
        category: true,
        fromAccount: true,
        toAccount: true,
        items: {
          include: {
            category: true,
          },
        },
        fundings: {
          include: {
            fundingSource: true,
          },
        },
      },
    });

    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      date: transaction.date.toISOString(),
      description: transaction.description,
      category: transaction.category?.name || null,
      fromAccount: transaction.fromAccount
        ? {
            id: transaction.fromAccount.id,
            name: transaction.fromAccount.name,
          }
        : null,
      toAccount: transaction.toAccount
        ? {
            id: transaction.toAccount.id,
            name: transaction.toAccount.name,
          }
        : null,
      isPersonal: transaction.isPersonal,
      fundings: transaction.fundings.map((f) => ({
        fundingSourceId: f.fundingSourceId,
        fundingSourceName: f.fundingSource.name,
        amount: Number(f.amount),
      })),
      items: transaction.items.map((item) => ({
        name: item.name,
        price: Number(item.price),
        qty: item.qty,
        category: item.category?.name || null,
      })),
    };
  } catch (error) {
    console.error("Error fetching transaction for edit:", error);
    return null;
  }
}

// ========================
// EDIT TRANSACTION ACTION (INCOME, EXPENSE, TRANSFER)
// ========================

/**
 * Edit an existing transaction with full ACID compliance.
 * This function handles rollback of old transaction and creation of new state atomically.
 */
export async function editTransaction(
  input: EditTransactionInput,
): Promise<EditActionResponse> {
  try {
    // 1. Get authenticated user
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

    // 2. Validate required fields
    if (!input.type) {
      return {
        success: false,
        message: "Tipe transaksi wajib dipilih.",
      };
    }

    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        message: "Jumlah transaksi harus lebih dari 0.",
      };
    }

    // 3. Validate account based on transaction type
    if (input.type === "INCOME" && !input.toAccountId) {
      return {
        success: false,
        message: "Akun tujuan pemasukan wajib dipilih.",
      };
    }

    if (input.type === "EXPENSE" && !input.fromAccountId) {
      return {
        success: false,
        message: "Akun sumber pengeluaran wajib dipilih.",
      };
    }

    if (input.type === "TRANSFER") {
      if (!input.fromAccountId || !input.toAccountId) {
        return {
          success: false,
          message: "Akun asal dan tujuan transfer wajib dipilih.",
        };
      }
      if (input.fromAccountId === input.toAccountId) {
        return {
          success: false,
          message: "Akun asal dan tujuan tidak boleh sama.",
        };
      }
    }

    // 4. Verify accounts belong to user
    if (input.fromAccountId) {
      const fromAccount = await prisma.account.findFirst({
        where: { id: input.fromAccountId, userId: user.id },
      });
      if (!fromAccount) {
        return {
          success: false,
          message: "Akun asal tidak ditemukan.",
        };
      }
    }

    if (input.toAccountId) {
      const toAccount = await prisma.account.findFirst({
        where: { id: input.toAccountId, userId: user.id },
      });
      if (!toAccount) {
        return {
          success: false,
          message: "Akun tujuan tidak ditemukan.",
        };
      }
    }

    // 5. Get original transaction
    const originalTx = await prisma.transaction.findFirst({
      where: { id: input.transactionId, userId: user.id },
      include: {
        fundings: true,
        items: true,
      },
    });

    if (!originalTx) {
      return {
        success: false,
        message: "Transaksi tidak ditemukan.",
      };
    }

    // 6. Handle EXPENSE and TRANSFER with Fund Allocation
    let fundingAllocations: FundingAllocation[] = [];

    if (
      (input.type === "EXPENSE" || input.type === "TRANSFER") &&
      input.fromAccountId
    ) {
      // Use manual allocations if provided, otherwise auto-allocate
      if (input.manualAllocations && input.manualAllocations.length > 0) {
        // Validate manual allocations total matches amount
        const manualTotal = input.manualAllocations.reduce(
          (sum, a) => sum + a.amount,
          0,
        );
        if (manualTotal !== input.amount) {
          return {
            success: false,
            message: `Total alokasi (Rp ${manualTotal.toLocaleString(
              "id-ID",
            )}) tidak sama dengan jumlah transaksi (Rp ${input.amount.toLocaleString(
              "id-ID",
            )})`,
          };
        }

        fundingAllocations = input.manualAllocations.map((ma) => ({
          fundingSourceId: ma.fundingSourceId,
          sourceName: "", // Placeholder
          amount: ma.amount,
        }));
      } else {
        // Auto-allocate using waterfall logic
        try {
          const allocationResult = await allocateFundsForExpense(
            input.fromAccountId,
            input.amount,
            false, // Don't allow overdraft
          );
          fundingAllocations = allocationResult.allocations;
        } catch (error) {
          if (error instanceof Error) {
            return {
              success: false,
              message: error.message,
            };
          }
          throw error;
        }
      }
    }

    // 7. Resolve Category (Find or Create)
    let finalCategoryId: string | null = null;
    if (input.category) {
      const categoryName = input.category.trim();
      const existingCategory = await prisma.category.findFirst({
        where: {
          userId: user.id,
          name: { equals: categoryName, mode: "insensitive" },
          type: input.type,
        },
      });

      if (existingCategory) {
        finalCategoryId = existingCategory.id;
      } else {
        const newCategory = await prisma.category.create({
          data: {
            name: categoryName,
            type: input.type,
            userId: user.id,
            keywords: [categoryName.toLowerCase()],
          },
        });
        finalCategoryId = newCategory.id;
      }
    }

    // 8. Handle INCOME Funding Source Resolution
    let incomeFundingSourceId: string | null = null;
    if (input.type === "INCOME" && input.fundingSourceName) {
      const fsName = input.fundingSourceName.trim();
      const fundingSource = await prisma.fundingSource.findUnique({
        where: {
          userId_name: {
            userId: user.id,
            name: fsName,
          },
        },
      });

      if (fundingSource) {
        incomeFundingSourceId = fundingSource.id;
      } else {
        const newFs = await prisma.fundingSource.create({
          data: {
            userId: user.id,
            name: fsName,
            type: "INCOME",
          },
        });
        incomeFundingSourceId = newFs.id;
      }
    }

    // 9. Execute edit in atomic transaction
    // Strategy: Rollback old transaction effects, then apply new transaction
    await prisma.$transaction(async (tx) => {
      // STEP 1: ROLLBACK OLD TRANSACTION
      // Reverse account balance changes from original transaction
      if (originalTx.type === "INCOME" && originalTx.toAccountId) {
        // Rollback income: subtract from receiving account
        await tx.account.update({
          where: { id: originalTx.toAccountId },
          data: { balance: { decrement: originalTx.amount } },
        });
      } else if (originalTx.type === "EXPENSE" && originalTx.fromAccountId) {
        // Rollback expense: add back to sending account
        await tx.account.update({
          where: { id: originalTx.fromAccountId },
          data: { balance: { increment: originalTx.amount } },
        });
      } else if (
        originalTx.type === "TRANSFER" &&
        originalTx.fromAccountId &&
        originalTx.toAccountId
      ) {
        // Rollback transfer
        await tx.account.update({
          where: { id: originalTx.fromAccountId },
          data: { balance: { increment: originalTx.amount } },
        });
        await tx.account.update({
          where: { id: originalTx.toAccountId },
          data: { balance: { decrement: originalTx.amount } },
        });
      }

      // Delete old funding records
      await tx.transactionFunding.deleteMany({
        where: { transactionId: originalTx.id },
      });

      // Delete old item records
      await tx.transactionItem.deleteMany({
        where: { transactionId: originalTx.id },
      });

      // STEP 2: APPLY NEW TRANSACTION
      // Update transaction record
      await tx.transaction.update({
        where: { id: input.transactionId },
        data: {
          type: input.type,
          amount: input.amount,
          date: input.date ? new Date(input.date) : new Date(),
          description: input.description?.trim() || null,
          categoryId: finalCategoryId,
          fromAccountId: input.fromAccountId || null,
          toAccountId: input.toAccountId || null,
          isPersonal: input.isPersonal ?? true,
        },
      });

      // Create Funding Record for INCOME
      if (input.type === "INCOME" && incomeFundingSourceId) {
        await tx.transactionFunding.create({
          data: {
            transactionId: input.transactionId,
            fundingSourceId: incomeFundingSourceId,
            amount: input.amount,
          },
        });
      }

      // Handle account balance updates based on NEW type
      if (input.type === "INCOME" && input.toAccountId) {
        // Income: Add to receiving account
        await tx.account.update({
          where: { id: input.toAccountId },
          data: { balance: { increment: input.amount } },
        });
      } else if (input.type === "EXPENSE" && input.fromAccountId) {
        // Expense: Subtract from sending account with balance check
        const updatedFromAccount = await tx.account.updateMany({
          where: {
            id: input.fromAccountId,
            balance: { gte: input.amount },
          },
          data: { balance: { decrement: input.amount } },
        });

        if (updatedFromAccount.count === 0) {
          throw new Error(
            "Edit gagal: Saldo tidak mencukupi atau berubah oleh transaksi lain.",
          );
        }

        // Create TransactionFunding records for each allocation
        if (fundingAllocations.length > 0) {
          await tx.transactionFunding.createMany({
            data: fundingAllocations.map((alloc) => ({
              transactionId: input.transactionId,
              fundingSourceId: alloc.fundingSourceId,
              amount: alloc.amount,
            })),
          });
        }

        // Create TransactionItem records for itemized expenses
        if (input.items && input.items.length > 0) {
          for (const item of input.items) {
            let itemCategoryId: string | null = null;

            if (item.category) {
              const iCatName = item.category.trim();
              const existingItemCat = await tx.category.findFirst({
                where: {
                  userId: user.id,
                  name: { equals: iCatName, mode: "insensitive" },
                  type: "EXPENSE",
                },
              });

              if (existingItemCat) {
                itemCategoryId = existingItemCat.id;
              } else {
                const newItemCat = await tx.category.create({
                  data: {
                    name: iCatName,
                    type: "EXPENSE",
                    userId: user.id,
                    keywords: [iCatName.toLowerCase()],
                  },
                });
                itemCategoryId = newItemCat.id;
              }
            }

            await tx.transactionItem.create({
              data: {
                transactionId: input.transactionId,
                name: item.name,
                price: item.price,
                qty: item.qty,
                categoryId: itemCategoryId,
              },
            });
          }
        }
      } else if (
        input.type === "TRANSFER" &&
        input.fromAccountId &&
        input.toAccountId
      ) {
        // Transfer: Check balance and update both accounts
        const fromAccount = await tx.account.findUnique({
          where: { id: input.fromAccountId },
          select: { balance: true },
        });

        if (!fromAccount) {
          throw new Error("Akun asal tidak ditemukan.");
        }

        const currentBalance = Number(fromAccount.balance);
        if (currentBalance < input.amount) {
          throw new Error(
            `Saldo tidak mencukupi. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}, diperlukan: Rp ${input.amount.toLocaleString("id-ID")}`,
          );
        }

        // Update FROM account with optimistic locking
        const updatedFromAccount = await tx.account.updateMany({
          where: {
            id: input.fromAccountId,
            balance: { gte: input.amount },
          },
          data: { balance: { decrement: input.amount } },
        });

        if (updatedFromAccount.count === 0) {
          throw new Error(
            "Transfer gagal: Saldo berubah oleh transaksi lain. Silakan coba lagi.",
          );
        }

        // Update TO account
        await tx.account.update({
          where: { id: input.toAccountId },
          data: { balance: { increment: input.amount } },
        });

        // Create TransactionFunding records for TRANSFER
        if (fundingAllocations.length > 0) {
          await tx.transactionFunding.createMany({
            data: fundingAllocations.map((alloc) => ({
              transactionId: input.transactionId,
              fundingSourceId: alloc.fundingSourceId,
              amount: alloc.amount,
            })),
          });
        }
      }
    });

    // 10. Revalidate
    revalidatePath("/finance");
    revalidatePath("/finance/transactions");

    return {
      success: true,
      message: "Transaksi berhasil diperbarui!",
    };
  } catch (error) {
    console.error("Error editing transaction:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat mengedit transaksi. Silakan coba lagi.";

    return {
      success: false,
      message: errorMessage,
    };
  }
}

// ========================
// GET DEBT FOR EDIT
// ========================

export async function getDebtForEdit(debtId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
        userId: user.id,
      },
      include: {
        contact: true,
      },
    });

    if (!debt) {
      return null;
    }

    // Get the original transaction for this debt
    const transaction = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        OR: [{ type: "LENDING" }, { type: "REPAYMENT" }],
        description: {
          contains: debt.contact.name,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        fromAccount: true,
        toAccount: true,
      },
    });

    return {
      id: debt.id,
      type: debt.type,
      amount: Number(debt.amount),
      remaining: Number(debt.remaining),
      description: debt.description,
      dueDate: debt.dueDate?.toISOString() || null,
      createdAt: debt.createdAt.toISOString(),
      contact: {
        id: debt.contact.id,
        name: debt.contact.name,
      },
      account: transaction?.fromAccount || transaction?.toAccount || null,
    };
  } catch (error) {
    console.error("Error fetching debt for edit:", error);
    return null;
  }
}

// ========================
// EDIT DEBT (LENDING/BORROWING)
// ========================

/**
 * Edit an existing debt/lending record.
 * Note: This only edits the debt metadata, not the transaction itself.
 * For changing amounts, user should delete and recreate.
 */
export async function editDebt(
  input: EditDebtInput,
): Promise<EditActionResponse> {
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

    // Get original debt
    const originalDebt = await prisma.debt.findFirst({
      where: { id: input.debtId, userId: user.id },
      include: { contact: true },
    });

    if (!originalDebt) {
      return {
        success: false,
        message: "Pinjaman tidak ditemukan.",
      };
    }

    // Validate amount
    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        message: "Jumlah pinjaman harus lebih dari 0.",
      };
    }

    // Resolve contact
    let contactId = originalDebt.contactId;
    if (input.contactId) {
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
    } else if (input.contactName) {
      const existingContact = await prisma.contact.findFirst({
        where: {
          userId: user.id,
          name: { equals: input.contactName.trim(), mode: "insensitive" },
        },
      });

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const newContact = await prisma.contact.create({
          data: {
            name: input.contactName.trim(),
            userId: user.id,
          },
        });
        contactId = newContact.id;
      }
    }

    // Calculate new remaining based on amount change
    const amountDiff = input.amount - Number(originalDebt.amount);
    const newRemaining = Number(originalDebt.remaining) + amountDiff;

    // Update debt
    await prisma.debt.update({
      where: { id: input.debtId },
      data: {
        amount: input.amount,
        remaining: Math.max(0, newRemaining),
        description: input.description?.trim() || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        contactId,
      },
    });

    revalidatePath("/finance");

    return {
      success: true,
      message: "Data pinjaman berhasil diperbarui!",
    };
  } catch (error) {
    console.error("Error editing debt:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat mengedit pinjaman.",
    };
  }
}

// ========================
// EDIT DEBT PAYMENT (LENDING/BORROWING PAYMENT)
// ========================

/**
 * Edit a debt payment transaction (LENDING or REPAYMENT type).
 * This modifies both the transaction and updates the related debt's remaining balance.
 */
export async function editDebtPayment(
  input: EditDebtPaymentInput,
): Promise<EditActionResponse> {
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

    // Validate amount
    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        message: "Jumlah pembayaran harus lebih dari 0.",
      };
    }

    // Get original transaction
    const originalTx = await prisma.transaction.findFirst({
      where: {
        id: input.transactionId,
        userId: user.id,
        OR: [{ type: "LENDING" }, { type: "REPAYMENT" }],
      },
      include: {
        fromAccount: true,
        toAccount: true,
        fundings: true,
      },
    });

    if (!originalTx) {
      return {
        success: false,
        message: "Transaksi pembayaran tidak ditemukan.",
      };
    }

    // Find related debt based on description pattern
    // Assuming description contains contact name
    const debt = await prisma.debt.findFirst({
      where: {
        userId: user.id,
        contact: {
          name: {
            // Extract contact name from description
            contains: originalTx.description?.replace(
              /(Pengembalian dari |Pembayaran ke )/g,
              "",
            ),
          },
        },
      },
      include: {
        contact: true,
      },
    });

    if (!debt) {
      return {
        success: false,
        message: "Data pinjaman terkait tidak ditemukan.",
      };
    }

    // Execute edit in atomic transaction
    await prisma.$transaction(async (tx) => {
      // Calculate the difference between old and new payment amount
      const amountDiff = input.amount - Number(originalTx.amount);

      // STEP 1: ROLLBACK OLD TRANSACTION
      if (originalTx.type === "REPAYMENT" && originalTx.toAccountId) {
        // Rollback LENDING payment (friend repaying): subtract from account
        await tx.account.update({
          where: { id: originalTx.toAccountId },
          data: { balance: { decrement: originalTx.amount } },
        });
      } else if (originalTx.type === "LENDING" && originalTx.fromAccountId) {
        // Rollback BORROWING payment (user repaying): add back to account
        await tx.account.update({
          where: { id: originalTx.fromAccountId },
          data: { balance: { increment: originalTx.amount } },
        });
      }

      // Delete old funding records
      await tx.transactionFunding.deleteMany({
        where: { transactionId: originalTx.id },
      });

      // STEP 2: APPLY NEW TRANSACTION
      // Update transaction record
      await tx.transaction.update({
        where: { id: input.transactionId },
        data: {
          amount: input.amount,
          date: input.date ? new Date(input.date) : originalTx.date,
          description: input.description?.trim() || originalTx.description,
        },
      });

      // Apply new account balance changes
      if (originalTx.type === "REPAYMENT" && originalTx.toAccountId) {
        // LENDING payment: Add to account
        await tx.account.update({
          where: { id: originalTx.toAccountId },
          data: { balance: { increment: input.amount } },
        });

        // Re-create funding record
        const sourceName = `Pelunasan: ${debt.contact.name}`;
        const fs = await tx.fundingSource.upsert({
          where: { userId_name: { userId: user.id, name: sourceName } },
          update: {},
          create: {
            userId: user.id,
            name: sourceName,
            type: "INCOME",
          },
        });

        await tx.transactionFunding.create({
          data: {
            transactionId: input.transactionId,
            fundingSourceId: fs.id,
            amount: input.amount,
          },
        });
      } else if (originalTx.type === "LENDING" && originalTx.fromAccountId) {
        // BORROWING payment: Subtract from account with balance check
        const account = await tx.account.findUnique({
          where: { id: originalTx.fromAccountId },
          select: { balance: true },
        });

        if (!account) {
          throw new Error("Akun tidak ditemukan.");
        }

        const currentBalance = Number(account.balance);
        if (currentBalance < input.amount) {
          throw new Error(
            `Saldo tidak mencukupi. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}`,
          );
        }

        const updatedAccount = await tx.account.updateMany({
          where: {
            id: originalTx.fromAccountId,
            balance: { gte: input.amount },
          },
          data: { balance: { decrement: input.amount } },
        });

        if (updatedAccount.count === 0) {
          throw new Error(
            "Pembayaran gagal: Saldo tidak mencukupi atau berubah oleh transaksi lain.",
          );
        }

        // Re-allocate funds
        try {
          const allocationResult = await allocateFundsForExpense(
            originalTx.fromAccountId,
            input.amount,
            false,
          );

          await tx.transactionFunding.createMany({
            data: allocationResult.allocations.map((alloc) => ({
              transactionId: input.transactionId,
              fundingSourceId: alloc.fundingSourceId,
              amount: alloc.amount,
            })),
          });
        } catch (error) {
          throw new Error(
            `Gagal alokasi dana: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      // STEP 3: UPDATE DEBT REMAINING
      // Adjust debt remaining based on amount change
      const newRemaining = Math.max(
        0,
        Number(debt.remaining) - amountDiff, // Subtract diff because payment reduces debt
      );

      await tx.debt.update({
        where: { id: debt.id },
        data: {
          remaining: newRemaining,
          isPaid: newRemaining <= 0,
        },
      });
    });

    revalidatePath("/finance");
    revalidatePath("/finance/transactions");

    return {
      success: true,
      message: "Pembayaran berhasil diperbarui!",
    };
  } catch (error) {
    console.error("Error editing debt payment:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat mengedit pembayaran.";

    return {
      success: false,
      message: errorMessage,
    };
  }
}
