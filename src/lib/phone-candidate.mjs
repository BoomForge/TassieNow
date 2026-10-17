/** Extract plausible Australian numbers, never digit fragments from geocoordinates. */
export function phoneFromText(text = '') {
  const phonePattern = /(?<![\d.])(?:(?:\+61\s?[2-478]|0[2-478])(?:[\s.-]?\d){8}|1[38]00(?:[\s.-]?\d){6}|04(?:[\s.-]?\d){8})(?!\d)/g;
  return String(text).match(phonePattern)?.[0]?.trim() || null;
}
