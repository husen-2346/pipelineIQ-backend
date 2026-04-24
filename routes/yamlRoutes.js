import express from "express";
import { analyzeYaml, getAiResult } from "../controllers/analyzeYaml.js";

const router = express.Router();

router.post("/parse", analyzeYaml);
router.get("/ai-result/:requestId", getAiResult);

export default router;