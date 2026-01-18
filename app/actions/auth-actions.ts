"use server";

import { prisma } from "@/lib/prisma";

export async function syncUserToPrisma(userData: {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string; // Optional avatar URL
}) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: userData.email,
      },
    });

    if (existingUser) {
      return { success: true, message: "User already exists in database" };
    }

    await prisma.user.create({
      data: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error syncing user to Prisma:", error);
    return { success: false, error: "Failed to sync user to database" };
  }
}
