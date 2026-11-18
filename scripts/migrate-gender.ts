import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ProductModel } from "../src/models/Product.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to MongoDB (${mongoose.connection.name}) for gender migration.`);

  const result = await ProductModel.updateMany(
    { gender: "unisex" },
    { $set: { gender: "men" } },
  );
  console.log(`Moved ${result.modifiedCount} unisex products to Men.`);

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Gender migration error:", error);
  process.exit(1);
});
