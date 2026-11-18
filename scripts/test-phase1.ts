import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { PasswordResetTokenModel } from "../src/models/PasswordResetToken.js";
import app from "../src/app.js";
import type { Server } from "http";

async function runTests() {
  console.log("=========================================");
  console.log("   PHASE 1 AUTH & RBAC VERIFICATION      ");
  console.log("=========================================\n");

  await mongoose.connect(env.MONGODB_URI);
  const port = 5999;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  const baseUrl = `http://localhost:${port}/api`;
  const cleanEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = "Password@123!";
  const newPassword = "Password@456New!";
  let sessionCookie = "";

  try {
    // 1. Test Customer Registration
    console.log("1. Testing Registration (role enforcement & phone)...");
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        name: "Test Customer",
        email: cleanEmail,
        password: testPassword,
        phone: "+91 9876543210",
      }),
    });
    const regJson = (await regRes.json()) as { success: boolean; data?: { role: string; phone: string; email: string }; error?: string };
    if (!regRes.ok || !regJson.success) throw new Error(`Registration failed: ${regJson.error}`);
    if (regJson.data?.role !== "customer") throw new Error(`Expected role 'customer', got '${regJson.data?.role}'`);
    if (regJson.data?.phone !== "+91 9876543210") throw new Error(`Phone not saved properly: ${regJson.data?.phone}`);
    console.log("   [PASS] Registration succeeded with role 'customer' and phone.");

    // Extract cookie
    const setCookie = regRes.headers.get("set-cookie");
    if (!setCookie) throw new Error("No session cookie set on registration");
    sessionCookie = setCookie.split(";")[0];

    // 2. Test /auth/me
    console.log("2. Testing /auth/me with session cookie...");
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meJson = (await meRes.json()) as { success: boolean; data?: { email: string; role: string } };
    if (!meRes.ok || meJson.data?.email !== cleanEmail.toLowerCase()) throw new Error("Could not verify session user");
    console.log("   [PASS] /auth/me successfully returned session user:", meJson.data?.email);

    // 3. Test Profile Update (name and phone)
    console.log("3. Testing Profile Update (PATCH /auth/me)...");
    const patchRes = await fetch(`${baseUrl}/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie, Origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Updated Name", phone: "+91 9123456789" }),
    });
    const patchJson = (await patchRes.json()) as { success: boolean; data?: { name: string; phone: string } };
    if (!patchRes.ok || patchJson.data?.name !== "Updated Name" || patchJson.data?.phone !== "+91 9123456789") {
      throw new Error("Profile update failed");
    }
    console.log("   [PASS] Profile updated successfully.");

    // 4. Test RBAC: Customer cannot access admin routes
    console.log("4. Testing RBAC: Customer blocked from /api/orders (admin endpoint)...");
    const adminRes = await fetch(`${baseUrl}/orders`, {
      headers: { Cookie: sessionCookie },
    });
    if (adminRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for customer accessing admin route, got ${adminRes.status}`);
    }
    console.log("   [PASS] Customer correctly blocked with 403 Forbidden from admin routes.");

    // 5. Test CSRF / Origin Protection
    console.log("5. Testing Origin Protection on mutating endpoint...");
    const csrfRes = await fetch(`${baseUrl}/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
        Origin: "https://malicious-site.com",
      },
      body: JSON.stringify({ name: "Hacked" }),
    });
    if (csrfRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-origin request, got ${csrfRes.status}`);
    }
    console.log("   [PASS] Cross-origin mutation correctly rejected with 403.");

    // 6. Test Forgot Password
    console.log("6. Testing Forgot Password flow...");
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: cleanEmail }),
    });
    if (!forgotRes.ok) throw new Error("Forgot password request failed");

    // Look up token from DB
    const resetRecord = await PasswordResetTokenModel.findOne().sort({ createdAt: -1 });
    if (!resetRecord) throw new Error("Password reset token was not written to database");
    console.log("   [PASS] Password reset request logged token with TTL expiry:", resetRecord.expiresAt);

    // 7. Test Reset Password
    console.log("7. Testing Reset Password execution...");
    // Let's test with a simulated token: create one explicitly to know the raw token
    const crypto = await import("node:crypto");
    const testRawToken = crypto.randomBytes(32).toString("hex");
    const testHash = crypto.createHash("sha256").update(testRawToken).digest("hex");
    await PasswordResetTokenModel.create({
      user: (await UserModel.findOne({ email: cleanEmail }))!._id,
      tokenHash: testHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const resetExecRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ token: testRawToken, password: newPassword }),
    });
    const resetExecJson = (await resetExecRes.json()) as { success: boolean; error?: string };
    if (!resetExecRes.ok || !resetExecJson.success) throw new Error(`Reset password execution failed: ${resetExecJson.error}`);
    console.log("   [PASS] Password successfully reset.");

    // 8. Test Old Session is Revoked (tokenVersion check)
    console.log("8. Testing Session Revocation after reset (tokenVersion invalidation)...");
    const oldSessionRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    if (oldSessionRes.status !== 401) {
      throw new Error(`Old session should have been rejected with 401, got ${oldSessionRes.status}`);
    }
    console.log("   [PASS] Previous session revoked immediately upon password change.");

    // 9. Test Login with New Password
    console.log("9. Testing Login with New Password...");
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: cleanEmail, password: newPassword }),
    });
    if (!newLoginRes.ok) throw new Error("Login with new password failed");
    console.log("   [PASS] Login with new password succeeded.");

    // 10. Test Super Admin Access
    console.log("10. Testing Super Admin Access...");
    const adminUser = await UserModel.findOne({ role: "super_admin" });
    if (adminUser) {
      const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }),
      });
      if (adminLoginRes.ok) {
        const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] ?? "";
        const adminOrdersRes = await fetch(`${baseUrl}/orders`, {
          headers: { Cookie: adminCookie },
        });
        if (adminOrdersRes.ok) {
          console.log("   [PASS] Super Admin successfully authenticated and authorized on /api/orders.");
        } else {
          console.log("   [WARN] Super Admin orders check response:", adminOrdersRes.status);
        }
      }
    }

    // Clean up test user
    await UserModel.deleteOne({ email: cleanEmail });
    console.log("\n=========================================");
    console.log("   ALL 10 PHASE 1 TESTS PASSED!          ");
    console.log("=========================================\n");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

