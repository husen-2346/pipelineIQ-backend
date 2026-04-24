const estimateJobTime = (job) => {
  const steps = job.steps || [];

  if (!steps.length) return 30;

  return steps.reduce((total, step) => {
    const uses = (step.uses || "").toLowerCase();
    const run  = (step.run  || "").toLowerCase();

    if (run.includes("npm install") || run.includes("npm ci") ||
        run.includes("pnpm install") || run.includes("yarn install"))
      return total + 60;

    if (run.includes("npm run build") || run.includes("pnpm build") ||
        run.includes("yarn build")    || run.includes("vite build") ||
        run.includes("webpack"))
      return total + 45;

    if (run.includes("test")   || run.includes("jest") ||
        run.includes("vitest") || run.includes("pytest") ||
        run.includes("mocha"))
      return total + 60;

    if (run.includes("lint")    || run.includes("tsc") ||
        run.includes("eslint")  || run.includes("prettier"))
      return total + 15;

    if (run.includes("docker build") || run.includes("docker push"))
      return total + 90;

    if (run.includes("deploy")  || run.includes("kubectl") ||
        run.includes("helm")    || run.includes("terraform"))
      return total + 60;

    if (uses.includes("cache"))    return total + 10;
    if (uses.includes("checkout")) return total + 5;
    if (uses.includes("setup-"))   return total + 10;

    return total + 15;
  }, 0);
};

const findCriticalPath = (graph) => {
  const memo = {};

  const dfs = (job) => {
    if (memo[job] !== undefined) return memo[job]; 

    const { deps, time } = graph[job];

    if (!deps.length) {
      memo[job] = time;
      return time;
    }

    let maxDepTime = 0;
    for (const dep of deps) {
      if (graph[dep]) maxDepTime = Math.max(maxDepTime, dfs(dep));
    }

    memo[job] = time + maxDepTime;
    return memo[job];
  };

  const keys = Object.keys(graph);
  if (!keys.length) return 0;

  return Math.max(...keys.map(dfs));
};

const buildGraph = (doc) => {
  const graph = {};

  for (const [jobName, job] of Object.entries(doc.jobs || {})) {
    graph[jobName] = {
      deps: job.needs ? [].concat(job.needs) : [],
      time: estimateJobTime(job),
    };
  }

  return graph;
};

export const estimateTime = (doc) => {
  const graph = buildGraph(doc);
  return findCriticalPath(graph);
};