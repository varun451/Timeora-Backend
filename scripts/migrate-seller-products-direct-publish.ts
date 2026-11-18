import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ProductModel } from "../src/models/Product.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const result = await ProductModel.updateMany(
    { seller: { $exists: true, $ne: null }, status: "pending" },
    { $set: { status: "approved", published: true, rejectionReason: "" } },
  );
  console.log(`Published ${result.modifiedCount} pending seller products.`);
  await mongoose.disconnect();
}

main().catch(async (error: unknown) => {
  console.error("Could not publish pending seller products", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
