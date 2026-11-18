import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ProductModel } from "../src/models/Product.js";
import { SellerModel } from "../src/models/Seller.js";
import { UserModel } from "../src/models/User.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to MongoDB (${mongoose.connection.name}) for Phase 2 migration.`);

  // 1. Locate the super admin user
  const adminUser = await UserModel.findOne({ role: "super_admin" });
  if (!adminUser) {
    throw new Error("No super_admin user found. Run `npm run seed` first.");
  }

  // 2. Ensure house seller 'Timeora' exists
  let houseSeller = await SellerModel.findOne({ slug: "timeora" });
  if (!houseSeller) {
    houseSeller = await SellerModel.create({
      user: adminUser._id,
      storeName: "Timeora Official",
      slug: "timeora",
      ownerName: "Timeora Watches",
      email: adminUser.email,
      phone: "+91 99999 99999",
      description: "Official flagship brand store of Timeora horology.",
      businessAddress: {
        line1: "100 Prestige Boulevard",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      },
      kyc: {
        pan: "ABCDE1234F",
        gstin: "27ABCDE1234F1Z5",
        verified: true,
      },
      bankDetails: {
        accountHolderName: "Timeora Retail Pvt Ltd",
        accountNumberEncrypted: "",
        accountNumberLast4: "8888",
        ifscCode: "HDFC0001234",
        bankName: "HDFC Bank",
      },
      commissionBps: 0, // Flagship store has 0% platform commission
      status: "active",
      approvedAt: new Date(),
    });
    console.log("House seller 'Timeora Official' created:", houseSeller._id);
  } else {
    console.log("House seller 'Timeora Official' already exists:", houseSeller._id);
  }

  // 3. Backfill all unassigned products to house seller
  const updatedProducts = await ProductModel.updateMany(
    { $or: [{ seller: { $exists: false } }, { seller: null }] },
    {
      $set: {
        seller: houseSeller._id,
        sellerActive: true,
        status: "approved",
        availability: "active",
      },
    },
  );
  console.log(`Backfilled ${updatedProducts.modifiedCount} products to house seller.`);

  console.log("Phase 2 database migration completed successfully.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

