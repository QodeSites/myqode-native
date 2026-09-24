// HTML document loaded into the in-app WebView to run Digio's Web SDK. It
// mirrors the web wizard's SDK call (environment, callback, theme, then
// submit(requestId, identifier, accessTokenId)) with one difference: the
// REDIRECTION APPROACH. The web wizard lets the SDK open a popup window. A
// WebView has no popups, and Digio's own iframe mode still needs one for the
// DigiLocker leg (DigiLocker sends X-Frame-Options and cannot be framed), so
// inside the app the whole WebView navigates through Digio and DigiLocker and
// comes back to `returnUrl`. screens/verify.js intercepts that navigation and
// hands the result to the store; the server poll confirms the outcome.
export function buildDigioHtml(payload) {
  const cfg = JSON.stringify({
    sdkSrc: payload.sdkSrc,
    environment: payload.environment,
    requestId: payload.requestId,
    identifier: payload.identifier,
    accessTokenId: payload.accessTokenId || null,
    returnUrl: payload.returnUrl,
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Verification</title>
<style>
html,body{margin:0;height:100%;background:#F7F5E9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#37584F}
#s{padding:28px 22px;font-size:14px;line-height:1.5;text-align:center}
#s b{display:block;color:#002017;font-size:16px;margin-bottom:6px}
</style>
</head>
<body>
<div id="s"><b>Opening secure verification</b>This stays inside the myQode app.</div>
<script>
(function(){
  var cfg=${cfg};
  function send(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(e){}}
  function status(t){var s=document.getElementById('s');if(s)s.innerHTML=t;}
  // Stray exceptions (cross-origin scripts surface as "Script error.") are diagnostics,
  // not outcomes: report them as logs so they never tear the window down mid-flow.
  window.onerror=function(msg){send({type:'log',message:String(msg)});};
  window.addEventListener('unhandledrejection',function(e){send({type:'log',message:String(e&&e.reason)});});
  var sc=document.createElement('script');
  sc.src=cfg.sdkSrc;sc.async=true;
  sc.onload=function(){
    try{
      if(!window.Digio){send({type:'error',message:'sdk_missing'});return;}
      var d=new window.Digio({
        environment:cfg.environment,
        is_redirection_approach:true,
        redirect_url:cfg.returnUrl,
        redirect_timeout:1500,
        callback:function(r){send({type:'callback',response:r||null});},
        theme:{primaryColor:'#008455',secondaryColor:'#02422B'}
      });
      d.init();
      send({type:'opened'});
      d.submit(cfg.requestId,cfg.identifier,cfg.accessTokenId||undefined);
      status('');
    }catch(e){send({type:'error',message:(e&&e.message)||String(e)});}
  };
  sc.onerror=function(){send({type:'error',message:'sdk_load_failed'});};
  document.head.appendChild(sc);
  send({type:'loading'});
})();
</script>
</body>
</html>`;
}

// Digio's exit page appends "?status=success|cancel&digio_doc_id=…&message=…" (and
// "&error_code=TERMINATED" on a hard failure) to the return URL. The message is not
// URL-encoded by Digio, so decoding is best-effort. Returns null for any other URL.
export function parseDigioReturn(url, returnUrl) {
  if (!url || !returnUrl || !url.startsWith(returnUrl)) return null;
  const rest = url.slice(returnUrl.length).replace(/^[?&#]/, '');
  const q = {};
  rest.split('&').forEach(pair => {
    if (!pair) return;
    const i = pair.indexOf('=');
    const k = i === -1 ? pair : pair.slice(0, i);
    const v = i === -1 ? '' : pair.slice(i + 1);
    q[safeDecode(k)] = safeDecode(v);
  });
  return {
    type: 'return',
    status: q.status || 'unknown',
    docId: q.digio_doc_id || null,
    message: q.message || '',
    errorCode: q.error_code || null,
  };
}

function safeDecode(s) {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; }
}
