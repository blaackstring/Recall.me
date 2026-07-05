import { Router } from "express";
import { connectGmail, disconnectGmail, gmailStatus, gmailConfig } from "../controllers/gmail.controller.js";
import { firebaseAuthMiddleware } from "../middleware/firebase-auth.middleware.js";

const router = Router();

// All Gmail routes require Firebase authentication
router.use(firebaseAuthMiddleware);

// GET /gmail/config — get OAuth client ID (for extension to initiate flow)
router.get("/config", gmailConfig);

// GET /gmail/status — check if user has Gmail connected
router.get("/status", gmailStatus);

// POST /gmail/connect — exchange auth code for tokens
router.post("/connect", connectGmail);

// POST /gmail/disconnect — remove stored tokens
router.post("/disconnect", disconnectGmail);

export default router;
