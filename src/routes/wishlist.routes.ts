import { Router } from "express";
import { addWishlistItem, listWishlist, removeWishlistItem } from "../controllers/wishlist.controller.js";
import { requireUser } from "../middleware/auth.js";

const r = Router();
r.use(requireUser);
r.get("/", listWishlist);
r.post("/:productId", addWishlistItem);
r.delete("/:productId", removeWishlistItem);
export default r;
