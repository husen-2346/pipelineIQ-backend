export const rules = [
  {
    id: "no-cache",
    message: "Add caching to speed up builds",
    impact: "High",
    check: (doc) =>
      !doc?.jobs &&
      !Object.values(doc.jobs || {}).some((job) =>
        job.steps?.some((step) => step.uses?.includes("cache"))
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
            step.run?.toLowerCase().includes("test")
          )
      ),
  },
  {
    id: "no-node-version",
    message: "Specify Node version",
    impact: "Medium",
    check: (doc) =>
      !JSON.stringify(doc).includes("node-version"),
  },
];