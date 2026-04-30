/**
 * Count words in a string.
 */
exports.countWords = (text = '') => {
  if (typeof text !== 'string' || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * Rough token estimator (~0.75 words/token — Anthropic heuristic).
 */
exports.estimateTokens = (text = '') => {
  return Math.ceil(exports.countWords(text) / 0.75);
};

/**
 * Check if adding `newWords` would exceed the plan's word limit.
 */
exports.wouldExceedLimit = (used, limit, newWords) => {
  if (limit === Infinity || limit === -1) return false;
  return used + newWords > limit;
};
