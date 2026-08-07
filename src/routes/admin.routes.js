const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin } = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");

router.get("/dashboard", 
    verifyToken, 
    isAdmin, 
    adminController.getAdminDashboard
);

router.get("/theaters",
    verifyToken,
    isAdmin,
    adminController.getAllTheaters
);

router.get("/theater/:id",
    verifyToken,
    isAdmin,
    adminController.getTheaterDetails
);

router.put(
  "/theater/approval",
  verifyToken,
  isAdmin,
  adminController.updateTheaterApproval
);

module.exports = router;