// Strategy switch request — the same model and rules as the Zoho Forms / CRM flow (Strategy_Switch_Requests):
//   Full Switch    → whole holdings of the From strategies into ONE To strategy (no amounts)
//   Partial Switch → rupee amounts out of each strategy and into each strategy; totals must match, and no From
//                    amount may exceed that strategy's invested value (from the investor's Zoho record)
//   A strategy can never be on both sides. A strategy that a Pending request is already switching OUT of can't
//   be chosen again until that request is processed; other strategies can.
//   One strategy to move OUT of at a time (a new pick replaces the old one, and the form says so); the money can
//   go INTO one strategy or be split across two.
// Asked as three plain steps instead of the CRM form's Full / Partial choice:
//   1  who, and how much, is moving — the investor, the strategy to move out of, Full or Partial
//   2  where it goes — one strategy, or two with the amount split between them
//   3  review and confirm
// The switch type is derived, exactly as before: every From strategy moving in full into one To strategy is a
// Full Switch; anything else is sent as a Partial Switch with amounts.
// Data: GET/POST /api/mobile/services/switch-request. On the dev server the request is validated but not created.
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Field, CTA, useBackHandler } from '../ui';
import { Check, ChevronDown } from '../icons';
import { services } from '../api';
import { useLoad, Loading, ErrorBox } from './kit';

const STRATS = ['QAW', 'QTF', 'QGF'];
const NAMES = { QAW: 'Qode All Weather', QTF: 'Qode Tactical Fund', QGF: 'Qode Growth Fund' };
const PCTS = [25, 50, 75];   // Partial — 100% is Full
const STEPS = [['Switch from', ''], ['Switch to', 'Where the money goes'], ['Review', 'Check the details and send']];
const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = v => '₹' + Math.round(Number(v || 0)).toLocaleString('en-IN');
const digits = t => parseInt(String(t || '').replace(/\D/g, '') || '0', 10);
const initials = n => String(n || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'Q';
const Lbl = ({ children, style }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={[{ marginTop: 20, marginBottom: 8 }, style]}>{children}</Tx>;

// One selectable row: white card, circle tick on the right.
function Option({ title, sub, on, onPress, disabled, children, radio }) {
  return (
    <View style={{ marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? C.green : 'rgba(55,88,79,0.18)', backgroundColor: '#fff', opacity: disabled ? 0.45 : 1 }}>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityState={{ checked: !!on, disabled: !!disabled }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
        <View style={{ flex: 1 }}>
          <Tx f="play" w={600} s={14.5}>{title}</Tx>
          {!!sub && <Tx s={11.5} c={C.muted} style={{ marginTop: 2 }}>{sub}</Tx>}
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? C.green : 'rgba(55,88,79,0.3)', backgroundColor: on ? C.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {on && <Check s={11} c={C.gold} w={2.6} />}
        </View>
      </Pressable>
      {on && children ? <View style={{ paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 12 }}>{children}</View> : null}
    </View>
  );
}

function Seg({ items, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {items.map(([k, l]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? C.green : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent' }}>
            <Tx w={700} s={11.5} c={on ? C.cream : C.muted}>{l}</Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

// Amount for a Partial switch / a split: quick percentages of `base`, "Rest" (what is still unallocated, targets
// only), or a rupee figure (capped).
function AmountPick({ v, base, cap, limit, onChange }) {
  const isCustom = v.pct == null && v.rest !== true;
  const opts = [...PCTS.map(p => [String(p), p + '%']), ...(limit != null ? [['rest', 'Rest']] : []), ['custom', '₹ Amount']];
  const cur = v.rest ? 'rest' : v.pct != null ? String(v.pct) : 'custom';
  const shown = v.rest ? (limit || 0) : v.pct != null ? Math.round(base * v.pct) / 100 : digits(v.custom);
  return (
    <View>
      <Seg items={opts} value={cur} onChange={k => onChange(k === 'rest' ? { pct: null, custom: '', rest: true } : k === 'custom' ? { pct: null, custom: v.custom, rest: false } : { pct: Number(k), custom: '', rest: false })} />
      {isCustom
        ? <Field value={digits(v.custom) ? digits(v.custom).toLocaleString('en-IN') : ''} onChangeText={t => { let x = digits(t); const c = cap != null ? cap : limit != null ? Math.floor(limit) : null; if (c != null && x > c) x = c; onChange({ pct: null, custom: x ? String(x) : '', rest: false }); }} numeric s={20} prefix="₹" placeholder="0" style={{ marginTop: 10 }} />
        : <Tx s={11.5} c={C.muted} style={{ marginTop: 8 }}>{v.rest ? 'The rest' : v.pct + '%'} = <Amt s={12.5} c={C.ink}>{fmt(shown)}</Amt></Tx>}
    </View>
  );
}

export function SwitchForm({ onClose, preferName }) {
  // Answered from the warmed cache (instant); a background refresh replaces the data in place when it is stale.
  const [fresh, setFresh] = useState(null);
  const info = useLoad(() => services.switchRequestInfo(setFresh), []);
  const data = fresh || info.data;
  const investors = (data && data.investors) || [];
  // Family logins have one investor record per member: default to the person currently selected in the app.
  const norm = x => String(x || '').toLowerCase().replace(/^(mr|mrs|ms|dr)\.?\s+/, '').replace(/\s+/g, ' ').trim();
  const [invId, setInvId] = useState(null);
  const [pickInv, setPickInv] = useState(false);
  const inv = investors.find(i => i.id === invId) || investors.find(i => preferName && norm(i.legalName) === norm(preferName)) || investors[0] || null;
  const invested = (inv && inv.invested) || { QAW: 0, QTF: 0, QGF: 0 };
  const held = STRATS.filter(s => invested[s] > 0);
  // Pending requests (server: a list, each with from/to). An older server sent one request with no strategies —
  // then every strategy counts as taken, as that server enforced.
  const pendingList = !inv ? [] : Array.isArray(inv.pending) ? inv.pending : inv.pending ? [{ ...inv.pending, from: STRATS, to: [] }] : [];
  const pendingOut = new Set(pendingList.flatMap(p => p.from || []));
  const available = held.filter(s => !pendingOut.has(s));
  const totalInvested = STRATS.reduce((t, s) => t + (invested[s] || 0), 0);

  const [step, setStep] = useState(0);
  const [from, setFrom] = useState({});   // strategy → { all: bool, pct, custom }
  const [to, setTo] = useState({});       // strategy → { pct, custom, rest }
  const [st, setSt] = useState({ busy: false, err: '', done: null });

  // Android back inside the sheet: previous step first, then close.
  useBackHandler(() => { if (step > 0 && !st.done) { setStep(step - 1); setSt(s => ({ ...s, err: '' })); return true; } return false; });

  const fromList = STRATS.filter(s => from[s]);
  const fromAmt = s => { const c = from[s]; if (!c) return 0; if (c.all) return invested[s] || 0; return c.pct != null ? Math.round(invested[s] * c.pct) / 100 : Math.min(digits(c.custom), invested[s]); };
  const outTotal = fromList.reduce((t, s) => t + fromAmt(s), 0);
  const allFull = fromList.length > 0 && fromList.every(s => from[s].all);
  const toList = STRATS.filter(s => !fromList.includes(s) && to[s]);
  const splitNeeded = toList.length > 1;   // one target simply receives everything moving out
  const toFixed = s => { const c = to[s]; if (!c || c.rest) return 0; return c.pct != null ? Math.round(outTotal * c.pct) / 100 : digits(c.custom); };
  const toLimit = s => Math.max(0, outTotal - toList.filter(x => x !== s).reduce((t, x) => t + toFixed(x), 0));
  const toAmt = s => { const c = to[s]; if (!c) return 0; if (!splitNeeded) return outTotal; return c.rest ? toLimit(s) : Math.min(toFixed(s), toLimit(s)); };
  const totalTo = toList.reduce((t, s) => t + toAmt(s), 0);
  const balanced = Math.abs(outTotal - totalTo) < 0.5;
  const isFull = allFull && toList.length === 1;   // Full Switch in CRM terms

  const clearErr = () => setSt(s => ({ ...s, err: '' }));
  // One strategy per side: picking another replaces the current one (`replaced` names it for the message).
  const [replaced, setReplaced] = useState({ from: '', to: '' });
  const toggleFrom = s => {
    clearErr();
    const cur = STRATS.find(x => from[x]);
    setReplaced(r => ({ ...r, from: cur && cur !== s ? cur : '' }));
    setFrom(from[s] ? {} : { [s]: { all: true, pct: null, custom: '' } });
    setTo(m => { const n = { ...m }; delete n[s]; return n; });
  };
  // Targets: one, or several with a split — tick and untick freely.
  const toggleTo = s => { clearErr(); setTo(m => { const n = { ...m }; if (n[s]) delete n[s]; else n[s] = { pct: null, custom: '', rest: false }; return n; }); };
  const OneAtATime = ({ side }) => (
    <View style={{ marginBottom: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(218,189,56,0.45)', backgroundColor: 'rgba(218,189,56,0.08)' }}>
      <Tx s={11.5} c={C.muted} lh={1.5}>
        {replaced[side]
          ? <>Only one strategy can be selected at a time — <Tx w={700} s={11.5} c={C.ink}>{NAMES[STRATS.find(x => (side === 'from' ? from : to)[x])] || ''}</Tx> replaced {NAMES[replaced[side]]}.</>
          : side === 'from'
            ? 'Only one strategy can be selected at a time. To switch out of another as well, send a separate request.'
            : 'Only one strategy can be selected at a time. To move into another as well, send a separate request.'}
      </Tx>
    </View>
  );
  const choose = id => { setInvId(id); setPickInv(false); setFrom({}); setTo({}); setReplaced({ from: '', to: '' }); setStep(0); clearErr(); };

  const step1Err = () => {
    if (!fromList.length) return 'Choose the strategy to move out of.';
    const missing = fromList.find(s => !from[s].all && fromAmt(s) <= 0);
    if (missing) return `Choose how much of ${missing} to move.`;
    return '';
  };
  const step2Err = () => {
    if (!toList.length) return 'Choose where the money should go.';
    if (splitNeeded && !balanced) return `Split the full ${fmt(outTotal)} — ${fmt(Math.abs(outTotal - totalTo))} is ${totalTo < outTotal ? 'still to allocate' : 'over'}.`;
    return '';
  };
  const next = () => { const e = step === 0 ? step1Err() : step2Err(); if (e) return setSt(s => ({ ...s, err: e })); clearErr(); setStep(step + 1); };

  const submit = async () => {
    if (st.busy) return;
    const e = step1Err() || step2Err();
    if (e) return setSt(s => ({ ...s, err: e }));
    setSt({ busy: true, err: '', done: null });
    try {
      const body = isFull
        ? { switchType: 'Full Switch', from: fromList, to: toList }
        : { switchType: 'Partial Switch', fromAmounts: Object.fromEntries(fromList.map(s => [s, fromAmt(s)])), toAmounts: Object.fromEntries(toList.map(s => [s, toAmt(s)])) };
      const r = await services.submitSwitchRequest({ investorId: inv.id, ...body });
      setSt({ busy: false, err: '', done: r });
    } catch (x) { setSt({ busy: false, err: x.message, done: null }); }
  };

  if (info.loading) return <View style={{ marginTop: 16 }}><Loading rows={2} h={60} /></View>;
  if (info.err) return <View style={{ marginTop: 16 }}><ErrorBox msg={info.err} onRetry={info.reload} /></View>;
  if (!inv) return <Tx s={12.5} c={C.muted} lh={1.6} style={{ marginTop: 16 }}>{(data && data.message) || 'We could not find your investor record. Please contact Investor Relations.'}</Tx>;

  // Investor card; with a family, tapping it opens the list of members.
  const investorCard = (
    <View>
      <Lbl style={{ marginTop: 16 }}>INVESTOR</Lbl>
      <Pressable onPress={investors.length > 1 ? () => setPickInv(v => !v) : undefined} accessibilityRole={investors.length > 1 ? 'button' : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(55,88,79,0.18)', backgroundColor: '#fff' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(2,66,43,0.08)', alignItems: 'center', justifyContent: 'center' }}><Tx w={700} s={13} c={C.green}>{initials(inv.legalName)}</Tx></View>
        <View style={{ flex: 1 }}>
          <Tx f="play" w={600} s={14.5}>{inv.legalName}</Tx>
          <Tx s={11.5} c={C.muted} style={{ marginTop: 2 }}>Total invested {fmt0(totalInvested)}</Tx>
        </View>
        {investors.length > 1 && <View style={{ transform: [{ rotate: pickInv ? '180deg' : '0deg' }] }}><ChevronDown s={11} c={C.muted} /></View>}
      </Pressable>
      {pickInv && (
        <View style={{ marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(55,88,79,0.18)', backgroundColor: '#fff', overflow: 'hidden' }}>
          {investors.map((i, k) => (
            <Pressable key={i.id} onPress={() => choose(i.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: k ? 1 : 0, borderColor: C.hairline }}>
              <View style={{ flex: 1 }}>
                <Tx w={i.id === inv.id ? 700 : 400} s={13}>{i.legalName}</Tx>
                {(Array.isArray(i.pending) ? i.pending.length > 0 : !!i.pending) && <Tx s={11} c={C.gold}>Request pending</Tx>}
              </View>
              {i.id === inv.id && <Check s={12} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // Requests in progress, named by strategy. Shown above the choices; those strategies are greyed out below.
  const pendingCard = pendingList.length > 0 && (
    <View style={{ marginTop: 14, borderWidth: 1, borderColor: C.gold, backgroundColor: 'rgba(218,189,56,0.10)', borderRadius: 12, padding: 14 }}>
      <Tx w={700} s={13}>{pendingList.length === 1 ? 'A switch request is already in progress' : `${pendingList.length} switch requests are already in progress`}</Tx>
      {pendingList.map((p, k) => (
        <Tx key={k} s={12} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>
          {(p.from || []).length ? (p.from.map(s => NAMES[s] || s).join(' + ') + (p.to && p.to.length ? ' → ' + p.to.map(s => NAMES[s] || s).join(' + ') : '')) : 'Switch request'}
          {' · '}submitted {p.requestDate ? String(p.requestDate).slice(0, 10) : 'recently'}{p.switchType ? ' · ' + p.switchType : ''}
        </Tx>
      ))}
      <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>{available.length ? 'A strategy with a request in progress can’t be chosen again until our team has processed it. You can still switch out of another strategy.' : 'Our team will reach out once it is processed; a new request can be made after that.'}</Tx>
    </View>
  );

  // Every strategy held is already in a request: nothing to choose.
  if (held.length > 0 && available.length === 0) {
    return (
      <View>
        {investorCard}
        {pendingCard}
        <CTA label="DONE" onPress={onClose} style={{ marginTop: 18 }} />
      </View>
    );
  }

  if (st.done) {
    const d = st.done;
    return (
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}><Check s={22} w={2.4} /></View>
        <Tx w={700} s={15} style={{ marginTop: 14 }}>{d.dryRun ? 'Switch request validated' : 'Switch request received'}</Tx>
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>
          {inv.legalName}: {fmt(outTotal)} from {fromList.join(' + ')} to {toList.map(s => (toList.length > 1 ? `${s} (${fmt(toAmt(s))})` : s)).join(' + ')}. Your relationship manager will confirm the details with you.
        </Tx>
        {d.dryRun && <Tx s={11} c={C.gold} lh={1.5} center style={{ marginTop: 10 }}>Test server: the request passed every check but was not sent to the CRM.</Tx>}
        {!!d.requestId && <Tx s={11} c={C.gray} style={{ marginTop: 10 }}>Reference {d.requestId}</Tx>}
        <CTA label="DONE" onPress={onClose} style={{ marginTop: 20, alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <View>
      {/* progress: three bars, the current step's title under them */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? C.gold : 'rgba(55,88,79,0.15)' }} />)}
      </View>
      <Tx w={700} s={10} ls={0.12} c={C.muted} style={{ marginTop: 10 }}>STEP {step + 1} OF 3 · {STEPS[step][0].toUpperCase()}</Tx>
      {!!STEPS[step][1] && <Tx s={12.5} c={C.ink} style={{ marginTop: 2 }}>{STEPS[step][1]}</Tx>}

      {step === 0 && (<>
        {investorCard}
        {pendingCard}
        <Lbl>MOVING FROM</Lbl>
        {available.length > 1 && <OneAtATime side="from" />}
        {held.length === 0 && <Tx s={12} c={C.muted}>No strategy holdings found on your investor record.</Tx>}
        {held.map(s => (
          <Option key={s} title={`${s} · ${NAMES[s]}`} disabled={pendingOut.has(s)}
            sub={pendingOut.has(s) ? 'Switch request already in progress' : `Invested ${fmt0(invested[s])}`} on={!!from[s]} onPress={() => toggleFrom(s)}>
            <Seg items={[['all', 'Full'], ['part', 'Partial']]} value={from[s] && from[s].all ? 'all' : 'part'}
              onChange={k => { clearErr(); setFrom(m => ({ ...m, [s]: { all: k === 'all', pct: null, custom: '' } })); }} />
            {from[s] && !from[s].all
              ? <View style={{ marginTop: 12 }}><AmountPick v={from[s]} base={invested[s]} cap={Math.floor(invested[s])} onChange={v => { clearErr(); setFrom(m => ({ ...m, [s]: { all: false, ...v } })); }} /></View>
              : <Tx s={11.5} c={C.muted} style={{ marginTop: 8 }}>Your whole {s} holding, <Amt s={12} c={C.ink}>{fmt(invested[s])}</Amt>, moves.</Tx>}
          </Option>
        ))}
      </>)}

      {step === 1 && (<>
        <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', padding: 14, borderRadius: 12, backgroundColor: 'rgba(2,66,43,0.06)' }}>
          <Tx w={700} s={10} ls={0.1} c={C.muted}>MOVING OUT</Tx>
          <Amt w={700} s={17}>{fmt(outTotal)}</Amt>
        </View>
        <Lbl>MOVING TO</Lbl>
        <Tx s={11.5} c={C.muted} lh={1.5} style={{ marginBottom: 10 }}>Choose one strategy, or two to split the amount between them.</Tx>
        {STRATS.filter(s => !fromList.includes(s)).map(s => (
          <Option key={s} title={`${s} · ${NAMES[s]}`} sub={invested[s] > 0 ? `You hold ${fmt0(invested[s])}` : 'New strategy for you'} on={!!to[s]} onPress={() => toggleTo(s)}>
            {splitNeeded
              ? <AmountPick v={to[s]} base={outTotal} limit={toLimit(s)} onChange={v => { clearErr(); setTo(m => ({ ...m, [s]: v })); }} />
              : <Tx s={11.5} c={C.muted}>Receives the full <Amt s={12} c={C.ink}>{fmt(outTotal)}</Amt>.</Tx>}
          </Option>
        ))}
        {splitNeeded && (
          <View style={{ marginTop: 4, borderRadius: 10, backgroundColor: balanced ? 'rgba(2,66,43,0.06)' : 'rgba(239,68,68,0.08)', paddingVertical: 10, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Tx s={11.5} c={C.muted}>Allocated</Tx><Amt s={12.5} c={balanced ? C.ink : C.red}>{fmt(totalTo)} of {fmt(outTotal)}</Amt></View>
            {!balanced && <Tx s={11} c={C.red} lh={1.4} style={{ marginTop: 4 }}>{totalTo < outTotal ? `${fmt(outTotal - totalTo)} still to allocate — use Rest on one strategy.` : `${fmt(totalTo - outTotal)} more than is moving out.`}</Tx>}
          </View>
        )}
      </>)}

      {step === 2 && (
        <View style={{ marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(55,88,79,0.18)', backgroundColor: '#fff', padding: 16 }}>
          <Tx w={700} s={10} ls={0.1} c={C.muted}>INVESTOR</Tx>
          <Tx f="play" w={600} s={14.5} style={{ marginTop: 3 }}>{inv.legalName}</Tx>
          <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 12 }} />
          <Tx w={700} s={10} ls={0.1} c={C.muted}>OUT OF</Tx>
          {fromList.map(s => (
            <View key={s} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Tx s={12.5}>{NAMES[s]}{from[s].all ? <Tx s={11} c={C.muted}>  · full</Tx> : null}</Tx>
              <Amt s={12.5}>{fmt(fromAmt(s))}</Amt>
            </View>
          ))}
          <Tx w={700} s={10} ls={0.1} c={C.muted} style={{ marginTop: 14 }}>INTO</Tx>
          {toList.map(s => (
            <View key={s} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Tx s={12.5}>{NAMES[s]}</Tx>
              <Amt s={12.5}>{fmt(toAmt(s))}</Amt>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14, paddingTop: 12, borderTopWidth: 1.5, borderColor: C.green }}>
            <Tx w={700} s={12}>Total switching</Tx>
            <Amt w={700} s={16}>{fmt(outTotal)}</Amt>
          </View>
          <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>Sent as a {isFull ? 'full' : 'partial'} switch.</Tx>
        </View>
      )}

      {!!st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 14 }}>{st.err}</Tx>}
      {step === 2 && <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>Invested values come from your investor record. One request can be open at a time; your relationship manager is notified when it is raised.</Tx>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        {step > 0 && <CTA label="BACK" outline onPress={() => { clearErr(); setStep(step - 1); }} style={{ flex: 1 }} />}
        {step < 2
          ? <CTA label={step === 0 ? 'CHOOSE WHERE IT GOES' : 'REVIEW'} onPress={next} style={{ flex: 2, opacity: (step === 0 ? step1Err() : step2Err()) ? 0.5 : 1 }} />
          : <CTA label={st.busy ? 'SENDING…' : 'CONFIRM SWITCH'} onPress={submit} style={{ flex: 2, opacity: st.busy ? 0.6 : 1 }} />}
      </View>
    </View>
  );
}
