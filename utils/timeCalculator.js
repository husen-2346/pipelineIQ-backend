
export const estimateTime = (doc) => {
  let total = 0;

  Object.values(doc.jobs || {}).forEach((job) => {
    job.steps?.forEach((step) => {
      const run = step.run?.toLowerCase() || "";

      if (run.includes("install")) total += 60;
      else if (run.includes("build")) total += 120;
      else if (run.includes("test")) total += 90;
      else if (run.includes("lint")) total += 30;
      else total += 20;
    });
  });

  return total;
};


export const calculateScore = (suggestions) => {
  let score = 100;

  suggestions.forEach((s) => {
    if (s.impact === "High") score -= 20;
    else if (s.impact === "Medium") score -= 10;
  });

  return Math.max(score, 0);
};


export const optimizeYaml = (doc, suggestions) => {
  const newDoc = JSON.parse(JSON.stringify(doc)); 

  Object.values(newDoc.jobs || {}).forEach((job) => {
    job.steps = job.steps || [];

    suggestions.forEach((s) => {
      if (s.id === "no-tests") {
        job.steps.push({
          name: "Run Tests",
          run: "npm test",
        });
      }

      if (s.id === "no-cache") {
        job.steps.unshift({
          name: "Cache Dependencies",
          uses: "actions/cache@v3",
        });
      }
    });
  });

  return newDoc;
};