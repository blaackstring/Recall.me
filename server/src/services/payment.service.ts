import { Cashfree, CFEnvironment } from "cashfree-pg";
import { config } from "../config.js";

// Fixed plans configuration
export const PLANS = {
    BASIC: {
        id: "basic",
        amount: 1,
        name: "Basic Plan"
    },
    STANDARD: {
        id: "standard",
        amount: 149,
        name: "Standard Plan"
    },
    PREMIUM: {
        id: "premium",
        amount: 199,
        name: "Premium Plan"
    }
} as const;

export type PlanId = keyof typeof PLANS;

class PaymentService {
    private cashfree: Cashfree;

    constructor() {
        const env = config.cashfreeEnv === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
        
        this.cashfree = new Cashfree(
            env,
            config.cashfreeClientId,
            config.cashfreeClientSecret
        );
        
        // Set API version on the instance as required by the SDK
        this.cashfree.XApiVersion = "2023-08-01";
    }

    async createOrder(orderDetails: {
        planId: PlanId;
        customer_details: {
            customer_id: string;
            customer_name?: string;
            customer_email: string;
            customer_phone: string;
        };
        order_meta?: {
            return_url: string;
        };
        order_note?: string;
    }) {
        try {
            const plan = PLANS[orderDetails.planId];
            if (!plan) {
                throw new Error("Invalid plan ID");
            }

            const request = {
                order_amount: plan.amount,
                order_currency: "INR",
                customer_details: orderDetails.customer_details,
                order_meta: orderDetails.order_meta,
                order_note: orderDetails.order_note || `Subscription for ${plan.name}`,
            };

            const response = await this.cashfree.PGCreateOrder(request);
            return response.data;
        } catch (error: any) {
            console.error("Error setting up order request:", error.response?.data || error.message);
            throw error;
        }
    }

    async checkOrderStatus(orderId: string) {
        try {
            const response = await this.cashfree.PGOrderFetchPayments(orderId);
            return response.data;
        } catch (error: any) {
            console.error("Error fetching order status:", error.response?.data || error.message);
            throw error;
        }
    }
}

export const paymentService = new PaymentService();
