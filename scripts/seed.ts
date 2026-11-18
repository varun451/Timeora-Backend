import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ProductModel } from "../src/models/Product.js";
import { UserModel } from "../src/models/User.js";
import { SEED_PRODUCTS } from "./seed-data.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  await ProductModel.bulkWrite(SEED_PRODUCTS.map((p) => {
    const product = p as Record<string, unknown>;
    return { updateOne: { filter: { slug: product.slug }, update: { $set: product }, upsert: true } };
  }));
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: pw } = env;
  if (email && pw) {
    await UserModel.updateOne(
      { email },
      {
        $setOnInsert: {
          name: "Super Admin",
          email,
          passwordHash: await bcrypt.hash(pw, 12),
          role: "super_admin",
          tokenVersion: 0,
        },
        $set: { role: "super_admin" },
      },
      { upsert: true },
    );
    console.log("Super admin ensured:", email);
  }
  console.log(`Seeded ${SEED_PRODUCTS.length} products into ${mongoose.connection.name}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
