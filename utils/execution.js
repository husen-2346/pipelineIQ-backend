// detect the execution flow
export const detectExecutionFlow = (parsedYaml) => {
  const jobs = parsedYaml.jobs || {};
  const jobNames = Object.keys(jobs);
  
  const graph = {};
  const inDegree = {};

  // Initialize
  jobNames.forEach((job) => {
    graph[job] = [];
    inDegree[job] = 0;
  });

  //  Build the Graph
  jobNames.forEach((job) => {
    const deps = jobs[job].needs || [];
    const dependencies = Array.isArray(deps) ? deps : [deps];

    dependencies.forEach((dep) => {
      if (graph[dep]) { 
        graph[dep].push(job);
        inDegree[job]++;
      }
    });
  });

  //  The Topological Sort (Kahn's Algorithm)
  const queue = [];
  const layers = [];

  Object.keys(inDegree).forEach((job) => {
    if (inDegree[job] === 0) queue.push(job);
  });

  while (queue.length) {
    const currentLayer = [...queue];
    layers.push(currentLayer);
    const nextQueue = [];

    currentLayer.forEach((job) => {
      (graph[job] || []).forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          nextQueue.push(neighbor);
        }
      });
    });
    queue.splice(0, queue.length, ...nextQueue);
  }

  //  Return the Analysis
  if (layers.length === 1) {
    return { type: "parallel", layers, details: ["Fully parallel execution"] };
  }
  if (layers.every(layer => layer.length === 1)) {
    return { type: "sequential", layers, details: ["Fully sequential execution"] };
  }
  return { type: "dag", layers, details: [`${layers.length} execution stages`] };
};