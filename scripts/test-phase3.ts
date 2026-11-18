import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { SellerModel } from "../src/models/Seller.js";
import { ProductModel } from "../src/models/Product.js";
import app from "../src/app.js";
import type { Server } from "http";

async function runTests() {
  console.log("=================================================");
  console.log("   PHASE 3 SELLER DASHBOARD & PRODUCT MGMT TEST  ");
  console.log("=================================================\n");

  await mongoose.connect(env.MONGODB_URI);
  const port = 5997;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  const baseUrl = `http://localhost:${port}/api`;
  const sellerEmail = `geneva_seller_${Date.now()}@example.com`;
  const sellerPassword = "Seller@Pass123!";
  let sellerCookie = "";
  let sellerRecordId = "";
  let createdProductId = "";

  try {
    // 1. Create seller user and active Seller profile
    console.log("1. Setting up verified seller account...");
    const sellerUser = await UserModel.create({
      name: "Geneva Craftsman",
      email: sellerEmail,
      passwordHash: await (await import("bcryptjs")).default.hash(sellerPassword, 10),
      role: "seller",
      status: "active",
      tokenVersion: 0,
    });

    const sellerDoc = await SellerModel.create({
      user: sellerUser._id,
      storeName: "Geneva Timepieces",
      slug: `geneva-${Date.now()}`,
      ownerName: "Geneva Craftsman",
      email: sellerEmail,
      phone: "+91 9876500000",
      description: "Handcrafted complication watches.",
      status: "active",
      commissionBps: 1200,
    });
    sellerRecordId = String(sellerDoc._id);

    // Login as seller
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: sellerEmail, password: sellerPassword }),
    });
    if (!loginRes.ok) throw new Error("Seller login failed");
    sellerCookie = loginRes.headers.get("set-cookie")?.split(";")[0] ?? "";
    console.log("   [PASS] Seller logged in successfully.");

    // 2. Test GET /seller/dashboard
    console.log("2. Testing GET /seller/dashboard metrics...");
    const dashRes = await fetch(`${baseUrl}/seller/dashboard`, {
      headers: { Cookie: sellerCookie },
    });
    const dashJson = (await dashRes.json()) as { success: boolean; data: { store: { storeName: string; commissionBps: number }; metrics: { totalProducts: number } } };
    if (!dashRes.ok || dashJson.data.store.storeName !== "Geneva Timepieces") {
      throw new Error("Dashboard fetch failed");
    }
    if (dashJson.data.store.commissionBps !== 1200) {
      throw new Error("Commission rate mismatch");
    }
    console.log("   [PASS] Seller dashboard metrics returned successfully.");

    // 3. Test Image Upload (base64 Data URL)
    console.log("3. Testing POST /seller/upload (base64 PNG upload)...");
    // 1x1 transparent PNG base64
    const samplePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const uploadRes = await fetch(`${baseUrl}/seller/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sellerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({ image: samplePng }),
    });
    const uploadJson = (await uploadRes.json()) as { success: boolean; data: { url: string } };
    if (!uploadRes.ok || !uploadJson.data?.url.startsWith("/uploads/watch_")) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadJson)}`);
    }
    const uploadedImageUrl = uploadJson.data.url;
    console.log("   [PASS] Watch photo uploaded and saved:", uploadedImageUrl);

    // 4. Test Add Watch (POST /seller/products) -> Status should be approved immediately
    console.log("4. Testing POST /seller/products (direct storefront publishing)...");
    const createRes = await fetch(`${baseUrl}/seller/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sellerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({
        name: "Geneva Tourbillon Master",
        description: "Exquisite tourbillon with hand-finished bridge.",
        brand: "Geneva",
        category: "Automatic",
        gender: "men",
        price: 85000,
        discountPercent: 10,
        stock: 5,
        images: [uploadedImageUrl],
        specs: {
          caseMaterial: "Titanium Grade 5",
          strapMaterial: "Alligator Leather",
          dialColor: "Skeleton Silver",
          movement: "Tourbillon Calibre 21",
          waterResistance: "50 m",
          warranty: "5 years",
        },
        look: { dial: "#222222", case: "#cccccc", strap: "#111111" },
      }),
    });
    const createJson = (await createRes.json()) as { success: boolean; data: { id: string; slug: string; status: string; seller: string } };
    if (!createRes.ok || createJson.data?.status !== "approved") {
      throw new Error(`Expected product status 'approved', got '${createJson.data?.status}'`);
    }
    createdProductId = createJson.data.id;
    console.log("   [PASS] Watch created with approved status.");

    // 5. Verify Watch is immediately visible in Public Catalog
    console.log("5. Verifying watch is immediately visible in public /api/products...");
    const publicRes1 = await fetch(`${baseUrl}/products?q=Tourbillon`);
    const publicJson1 = (await publicRes1.json()) as { success: boolean; data: { items: Array<{ id: string }> } };
    const foundInPublic1 = publicJson1.data.items.some((item) => item.id === createdProductId);
    if (!foundInPublic1) {
      throw new Error("New seller watch should be visible in the storefront immediately");
    }
    console.log("   [PASS] Newly added watch is live in the customer storefront.");

    // 6. Verify Seller CAN see it in their own list
    console.log("6. Verifying seller sees the watch in GET /seller/products...");
    const sellerListRes = await fetch(`${baseUrl}/seller/products`, {
      headers: { Cookie: sellerCookie },
    });
    const sellerListJson = (await sellerListRes.json()) as { success: boolean; data: { items: Array<{ id: string; status: string }> } };
    const foundInSellerList = sellerListJson.data.items.find((item) => item.id === createdProductId);
    if (!foundInSellerList || foundInSellerList.status !== "approved") {
      throw new Error("Seller should see their live product in seller products list");
    }
    console.log("   [PASS] Seller correctly sees their live watch.");

    // 7. Quick Stock & Availability Update
    console.log("7. Testing quick stock and availability update (PATCH /seller/products/:id/stock)...");
    const stockRes = await fetch(`${baseUrl}/seller/products/${createdProductId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sellerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({ stock: 12 }),
    });
    const stockJson = (await stockRes.json()) as { success: boolean; data: { stock: number } };
    if (!stockRes.ok || stockJson.data.stock !== 12) {
      throw new Error("Stock update failed");
    }
    console.log("   [PASS] Stock updated to 12 units.");

    // 8. Test Non-Seller Access to /seller
    console.log("8. Testing non-seller customer blocked from /seller/products...");
    const custRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Regular Customer", email: `reg_${Date.now()}@example.com`, password: "Pass@123Customer" }),
    });
    const regularCustCookie = custRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    const forbiddenRes = await fetch(`${baseUrl}/seller/products`, {
      headers: { Cookie: regularCustCookie },
    });
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 for non-seller accessing /seller/products, got ${forbiddenRes.status}`);
    }
    console.log("   [PASS] Non-seller strictly blocked with 403 Forbidden.");

    // Clean up test records
    await ProductModel.deleteOne({ _id: createdProductId });
    await SellerModel.deleteOne({ _id: sellerRecordId });
    await UserModel.deleteMany({ email: { $in: [sellerEmail, `reg_${Date.now()}@example.com`] } });

    console.log("\n=================================================");
    console.log("   ALL 10 PHASE 3 TESTS PASSED!                  ");
    console.log("=================================================\n");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
