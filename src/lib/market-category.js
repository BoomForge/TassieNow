// Descriptions can contain navigation or neighbouring event text. Classify the
// event's own title, and never mistake "marketing" or "supermarket" for a market.
export const isMarketEvent = name => /\b(?:markets?|marketplace)\b/i.test(String(name || ''));
