import express from "express";
import cors from "cors";
import multer from "multer";
import { processScreenshot, handleSearch } from "./controllers/screenshot.controller.js";
import { config } from "./config.js";
import authRoutes from "./routes/auth.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import gmailRoutes from "./routes/gmail.routes.js";

const app = express();
const port = config.port;

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/payment", paymentRoutes);
app.use("/gmail", gmailRoutes);

app.post("/process-screenshot", upload.single("screenshot"), processScreenshot);
app.post("/search", handleSearch);

app.get("/health", (req, res) => {
    res.status(200).send("Recall.me Backend is Healthy");
});

import { debugCognee } from "./controllers/screenshot.controller.js";
app.get("/debug-cognee", debugCognee);

import cogneeService from "./services/cognee.service.js";
app.get("/graph/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const c = new cogneeService();
        const html = await c.visualizeGraph(userId);
        if (typeof html === "string") {
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(html);
        } else {
            res.status(500).json({ error: "Graph visualization failed", details: html });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
