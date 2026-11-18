import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ProductModel } from "../src/models/Product.js";
import { ReviewModel } from "../src/models/Review.js";
import { UserModel } from "../src/models/User.js";
import { SEED_PRODUCTS } from "./seed-data.js";

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error("This permanently replaces the product catalog. Re-run with --confirm to proceed.");
  }

  await mongoose.connect(env.MONGODB_URI);
  const before = await ProductModel.countDocuments();

  const slugs = SEED_PRODUCTS.map((product) => String(product.slug));
  await ProductModel.bulkWrite(
    SEED_PRODUCTS.map((product) => ({
      updateOne: {
        filter: { slug: product.slug },
        update: { $set: product },
        upsert: true,
      },
    })),
  );

  const keptProducts = await ProductModel.find({ slug: { $in: slugs } })
    .select("_id")
    .lean();
  const keptIds = keptProducts.map(({ _id }) => _id);

  await Promise.all([
    ReviewModel.deleteMany({ product: { $nin: keptIds } }),
    UserModel.updateMany(
      { wishlist: { $exists: true } },
      { $pull: { wishlist: { $nin: keptIds } } },
    ),
  ]);
  const deletion = await ProductModel.deleteMany({ _id: { $nin: keptIds } });
  const remaining = await ProductModel.countDocuments();

  console.log(`Catalog replaced: ${before} old products found, ${deletion.deletedCount} removed, ${remaining} kept.`);
  console.log("Historical orders were left unchanged.");
  await mongoose.disconnect();
}

main().catch(async (error: unknown) => {
  console.error("Could not replace the product catalog:", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
