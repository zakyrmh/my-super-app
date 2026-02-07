// @ts-nocheck
import { PrismaClient } from "../lib/generated/prisma/client";
import { writeFile } from "fs/promises";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backup of User table...");
  try {
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users.`);

    if (users.length > 0) {
      const backupPath = join(__dirname, "users-backup.json");
      await writeFile(backupPath, JSON.stringify(users, null, 2));
      console.log(`Backup successfully saved to ${backupPath}`);
    } else {
      console.log("No users found to backup.");
    }
  } catch (error) {
    console.error("Backup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
