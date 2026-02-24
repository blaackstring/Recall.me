import express from "express";
import cors from "cors";
import multer from "multer";
import { processScreenshot, handleSearch } from "./controllers/screenshot.controller.js";
import { config } from "./config.js";

const app = express();
const port = config.port;

// Multer setup for memory storage (we'll pass the buffer to S3 and AI services)
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Routes
app.post("/process-screenshot", upload.single("screenshot"), processScreenshot);
app.post("/search", handleSearch);

app.get("/health", (req, res) => {
    res.status(200).send("Recall.me Backend is Healthy");
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
