import { prisma } from "../lib/prisma";
import { readFile } from "fs/promises";
import { join } from "path";

async function main() {
  console.log("Starting restore of User table...");
  try {
    const backupPath = join(__dirname, "users-backup.json");
    console.log(`Reading backup from ${backupPath}`);
    const data = await readFile(backupPath, "utf-8");
    const users = JSON.parse(data);

    console.log(`Found ${users.length} users in backup.`);

    for (const user of users) {
      // Use upsert to be safe
      await prisma.user.upsert({
        where: { id: user.id },
        update: user,
        create: user,
      });
    }
    console.log("Restore completed successfully.");
  } catch (error) {
    console.error("Restore failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
