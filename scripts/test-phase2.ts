import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { SellerModel } from "../src/models/Seller.js";
import { SellerApplicationModel } from "../src/models/SellerApplication.js";
import { decryptField } from "../src/services/crypto.service.js";
import app from "../src/app.js";
import type { Server } from "http";

async function runTests() {
  console.log("=================================================");
  console.log("   PHASE 2 SELLER REGISTRATION & APPROVAL TEST   ");
  console.log("=================================================\n");

  await mongoose.connect(env.MONGODB_URI);
  const port = 5998;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  const baseUrl = `http://localhost:${port}/api`;
  const applicantEmail = `vendor_applicant_${Date.now()}@example.com`;
  const applicantPassword = "Applicant@Pass123!";
  let customerCookie = "";
  let adminCookie = "";
  let createdAppId = "";
  let approvedSellerId = "";

  try {
    // 1. Register a test applicant user
    console.log("1. Creating applicant customer account...");
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        name: "Vikram Mehta",
        email: applicantEmail,
        password: applicantPassword,
        phone: "+91 9820011223",
      }),
    });
    if (!regRes.ok) throw new Error("Registration failed");
    customerCookie = regRes.headers.get("set-cookie")?.split(";")[0] ?? "";
    console.log("   [PASS] Customer registered and authenticated.");

    // 2. Check my application status (initially none)
    console.log("2. Checking initial application state via GET /seller-applications/mine...");
    const mineRes1 = await fetch(`${baseUrl}/seller-applications/mine`, {
      headers: { Cookie: customerCookie },
    });
    const mineJson1 = (await mineRes1.json()) as { success: boolean; data: { hasApplication: boolean } };
    if (!mineRes1.ok || mineJson1.data.hasApplication !== false) {
      throw new Error("Expected hasApplication: false initially");
    }
    console.log("   [PASS] Initial state correctly reports no application.");

    // 3. Test Invalid PAN validation
    console.log("3. Testing PAN format validation failure...");
    const badPanRes = await fetch(`${baseUrl}/seller-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({
        storeName: "Mehta Horology",
        ownerName: "Vikram Mehta",
        email: applicantEmail,
        phone: "+91 9820011223",
        businessAddress: { line1: "12 Marine Drive", city: "Mumbai", state: "Maharashtra", pincode: "400020" },
        kyc: { pan: "INVALID_PAN" },
        bankDetails: { accountHolderName: "Vikram Mehta", accountNumber: "123456789012", ifscCode: "HDFC0001234", bankName: "HDFC Bank" },
      }),
    });
    if (badPanRes.status !== 400) throw new Error(`Expected 400 for bad PAN, got ${badPanRes.status}`);
    console.log("   [PASS] Invalid PAN correctly rejected with 400 Bad Request.");

    // 4. Submit Valid Seller Application
    console.log("4. Submitting valid seller application...");
    const validAppRes = await fetch(`${baseUrl}/seller-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({
        storeName: "Mehta Horology",
        ownerName: "Vikram Mehta",
        email: applicantEmail,
        phone: "+91 9820011223",
        description: "Curator of Swiss and German chronometers.",
        businessAddress: { line1: "12 Marine Drive", city: "Mumbai", state: "Maharashtra", pincode: "400020" },
        kyc: { pan: "ABCDE1234F", gstin: "27ABCDE1234F1Z5" },
        bankDetails: {
          accountHolderName: "Vikram Mehta",
          accountNumber: "98765432101234",
          ifscCode: "HDFC0001234",
          bankName: "HDFC Bank",
        },
      }),
    });
    const validAppJson = (await validAppRes.json()) as { success: boolean; data: { id: string; status: string; bankDetails: { accountNumberLast4: string } } };
    if (!validAppRes.ok || validAppJson.data?.status !== "pending") {
      throw new Error("Application creation failed");
    }
    createdAppId = validAppJson.data.id;
    if (validAppJson.data.bankDetails.accountNumberLast4 !== "1234") {
      throw new Error("Account number last4 not computed properly");
    }

    // Verify DB encryption of bank account
    const dbApp = await SellerApplicationModel.findById(createdAppId);
    if (!dbApp || !dbApp.bankDetails.accountNumberEncrypted.includes(":")) {
      throw new Error("Bank account was not encrypted in database");
    }
    const decryptedAccount = decryptField(dbApp.bankDetails.accountNumberEncrypted);
    if (decryptedAccount !== "98765432101234") {
      throw new Error("Decrypted bank account does not match original");
    }
    console.log("   [PASS] Application created; bank account securely encrypted with AES-256-GCM.");

    // 5. Duplicate submission check
    console.log("5. Testing duplicate application blocking...");
    const dupRes = await fetch(`${baseUrl}/seller-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({
        storeName: "Mehta Horology 2",
        ownerName: "Vikram Mehta",
        email: applicantEmail,
        phone: "+91 9820011223",
        businessAddress: { line1: "12 Marine Drive", city: "Mumbai", state: "Maharashtra", pincode: "400020" },
        kyc: { pan: "ABCDE1234F" },
        bankDetails: { accountHolderName: "Vikram Mehta", accountNumber: "98765432101234", ifscCode: "HDFC0001234", bankName: "HDFC Bank" },
      }),
    });
    if (dupRes.status !== 409) throw new Error(`Expected 409 Conflict for duplicate submission, got ${dupRes.status}`);
    console.log("   [PASS] Duplicate pending application correctly blocked with 409.");

    // 6. Admin Authentication & Review
    console.log("6. Admin logging in to review application queue...");
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }),
    });
    adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    const listRes = await fetch(`${baseUrl}/admin/applications?status=pending`, {
      headers: { Cookie: adminCookie },
    });
    const listJson = (await listRes.json()) as { success: boolean; data: { items: Array<{ id: string; storeName: string }> } };
    const found = listJson.data.items.find((a) => a.id === createdAppId);
    if (!found) throw new Error("Created application not found in admin pending list");
    console.log("   [PASS] Application visible in Super Admin queue.");

    // 7. Test Admin Rejection
    console.log("7. Testing Admin Rejection with reason...");
    const rejectRes = await fetch(`${baseUrl}/admin/applications/${createdAppId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({ reason: "Business address needs unit number specification." }),
    });
    if (!rejectRes.ok) throw new Error("Admin rejection failed");
    const rejectedDbApp = await SellerApplicationModel.findById(createdAppId);
    if (rejectedDbApp?.status !== "rejected" || !rejectedDbApp.rejectionReason) {
      throw new Error("Application status not updated to rejected in database");
    }
    console.log("   [PASS] Application rejected and reason recorded.");

    // 8. Reapplication after rejection
    console.log("8. Testing customer reapplication after rejection...");
    const reapplyRes = await fetch(`${baseUrl}/seller-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: customerCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({
        storeName: "Mehta Horology Flagship",
        ownerName: "Vikram Mehta",
        email: applicantEmail,
        phone: "+91 9820011223",
        businessAddress: { line1: "Unit 402, 12 Marine Drive", city: "Mumbai", state: "Maharashtra", pincode: "400020" },
        kyc: { pan: "ABCDE1234F", gstin: "27ABCDE1234F1Z5" },
        bankDetails: { accountHolderName: "Vikram Mehta", accountNumber: "98765432101234", ifscCode: "HDFC0001234", bankName: "HDFC Bank" },
      }),
    });
    const reapplyJson = (await reapplyRes.json()) as { success: boolean; data: { id: string } };
    if (!reapplyRes.ok) throw new Error("Reapplication failed");
    const newAppId = reapplyJson.data.id;
    console.log("   [PASS] Customer reapplication accepted with status pending.");

    // 9. Admin Approval
    console.log("9. Testing Super Admin Approval...");
    const approveRes = await fetch(`${baseUrl}/admin/applications/${newAppId}/approve`, {
      method: "POST",
      headers: { Cookie: adminCookie, Origin: "http://localhost:3000" },
    });
    const approveJson = (await approveRes.json()) as { success: boolean; data: { seller: { id: string; status: string; slug: string } } };
    if (!approveRes.ok || !approveJson.data?.seller) throw new Error("Approval failed");
    approvedSellerId = approveJson.data.seller.id;

    // Verify User Role upgraded to seller in DB
    const upgradedUser = await UserModel.findOne({ email: applicantEmail });
    if (upgradedUser?.role !== "seller") {
      throw new Error(`Expected user role 'seller', got '${upgradedUser?.role}'`);
    }
    console.log("   [PASS] Super Admin approved application; user role upgraded to 'seller'.");

    // 10. Admin Suspend & Activate Seller
    console.log("10. Testing Seller Suspension and Reactivation...");
    const suspendRes = await fetch(`${baseUrl}/admin/sellers/${approvedSellerId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({ reason: "Temporary audit suspension" }),
    });
    if (!suspendRes.ok) throw new Error("Suspension failed");
    const suspendedSeller = await SellerModel.findById(approvedSellerId);
    if (suspendedSeller?.status !== "suspended") throw new Error("Seller status was not updated to suspended");
    console.log("   [PASS] Seller suspended successfully.");

    const activateRes = await fetch(`${baseUrl}/admin/sellers/${approvedSellerId}/activate`, {
      method: "POST",
      headers: { Cookie: adminCookie, Origin: "http://localhost:3000" },
    });
    if (!activateRes.ok) throw new Error("Reactivation failed");
    const activatedSeller = await SellerModel.findById(approvedSellerId);
    if (activatedSeller?.status !== "active") throw new Error("Seller status was not restored to active");
    console.log("   [PASS] Seller reactivated successfully.");

    // 11. Admin Custom Commission Override
    console.log("11. Testing Seller Commission update...");
    const commRes = await fetch(`${baseUrl}/admin/sellers/${approvedSellerId}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({ commissionBps: 1250 }), // 12.5%
    });
    if (!commRes.ok) throw new Error("Commission update failed");
    const commSeller = await SellerModel.findById(approvedSellerId);
    if (commSeller?.commissionBps !== 1250) throw new Error("Commission bps not updated in DB");
    console.log("   [PASS] Custom commission override (12.5%) saved.");

    // 12. Customer Blocked from Admin Endpoints
    console.log("12. Testing Customer / Seller forbidden from Admin Seller Management...");
    const forbiddenRes = await fetch(`${baseUrl}/admin/sellers`, {
      headers: { Cookie: customerCookie },
    });
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin, got ${forbiddenRes.status}`);
    }
    console.log("   [PASS] Non-admin strictly blocked with 403 from admin seller endpoints.");

    // Cleanup test records
    await UserModel.deleteOne({ email: applicantEmail });
    await SellerModel.deleteOne({ _id: approvedSellerId });
    await SellerApplicationModel.deleteMany({ email: applicantEmail });

    console.log("\n=================================================");
    console.log("   ALL 12 PHASE 2 TESTS PASSED!                  ");
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

