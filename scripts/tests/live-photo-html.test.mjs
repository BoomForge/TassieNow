import test from 'node:test';
import assert from 'node:assert/strict';
import {htmlContainsPhotoImage} from '../discover/lib/live-photo-html.mjs';

const encodedPhoto='https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fd/Port_Arthur_Asylum%2C_Port_Arthur_Historic_Site%2C_Tasmania.jpg/1920px-Port_Arthur_Asylum%2C_Port_Arthur_Historic_Site%2C_Tasmania.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo';

test('finds Commons images with encoded commas and HTML-escaped query strings',()=>{
  const markup='<figure><img src="'+encodedPhoto.replaceAll('&','&amp;')+'" alt="Port Arthur Asylum"></figure>';
  assert.equal(htmlContainsPhotoImage(markup,encodedPhoto),true);
});

test('accepts equivalent URL encodings in the actual img element',()=>{
  const markup='<img src="'+encodedPhoto.replaceAll('%2C',',')+'">';
  assert.equal(htmlContainsPhotoImage(markup,encodedPhoto),true);
});

test('does not mistake image credits or other text for a rendered photo',()=>{
  assert.equal(htmlContainsPhotoImage('<meta content="'+encodedPhoto+'"><p>'+encodedPhoto+'</p>',encodedPhoto),false);
});

test('does not mistake another Wikimedia photograph for the expected one',()=>{
  const markup='<img src="https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b/not-the-target.jpg">';
  assert.equal(htmlContainsPhotoImage(markup,encodedPhoto),false);
});

test('rejects a lookalike file served from a different host',()=>{
  const markup='<img src="'+encodedPhoto.replace('thumb.wikimedia.org','example.org')+'">';
  assert.equal(htmlContainsPhotoImage(markup,encodedPhoto),false);
});

test('rejects malformed expected photo URLs',()=>{
  assert.equal(htmlContainsPhotoImage('<img src="https://example.org/a.jpg">','not a valid URL'),false);
});
