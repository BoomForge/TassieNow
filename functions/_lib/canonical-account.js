// Keep authentication on the hostname authorised by Turnstile and its cookies.
export function canonicalAccount(context) {
  const url = new URL(context.request.url);
  if (url.hostname !== 'tassienow.pages.dev') return context.next();
  url.protocol = 'https:';
  url.hostname = 'tassienow.com';
  url.port = '';
  return new Response(null, {
    status: 308,
    headers: { Location: url.href, 'Cache-Control': 'no-store' }
  });
}
