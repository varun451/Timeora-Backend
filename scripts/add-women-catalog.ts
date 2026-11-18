import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ProductModel } from "../src/models/Product.js";
import { SEED_PRODUCTS } from "./seed-data.js";

async function main() {
  const products = SEED_PRODUCTS.filter((product) => product.gender === "women");
  if (products.length !== 5) {
    throw new Error(`Expected 5 women's products in the catalog, found ${products.length}.`);
  }

  await mongoose.connect(env.MONGODB_URI);
  await ProductModel.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { slug: product.slug },
        update: { $set: product },
        upsert: true,
      },
    })),
  );

  const saved = await ProductModel.find({ slug: { $in: products.map((product) => product.slug) } })
    .select("name gender price discountPercent stock images")
    .sort({ name: 1 })
    .lean();
  if (saved.length !== products.length || saved.some((product) => product.gender !== "women")) {
    throw new Error("Women's catalog verification failed.");
  }

  console.log(`Added or updated ${saved.length} women's watches without removing existing products.`);
  for (const product of saved) {
    console.log(`${product.name}: ${product.gender}, ₹${product.price}, ${product.discountPercent}% off, stock ${product.stock}`);
  }
  await mongoose.disconnect();
}

main().catch(async (error: unknown) => {
  console.error("Could not add women's watches:", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
