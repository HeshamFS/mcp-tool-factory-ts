/**
 * Vitest global setup — suppress AI SDK warning logs in tests.
 */

// The AI SDK emits console warnings for unsupported features (e.g. temperature
// on reasoning models).  These are noisy in test output and not actionable here.
globalThis.AI_SDK_LOG_WARNINGS = false;
