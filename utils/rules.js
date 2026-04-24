// Herustic rules

const testKeywords = ["test", "jest", "mocha", "pytest", "vitest"];

export const rules = [
  {
    id: "no-cache",
    message: "Add caching to speed up builds",
    impact: "High",
    check: (doc) =>
      doc?.jobs &&
      !Object.values(doc.jobs).some((job) =>
        job.steps?.some((step) => step.uses?.includes("cache")),
      ),
  },
  {
    id: "no-tests",
    message: "Add a test step",
    impact: "High",
    check: (doc) =>
      Object.values(doc.jobs || {}).every(
        (job) =>
          !job.steps?.some((step) =>
            testKeywords.some((kw) => step.run?.toLowerCase().includes(kw)),
          ),
      ),
  },
  {
    id: "no-node-version",
    message: "Specify Node version",
    impact: "Medium",
    check: (doc) =>
      !Object.values(doc.jobs || {}).some((job) =>
        job.steps?.some((step) => step.with?.["node-version"]),
      ),
  },
  {
    id: "no-parallelism",
    message: "Jobs can be parallelized to reduce CI time",
    impact: "High",
    check: (doc) => {
      const jobs = doc.jobs || {};
      return Object.values(jobs).every((job) => job.needs);
    },
  },
  {
    id: "duplicate-steps",
    message: "Duplicate steps found across jobs",
    impact: "Medium",
    check: (doc) => {
      const seen = new Set();
      let duplicate = false;

      Object.values(doc.jobs || {}).forEach((job) => {
        job.steps?.forEach((step) => {
          const key = step.run || step.uses;
          if (seen.has(key)) duplicate = true;
          else seen.add(key);
        });
      });

      return duplicate;
    },
  },
  {
    id: "large-job",
    message: "Job has too many steps, consider splitting",
    impact: "Medium",
    check: (doc) =>
      Object.values(doc.jobs || {}).some(
        (job) => (job.steps?.length || 0) > 10,
      ),
  },
  {
    id: "no-timeout",
    message: "Jobs should define timeout to avoid hanging",
    impact: "Medium",
    check: (doc) =>
      Object.values(doc.jobs || {}).some((job) => !job["timeout-minutes"]),
  },
  {
    id: "no-artifacts",
    message: "Consider using artifacts to reuse build outputs",
    impact: "Low",
    check: (doc) => !JSON.stringify(doc).includes("upload-artifact"),
  },
];
