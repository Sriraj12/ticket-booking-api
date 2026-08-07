const express = require("express");
const router = express.Router();
const { createScreen, getScreensByTheater } = require("../controllers/screen.controller");

const { verifyToken, isSeller } = require("../middlewares/auth.middleware");

router.post(
  "/create-screen",
  verifyToken,
  isSeller,
  createScreen 
);

router.get(
  "/screens/:theaterId",
  verifyToken,
  isSeller,
  getScreensByTheater 
);

module.exports = router;