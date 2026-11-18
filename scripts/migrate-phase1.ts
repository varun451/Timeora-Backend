import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to MongoDB (${mongoose.connection.name}) for Phase 1 migration.`);

  // 1. Migrate any user with role: "admin" to role: "super_admin"
  const adminUpdate = await UserModel.updateMany(
    { role: "admin" },
    { $set: { role: "super_admin" } },
  );
  console.log(`Migrated ${adminUpdate.modifiedCount} admin accounts to super_admin.`);

  // 2. Ensure all users have tokenVersion initialized
  const tvUpdate = await UserModel.updateMany(
    { tokenVersion: { $exists: false } },
    { $set: { tokenVersion: 0 } },
  );
  console.log(`Initialized tokenVersion on ${tvUpdate.modifiedCount} accounts.`);

  console.log("Phase 1 database migration completed successfully.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

