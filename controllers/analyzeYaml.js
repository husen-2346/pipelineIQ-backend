import yaml from "js-yaml";
import { rules } from "../utils/rules.js";
import { estimateTime } from "../utils/timeCalculator.js";
import { detectExecutionFlow } from "../utils/execution.js";
import { sanitizeYaml } from "../utils/sanitizeYaml.js";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey:
    process.env.PIPELINE_KEY
});

const aiResultsStore = new Map();

/* -------------------- FIXERS -------------------- */

// Fix run: | indentation + multi-commands
const normalizeRunBlocks = (yamlStr) => {
  return (
    yamlStr
      // Fix inline "run: | command"
      .replace(/(^\s*-?\s*run:\s*\|)\s*(\S.*)/gm, (match, prefix, cmd) => {
        const indent = prefix.match(/^\s*/)[0];
        return `${prefix}\n${indent}  ${cmd}`;
      })

      // Split && into multiple lines
      .replace(
        /(^\s*-?\s*run:\s*\|\n)(\s*)([^\n]*&&[^\n]*)/gm,
        (match, start, indent, cmds) => {
          const lines = cmds.split("&&").map((c) => `${indent}${c.trim()}`);
          return start + lines.join("\n");
        },
      )

      // Fix extra braces
      .replace(/\{\$\{\{/g, "${{")
      .replace(/=\{\$\{\{/g, "=${{")
  );
};

// Fix missing indentation under run blocks
const fixIndentation = (yamlStr) => {
  return yamlStr.replace(/\n(\s*)(pnpm|npm|yarn)/g, (match, spaces, cmd) => {
    return "\n" + spaces + "  " + cmd;
  });
};

/* -------------------- MAIN API -------------------- */

export const analyzeYaml = async (req, res) => {
  try {
    const { yamlContent } = req.body;

    if (!yamlContent) {
      return res.status(400).json({ error: "YAML required" });
    }

    const requestId = Date.now().toString();

    let parsed;
    try {
      parsed = yaml.load(yamlContent);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: "Invalid YAML format",
      });
    }

    // Fast rule-based suggestions
    const suggestions = rules
      .filter((rule) => rule.check(parsed))
      .map((rule) => ({
        id: rule.id,
        message: rule.message,
        impact: rule.impact,
      }));

    const estimatedTime = estimateTime(parsed);
    const execution = detectExecutionFlow(parsed);

    // Respond immediately
    res.json({
      success: true,
      requestId,
      parsed,
      estimatedTime,
      execution,
      suggestions,
      aiStatus: "processing",
    });

    /* ---------- BACKGROUND AI ---------- */
    (async () => {
      try {
        const structuredIssues = suggestions.map((s) => ({
          issue: s.message,
          impact: s.impact,
          fix: `Fix this issue in the YAML`,
        }));

        const [suggestResult, rewriteResult] = await Promise.allSettled([
          openai.chat.completions.create({
            model: "anthropic/claude-3-haiku",
            max_tokens: 800,
            messages: [
              {
                role: "system",
                content: `You are a CI/CD optimizer. Analyze the YAML and return EXACTLY 5 issues. Return STRICT JSON array: [ { "issue": "short issue", "impact": "low | medium | high", "fix": "clear actionable fix" } ] Rules: - issue <= 10 words - fix must be executable - focus on caching, duplication, performance`,
              },
              {
                role: "user",
                content: yamlContent,
              },
            ],
          }),

          openai.chat.completions.create({
            model: "anthropic/claude-3-haiku",
            max_tokens: 2000,
            messages: [
              {
                role: "system",
                content: `You are a CI/CD expert. Rewrite the GitHub Actions YAML. STRICT RULES: - Output ONLY valid YAML - No explanations GOAL: - Fix ALL provided issues - Reduce inefficiencies - Improve performance STRUCTURE: - Separate logical steps - Allow restructuring (matrix, parallel jobs, caching) RUN RULES: - Single command → run: command - Multi command → run: | cmd1 cmd2 SYNTAX: - "uses:" must NOT have "run:" - 2-space indentation - Valid GitHub Actions syntax Return ONLY YAML.`,
              },
              {
                role: "user",
                content: `YAML:\n${yamlContent}

Issues:
${JSON.stringify(structuredIssues, null, 2)}`,
              },
            ],
          }),
        ]);

        let aiSuggestions = [];
        let aiOptimizedYaml = null;

        // Parse suggestions
        if (suggestResult.status === "fulfilled") {
          try {
            aiSuggestions = JSON.parse(
              suggestResult.value.choices[0]?.message?.content || "[]",
            );
          } catch {}
        }

        // Process YAML
        if (rewriteResult.status === "fulfilled") {
          const raw = rewriteResult.value.choices[0]?.message?.content || "";
          let cleaned = sanitizeYaml(raw);
          cleaned = normalizeRunBlocks(cleaned);
          cleaned = fixIndentation(cleaned);

          aiOptimizedYaml = cleaned;
        }

        // Compute improvement
        let improvement = 0;
        try {
          const newParsed = yaml.load(aiOptimizedYaml || "");
          const newIssues = rules.filter((r) => r.check(newParsed)).length;

          if (suggestions.length > 0) {
            improvement =
              ((suggestions.length - newIssues) / suggestions.length) * 100;
          }
        } catch {}

        // Store result
        aiResultsStore.set(requestId, {
          aiSuggestions,
          aiOptimizedYaml,
          improvement,
          status: "done",
        });
      } catch (err) {
        aiResultsStore.set(requestId, {
          status: "error",
          error: err.message,
        });
      }
    })();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const getAiResult = (req, res) => {
  const { requestId } = req.params;

  const result = aiResultsStore.get(requestId);

  if (!result) {
    return res.json({ status: "processing" });
  }

  return res.json(result);
};
