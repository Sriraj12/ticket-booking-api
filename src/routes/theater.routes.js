const express = require("express");
const router = express.Router();
const { createTheater, getSellerTheaters } = require("../controllers/theater.controller");

const { verifyToken, isSeller } = require("../middlewares/auth.middleware");

router.post(
  "/create-theater",
  verifyToken,
  isSeller,
  createTheater 
);

router.get(
  "/theaters",
  verifyToken,
  isSeller,
  getSellerTheaters 
);

module.exports = router;