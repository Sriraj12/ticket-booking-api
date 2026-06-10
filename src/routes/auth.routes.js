const express = require("express");
const router = express.Router();

const {
  login,
  userRegister,
  adminRegister,
  sellerRegister,
  googleAuth,
  googleRedirect,
  googleCallback
  ,googleDebugUrl,
  googleDebugEnv
} = require("../controllers/auth.controller");

router.post("/user/register", userRegister);
router.post("/admin/register", adminRegister);
router.post("/seller/register", sellerRegister);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);
// Debug endpoints (non-production): returns the generated Google auth URL and safe env values
router.get("/google/debug/url", googleDebugUrl);
router.get("/google/debug/env", googleDebugEnv);

module.exports = router;