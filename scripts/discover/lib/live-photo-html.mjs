// Compare the actual visitor-facing <img> src against a verified photo URL.
// Wikimedia filenames may include percent-encoded spaces, commas or brackets.
// HTML attribute ampersands are escaped by template renderers, so compare
// normalized origins and paths rather than a decoded filename substring.
export function htmlContainsPhotoImage(html, imageUrl) {
  let expected;
  try {
    expected = new URL(imageUrl);
  } catch {
    return false;
  }
  for (const match of String(html).matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    try {
      const candidate = new URL(match[1].replace(/&amp;/gi, '&'), 'https://tassienow.com');
      if (candidate.origin === expected.origin &&
          decodeURIComponent(candidate.pathname) === decodeURIComponent(expected.pathname))
        return true;
    } catch {
      // Ignore malformed or unrelated image tags; do not accept a text mention.
    }
  }
  return false;
}
