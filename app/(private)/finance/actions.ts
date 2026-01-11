"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

// ========================
// TYPE DEFINITIONS
// ========================

/** Account type enum matching Prisma schema */
export type AccountType = "BANK" | "EWALLET" | "CASH" | "INVESTMENT" | "CREDIT";

/** Input data for creating a new account */
export interface CreateAccountInput {
  name: string;
  type: AccountType;
  balance: number;
  creditLimit?: number | null;
  statementDate?: number | null;
  dueDate?: number | null;
}

/** Response type for account actions */
export interface AccountActionResponse {
  success: boolean;
  message: string;
  accountId?: string;
}

// ========================
// CREATE ACCOUNT ACTION
// ========================

export async function createAccount(
  input: CreateAccountInput
): Promise<AccountActionResponse> {
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
    if (!input.name || input.name.trim() === "") {
      return {
        success: false,
        message: "Nama akun wajib diisi.",
      };
    }

    if (!input.type) {
      return {
        success: false,
        message: "Tipe akun wajib dipilih.",
      };
    }

    // 3. Build create data
    const createData: {
      name: string;
      type: string;
      balance: number;
      userId: string;
      creditLimit?: number;
      statementDate?: number;
      dueDate?: number;
    } = {
      name: input.name.trim(),
      type: input.type,
      balance: input.balance || 0,
      userId: user.id,
    };

    // 4. Add credit-specific fields if type is CREDIT
    if (input.type === "CREDIT") {
      if (input.creditLimit !== undefined && input.creditLimit !== null) {
        createData.creditLimit = input.creditLimit;
      }
      if (input.statementDate !== undefined && input.statementDate !== null) {
        createData.statementDate = input.statementDate;
      }
      if (input.dueDate !== undefined && input.dueDate !== null) {
        createData.dueDate = input.dueDate;
      }
    }

    // 5. Create account in database
    const account = await prisma.account.create({
      data: createData,
    });

    // 6. Revalidate the finance page to show new data
    revalidatePath("/finance");

    return {
      success: true,
      message: `Akun "${account.name}" berhasil dibuat!`,
      accountId: account.id,
    };
  } catch (error) {
    console.error("Error creating account:", error);

    return {
      success: false,
      message: "Terjadi kesalahan saat membuat akun. Silakan coba lagi.",
    };
  }
}
