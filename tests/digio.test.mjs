import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigioHtml, parseDigioReturn } from '../src/onboarding/digio-html.js';

const payload = { sdkSrc: 'https://ext.digio.in/sdk/v11/digio.js', environment: 'sandbox', requestId: 'KID1', identifier: 'ravi@example.com', accessTokenId: 'GWT1' };
const RET = 'https://onboarding.qodeinvest.com/mobile/digio-return';

test('the SDK page uses the redirection approach, not an iframe', () => {
  const html = buildDigioHtml({ ...payload, returnUrl: RET });
  assert.match(html, /is_redirection_approach:\s*true/);
  assert.match(html, /redirect_url:\s*cfg\.returnUrl/);
  assert.ok(html.includes(JSON.stringify(RET)), 'return URL is embedded in the page config');
  assert.doesNotMatch(html, /is_iframe/);
});

test('stray page errors are reported as logs, never as SDK errors', () => {
  const html = buildDigioHtml({ ...payload, returnUrl: RET });
  assert.doesNotMatch(html, /window\.onerror=function\(msg\)\{send\(\{type:'error'/);
  assert.doesNotMatch(html, /unhandledrejection',function\(e\)\{send\(\{type:'error'/);
});

test('parseDigioReturn ignores unrelated navigations', () => {
  assert.equal(parseDigioReturn('https://ext.digio.in/#/gateway/login/KID1', RET), null);
  assert.equal(parseDigioReturn('https://api.digitallocker.gov.in/public/oauth2/1/authorize?x=1', RET), null);
  assert.equal(parseDigioReturn('about:blank', RET), null);
});

test('parseDigioReturn reads a successful exit', () => {
  const r = parseDigioReturn(RET + '?status=success&digio_doc_id=KID1&message=KYC process completed', RET);
  assert.deepEqual(r, { type: 'return', status: 'success', docId: 'KID1', message: 'KYC process completed', errorCode: null });
});

test('parseDigioReturn reads a cancel and a termination', () => {
  const c = parseDigioReturn(RET + '?status=cancel&digio_doc_id=KID1&message=KYC%20Process%20Cancelled', RET);
  assert.equal(c.status, 'cancel');
  assert.equal(c.message, 'KYC Process Cancelled');
  assert.equal(c.errorCode, null);
  const t = parseDigioReturn(RET + '?status=cancel&digio_doc_id=KID1&message=Expired&error_code=TERMINATED', RET);
  assert.equal(t.errorCode, 'TERMINATED');
});

test('parseDigioReturn survives a malformed percent sequence', () => {
  const r = parseDigioReturn(RET + '?status=success&message=100%25%zz', RET);
  assert.equal(r.status, 'success');
  assert.equal(typeof r.message, 'string');
});
