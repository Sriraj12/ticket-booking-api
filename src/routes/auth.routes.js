const express = require("express");
const router = express.Router();

const {
  login,
  userRegister,
  adminRegister,
  sellerRegister
} = require("../controllers/auth.controller");

router.post("/user/register", userRegister);
router.post("/admin/register", adminRegister);
router.post("/seller/register", sellerRegister);
router.post("/login", login);

module.exports = router;