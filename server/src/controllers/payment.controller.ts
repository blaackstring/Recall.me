import type { Request, Response } from "express";
import { paymentService } from "../services/payment.service.js";
import { activateSubscription } from "../services/db.service.js";

/**
 * POST /payment/create-order
 * Request body: { order_amount, order_currency, customer_details, order_meta, order_note }
 */
export const createOrder = async (req: Request, res: Response) => {
    try {
        const { planId, customer_details, order_meta, order_note } = req.body;

        if (!planId || !customer_details || !customer_details.customer_id || !customer_details.customer_email || !customer_details.customer_phone) {
            return res.status(400).json({ error: "Missing required order details (planId or customer details)" });
        }

        const order = await paymentService.createOrder({
            planId,
            customer_details,
            order_meta,
            order_note
        });

        res.status(200).json(order);
    } catch (error: any) {
        console.error("❌ Create order error:", error);
        res.status(500).json({ 
            error: error.message || "Failed to create payment order",
            details: error.response?.data || null 
        });
    }
};

/**
 * GET /payment/verify/:orderId
 */
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        
        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required" });
        }

        const payments = await paymentService.checkOrderStatus(orderId);
        
        // Find if any payment was successful
        const isSuccess = Array.isArray(payments) && payments.some((payment: any) => payment.payment_status === "SUCCESS");

        if (isSuccess) {
            // Get order details from payments to find the plan
            const successPayment = payments.find((p: any) => p.payment_status === "SUCCESS");
            const userId = successPayment?.customer_details?.customer_id || "unknown";
            const plan = req.query.plan as string || "basic";

            // Activate subscription in DB
            try {
                await activateSubscription(userId, plan, orderId);
            } catch (dbErr) {
                console.error("⚠️ Could not activate subscription in DB:", dbErr);
            }
        }

        res.status(200).json({
            success: isSuccess,
            orderId,
            payments: payments ?? []
        });
    } catch (error: any) {
        console.error("❌ Verify payment error:", error);
        res.status(500).json({ 
            success: false,
            error: error.message || "Payment verification failed",
            details: error.response?.data || null
        });
    }
};
