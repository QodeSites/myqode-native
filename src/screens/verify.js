// In-app verification sheet: hosts Digio's Web SDK inside a WebView so the
// investor never leaves myQode. Handles loading, SDK errors, slow polling,
// terminal failures and the manual-upload fallback.
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Modal, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Tx, CTA } from '../ui';
import { Check } from '../icons';
import { buildDigioHtml, parseDigioReturn } from '../onboarding/digio-html';
import { API_BASE } from '../onboarding/config';

const ALLOWED = /^(https?:|about:blank)/i;
// Where Digio's exit page sends the WebView when the flow ends (redirection approach, see
// digio-html.js). Never actually loaded: onShouldStartLoadWithRequest intercepts it below.
const RETURN_URL = API_BASE + '/mobile/digio-return';

function Pill({ label, bg = C.gold, fg = C.ink }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Tx w={700} s={8.5} ls={0.12} c={fg}>{label}</Tx>
    </View>
  );
}

function Panel({ icon, title, body, children }) {
  return (
    <View style={{ padding: 22, alignItems: 'center' }}>
      {icon}
      <Tx f="play" w={600} s={20} center style={{ marginTop: 14 }}>{title}</Tx>
      <Tx s={12.5} c={C.muted} lh={1.55} center style={{ marginTop: 8 }}>{body}</Tx>
      <View style={{ alignSelf: 'stretch', marginTop: 18 }}>{children}</View>
    </View>
  );
}

export default function VerifySheet({ open, check, title, subtitle, onClose, onManual, onRetry, onEvent, onKeepWaiting }) {
  const insets = useSafeAreaInsets();
  const H = Dimensions.get('window').height;
  const [reloadKey, setReloadKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const webref = useRef(null);
  const active = check && check.checkId && !check.done && !check.failed && !check.timedOut;

  useEffect(() => {
    if (!open || !active) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - (check.startedAt || Date.now())) / 1000)), 1000);
    return () => clearInterval(id);
  }, [open, active, check && check.startedAt]);

  const html = useMemo(() => (check && check.sdkSrc ? buildDigioHtml({ ...check, returnUrl: RETURN_URL }) : null), [check && check.requestId, check && check.accessTokenId, check && check.sdkSrc]);

  if (!open) return null;
  const mm = String(Math.floor(elapsed / 60)).padStart(1, '0'), ss = String(elapsed % 60).padStart(2, '0');

  const onMessage = e => {
    let msg = null;
    try { msg = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    onEvent && onEvent(msg);
  };
  const retryWindow = () => { setReloadKey(k => k + 1); onEvent && onEvent({ type: 'opened' }); };

  let body;
  if (!check || check.starting) {
    body = (
      <Panel icon={<ActivityIndicator color={C.green} />} title="Getting things ready" body="Setting up a secure verification session. This only takes a moment." />
    );
  } else if (check.done) {
    body = (
      <Panel
        icon={<View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}><Check s={26} c={C.gold} w={2.4} /></View>}
        title={check.purpose === 'bank' ? 'Bank account verified' : 'Identity verified'}
        body={check.purpose === 'bank'
          ? 'Your bank details are confirmed. No cancelled cheque is needed.'
          : 'Your details have been filled in from DigiLocker. Anything we fetched is locked and marked as verified.'}
      >
        <CTA label="CONTINUE" onPress={onClose} />
      </Panel>
    );
  } else if (check.error && !check.checkId) {
    body = (
      <Panel icon={<Tx f="play" w={600} s={30} c={C.gold}>!</Tx>} title="We couldn’t start verification" body={check.error}>
        {check.errorCode !== 'unavailable' && <CTA label="TRY AGAIN" onPress={onRetry} />}
        <CTA label="UPLOAD DOCUMENTS INSTEAD" onPress={onManual} outline style={{ marginTop: 10 }} />
      </Panel>
    );
  } else if (check.failed || check.timedOut) {
    body = (
      <Panel icon={<Tx f="play" w={600} s={30} c={C.gold}>!</Tx>} title={check.timedOut ? 'Still waiting on DigiLocker' : 'Verification not completed'} body={check.error}>
        {check.timedOut && <CTA label="KEEP WAITING" onPress={onKeepWaiting} outline />}
        <CTA label="TRY AGAIN" onPress={onRetry} style={{ marginTop: check.timedOut ? 10 : 0 }} />
        <CTA label="UPLOAD DOCUMENTS INSTEAD" onPress={onManual} outline style={{ marginTop: 10 }} />
      </Panel>
    );
  } else if (check.sdkCancelled) {
    body = (
      <Panel icon={<Tx f="play" w={600} s={30} c={C.gold}>!</Tx>} title="You closed the verification window" body="Nothing was submitted. Reopen it to pick up where you left off, or upload your documents instead.">
        <CTA label="REOPEN VERIFICATION" onPress={retryWindow} />
        <CTA label="UPLOAD DOCUMENTS INSTEAD" onPress={onManual} outline style={{ marginTop: 10 }} />
      </Panel>
    );
  } else if (check.sdkError) {
    body = (
      <Panel icon={<Tx f="play" w={600} s={30} c={C.gold}>!</Tx>} title="Something interrupted the window" body={check.sdkError + ' If you already completed the steps, we are still checking with DigiLocker in the background.'}>
        <CTA label="REOPEN VERIFICATION" onPress={retryWindow} />
        <CTA label="UPLOAD DOCUMENTS INSTEAD" onPress={onManual} outline style={{ marginTop: 10 }} />
      </Panel>
    );
  } else if (check.sdkResponded) {
    // Digio's exit page has sent us back with status=success; the server poll now confirms
    // it and fetches the verified details. Hide the WebView so the stale exit page is not seen.
    body = (
      <Panel
        icon={<ActivityIndicator color={C.green} />}
        title={check.purpose === 'bank' ? 'Confirming your bank account' : 'Confirming with DigiLocker'}
        body="Digio has finished. We're fetching your verified details now — this usually takes a few seconds."
      >
        <Pressable onPress={onManual} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Tx w={700} s={11.5} c={C.green}>Taking too long? Upload documents instead →</Tx>
        </Pressable>
      </Panel>
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        {check.slow && (
          <View style={{ margin: 14, marginBottom: 0, backgroundColor: 'rgba(218,189,56,0.28)', borderWidth: 1, borderColor: 'rgba(218,189,56,0.6)', borderRadius: 10, padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Tx w={700} s={13}>This is taking longer than usual</Tx>
              <Pill label={`${mm}:${ss} · IN PROGRESS`} bg={C.ink} fg={C.cream} />
            </View>
            <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 4 }}>You can keep going here, or continue and upload your documents instead. Nothing you entered is lost.</Tx>
            <CTA label="CONTINUE MANUALLY" onPress={onManual} outline style={{ marginTop: 10, paddingVertical: 10 }} />
          </View>
        )}
        <View style={{ flex: 1, margin: 14, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', backgroundColor: '#fff' }}>
          {html ? (
            <WebView
              key={`${check.checkId}-${reloadKey}`}
              ref={webref}
              source={{ html, baseUrl: API_BASE }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grant"
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures={false}
              startInLoadingState
              renderLoading={() => (
                <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                  <ActivityIndicator color={C.green} />
                </View>
              )}
              onMessage={onMessage}
              onShouldStartLoadWithRequest={req => {
                // Digio's exit page redirecting to our return URL: the flow is over. Report
                // the outcome and keep the (non-existent) page from loading.
                const ret = parseDigioReturn(req.url, RETURN_URL);
                if (ret) { onEvent && onEvent(ret); return false; }
                if (ALLOWED.test(req.url)) return true;
                // tel:, mailto:, intent:, upi: and app-store links would pull the
                // investor out of the app; keep everything inside this window.
                return false;
              }}
              onError={e => onEvent && onEvent({ type: 'error', message: (e.nativeEvent && e.nativeEvent.description) || 'load_error' })}
              onHttpError={e => { if (e.nativeEvent && e.nativeEvent.statusCode >= 500) onEvent && onEvent({ type: 'error', message: 'sdk_load_failed' }); }}
              onRenderProcessGone={() => onEvent && onEvent({ type: 'error', message: 'sdk_missing' })}
              onContentProcessDidTerminate={() => onEvent && onEvent({ type: 'error', message: 'sdk_missing' })}
              style={{ flex: 1, backgroundColor: '#fff' }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.green} /></View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingBottom: 6 }}>
          <ActivityIndicator size="small" color={C.gold} />
          <Tx s={12} c={C.muted} style={{ flex: 1 }}>
            {check.mock ? 'Demo mode: results arrive instantly.' : 'Waiting for confirmation… we check every few seconds.'}
          </Tx>
          <Tx w={700} s={11} c={C.muted}>{mm}:{ss}</Tx>
        </View>
        <Pressable onPress={onManual} style={{ paddingHorizontal: 22, paddingVertical: 10 }}>
          <Tx w={700} s={11.5} c={C.green}>Having trouble? Upload documents instead →</Tx>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,32,23,0.55)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{
          backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: Math.round(H * 0.86),
          paddingBottom: Math.max(insets.bottom, 12),
          shadowColor: C.ink, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 16,
        }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.mutedBorder }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Tx f="play" w={600} s={21}>{title}</Tx>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Tx s={12} c={C.muted}>{subtitle}</Tx>
                {check && check.mock ? <Pill label="DEMO" bg="rgba(55,88,79,0.15)" fg={C.muted} /> : null}
              </View>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, marginRight: -12, marginTop: -8, alignItems: 'center', justifyContent: 'center' }}>
              <Tx s={22} c={C.muted}>×</Tx>
            </Pressable>
          </View>
          {body}
          {active && !check.done && (
            <Tx s={10.5} c={C.gray} center style={{ paddingHorizontal: 22, paddingTop: 4 }}>
              Closing this window won’t cancel anything — we keep checking in the background.
            </Tx>
          )}
        </View>
      </View>
    </Modal>
  );
}
