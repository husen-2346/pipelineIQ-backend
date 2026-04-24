import yaml from "js-yaml";
import pkg from 'deep-diff';
const { diff } = pkg;
import { rules } from "../utils/rules.js";
import { estimateTime, calculateScore, optimizeYaml } from "../utils/timeCalculator.js";

export const analyzeYaml = (req, res) => {
  try {
    const { yamlContent } = req.body;

    if (!yamlContent) {
      return res.status(400).json({ error: "YAML required" });
    }

    // Parse
    const parsed = yaml.load(yamlContent);

    // Suggestions
    const suggestions = rules
      .filter((rule) => rule.check(parsed))
      .map((rule) => ({
        id: rule.id,
        message: rule.message,
        impact: rule.impact,
      }));

    // Time estimation
    const estimatedTime = estimateTime(parsed);

    // Score
    const score = calculateScore(suggestions);

    // Optimize
    const optimizedDoc = optimizeYaml(parsed, suggestions);

    // Convert back to YAML
    const optimizedYaml = yaml.dump(optimizedDoc);

    // Diff
    const differences = diff(parsed, optimizedDoc) || [];

    return res.json({
      success: true,
      parsed,
      estimatedTime,
      suggestions,
      score,
      optimizedYaml,
      diff: differences,
    });

  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};