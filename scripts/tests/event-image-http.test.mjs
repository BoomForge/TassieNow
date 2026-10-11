import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyImageResponse} from '../discover/lib/check-event-image-http.mjs';
test('only genuine HTTP image responses count as healthy photographs',()=>{
 assert.equal(classifyImageResponse(200,'image/jpeg'),'verified');
 assert.equal(classifyImageResponse(200,'image/webp'),'verified');
 assert.equal(classifyImageResponse(200,'text/html'),'broken');
 assert.equal(classifyImageResponse(404,'text/html'),'broken');
 assert.equal(classifyImageResponse(410,'text/html'),'broken');
});
test('blocked HEAD, unsupported HEAD and temporary throttling remain distinct',()=>{
 assert.equal(classifyImageResponse(403,'text/html'),'blocked');
 assert.equal(classifyImageResponse(405,''),'needs-get');
 assert.equal(classifyImageResponse(429,''),'retryable');
 assert.equal(classifyImageResponse(503,''),'retryable');
});
