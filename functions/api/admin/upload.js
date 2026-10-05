import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { writeUploadedImage } from '../../_lib/github.js';
import { cleanText, jsonError } from '../../_lib/db.js';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

function matchesMagic(bytes, type) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth) return auth;
  if (!sameOrigin(context.request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });

  try {
    const form = await context.request.formData();
    const file = form.get('file');
    const label = cleanText(form.get('label') || 'image', 120);
    if (!(file instanceof File)) return Response.json({ error: 'Choose an image to upload' }, { status: 400 });
    if (!TYPES.has(file.type)) return Response.json({ error: 'Use a JPG, PNG or WebP image' }, { status: 400 });
    if (!file.size || file.size > MAX_BYTES) return Response.json({ error: 'Image must be smaller than 5 MB' }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesMagic(bytes, file.type)) return Response.json({ error: 'The uploaded file does not appear to be a valid image' }, { status: 400 });

    const result = await writeUploadedImage(context, bytes, { extension: TYPES.get(file.type), label });
    const url = new URL(result.url, context.request.url).href;
    return Response.json({ ok: true, url, path: result.path, deploymentRequired: true }, { status: 201 });
  } catch (error) {
    return jsonError(error, error?.message?.includes('GitHub') ? 503 : 400);
  }
}
