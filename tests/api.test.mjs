import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadDocument } from '../src/onboarding/api.js';

// Expo SDK 57 replaces global fetch with expo/fetch, whose multipart encoder rejects React
// Native's { uri, name, type } parts ("Unsupported FormDataPart implementation"). The upload
// must therefore hand fetch a real Blob-like part. Node's fetch can read a data: URI, which
// stands in for the picker's file:// URI here.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('uploadDocument sends the file as a Blob part, never a {uri} object', async () => {
  const realFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('data:')) return realFetch(url, init);
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, upload: { id: 'up_1', fieldKey: 'doc_cancelled_cheque', originalName: 'cheque.png', sizeBytes: 70, url: '/api/files/up_1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const r = await uploadDocument('sub_1', 'doc_cancelled_cheque', { uri: PNG, name: 'cheque.png', mimeType: 'image/png', size: 70 });
    assert.equal(r.upload.id, 'up_1');
    assert.ok(captured, 'the API was called');
    assert.match(captured.url, /\/api\/upload$/);
    const fd = captured.init.body;
    assert.ok(fd instanceof FormData, 'body is a FormData');
    assert.equal(fd.get('submissionId'), 'sub_1');
    assert.equal(fd.get('fieldKey'), 'doc_cancelled_cheque');
    const part = fd.get('file');
    assert.ok(part instanceof Blob, 'file part is a Blob, not a {uri} object');
    assert.equal(part.type, 'image/png');
    assert.equal(part.name, 'cheque.png');
    assert.ok(part.size > 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
