/**
 * Dérive les top N points d'amélioration à partir des dimensions de scoring.
 * Utilise improvementFeedback.json pour résoudre (figure, metricKey) → message.
 */
const improvementFeedback = require("./improvementFeedback.json");

const FIGURE_ALIASES = {
  l_sit: "lsit",
  full_planche: "planche"
};

const DEFAULT_LIMIT = 3;
const DEFAULT_MIN_CONFIDENCE = 0.08;

function normalizeFigureName(name) {
  if (!name || typeof name !== "string") return "";
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return FIGURE_ALIASES[cleaned] || cleaned;
}

/**
 * À partir de l'objet dimensions (body_line, symmetry, lockout_extension avec .metrics[]),
 * retourne les N métriques les plus basses (score croissant) avec le message de feedback.
 *
 * @param {Record<string, { metrics: Array<{ name: string, score: number, confidence?: number }> }>} dimensions
 * @param {string} figure - Nom de la figure (ex. "lsit", "handstand")
 * @param {{ limit?: number, minConfidence?: number }} options
 * @returns {Array<{ message: string, metricKey: string, dimensionKey: string, score: number }>}
 */
function getTopImprovements(dimensions, figure, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  if (!dimensions || typeof dimensions !== "object") return [];
  const figureKey = normalizeFigureName(figure);
  const messagesByMetric = improvementFeedback[figureKey];
  if (!messagesByMetric) return [];

  const candidates = [];
  for (const [dimensionKey, dimension] of Object.entries(dimensions)) {
    const metrics = dimension?.metrics;
    if (!Array.isArray(metrics)) continue;
    for (const m of metrics) {
      const confidence = m.confidence ?? 1;
      if (confidence < minConfidence) continue;
      candidates.push({
        dimensionKey,
        metricKey: m.name,
        score: typeof m.score === "number" ? m.score : 0,
        confidence
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  const top = candidates.slice(0, limit);

  return top.map(({ dimensionKey, metricKey, score }) => ({
    message: messagesByMetric[metricKey] ?? `Améliorer: ${metricKey}`,
    metricKey,
    dimensionKey,
    score: Math.round(score * 100) / 100
  }));
}

module.exports = {
  getTopImprovements,
  normalizeFigureName,
  improvementFeedback
};
