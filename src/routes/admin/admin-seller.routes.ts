import { Router } from "express";
import {
  activateSeller,
  approveApplication,
  getApplication,
  getSeller,
  listApplications,
  listSellers,
  rejectApplication,
  suspendSeller,
  updateSellerCommission,
} from "../../controllers/admin/admin-seller.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const r = Router();
r.use(requireAdmin);

// Seller Applications Review
r.get("/applications", listApplications);
r.get("/applications/:id", getApplication);
r.post("/applications/:id/approve", approveApplication);
r.post("/applications/:id/reject", rejectApplication);

// Seller Management
r.get("/sellers", listSellers);
r.get("/sellers/:id", getSeller);
r.post("/sellers/:id/suspend", suspendSeller);
r.post("/sellers/:id/activate", activateSeller);
r.patch("/sellers/:id/commission", updateSellerCommission);

export default r;

