// HTML document loaded into the in-app WebView to run Digio's Web SDK. It
// mirrors the web wizard's SDK call exactly (environment, callback, theme,
// then submit(requestId, identifier, accessTokenId)) and reports everything
// back to React Native through window.ReactNativeWebView.postMessage.
export function buildDigioHtml(payload) {
  const cfg = JSON.stringify({
    sdkSrc: payload.sdkSrc,
    environment: payload.environment,
    requestId: payload.requestId,
    identifier: payload.identifier,
    accessTokenId: payload.accessTokenId || null,
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
  window.onerror=function(msg){send({type:'error',message:String(msg)});};
  window.addEventListener('unhandledrejection',function(e){send({type:'error',message:String(e&&e.reason)});});
  var sc=document.createElement('script');
  sc.src=cfg.sdkSrc;sc.async=true;
  sc.onload=function(){
    try{
      if(!window.Digio){send({type:'error',message:'sdk_missing'});return;}
      // is_iframe: the SDK's default is window.open(), which mobile WebViews
      // refuse (iOS returns null, nothing appears). The iframe mode renders
      // the same flow inline in this page with camera/microphone allowed.
      var d=new window.Digio({
        environment:cfg.environment,
        is_iframe:true,
        callback:function(r){send({type:'callback',response:r||null});},
        theme:{primaryColor:'#008455',secondaryColor:'#02422B'}
      });
      d.init();
      d.submit(cfg.requestId,cfg.identifier,cfg.accessTokenId||undefined);
      status('');
      send({type:'opened'});
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
