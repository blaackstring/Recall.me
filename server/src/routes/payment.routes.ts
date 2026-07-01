import { Router } from "express";
import { createOrder, verifyPayment } from "../controllers/payment.controller.js";

const router = Router();

/**
 * @route POST /payment/create-order
 * @desc Create a new Cashfree payment order
 */
router.post("/create-order", createOrder);

/**
 * @route GET /payment/verify/:orderId
 * @desc Verify a payment using the order ID
 */
router.get("/verify/:orderId", verifyPayment);

export default router;
