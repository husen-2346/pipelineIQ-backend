import express from "express";
import { analyzeYaml } from "../controllers/analyzeYaml.js";

const router = express.Router();

router.post("/parse", analyzeYaml);

export default router;