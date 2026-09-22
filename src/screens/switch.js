// Strategy switch request — the same model and rules as the Zoho Forms / CRM flow (Strategy_Switch_Requests):
//   Full Switch    → tick the strategies to move OUT of and the strategies to move INTO (whole holdings, no amounts)
//   Partial Switch → rupee amounts out of each strategy and into each strategy; totals must match, and no From
//                    amount may exceed that strategy's invested value (from the investor's Zoho record)
//   A strategy can never be on both sides; only one Pending request at a time.
// Data: GET/POST /api/mobile/services/switch-request. On the dev server the request is validated but not created.
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { C, Tx, Amt, Field, CTA } from '../ui';
import { Check } from '../icons';
import { services } from '../api';
import { useLoad, Loading, ErrorBox } from './kit';

const STRATS = ['QAW', 'QTF', 'QGF'];
const NAMES = { QAW: 'Qode All Weather', QTF: 'Qode Tactical Fund', QGF: 'Qode Growth Fund' };
const PCTS = [25, 50, 75];   // a Partial switch never moves 100% — that is a Full switch
const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const digits = t => parseInt(String(t || '').replace(/\D/g, '') || '0', 10);
const Lbl = ({ children, style }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={[{ marginTop: 18 }, style]}>{children}</Tx>;

function Chip({ label, on, onPress, sub, flex, dim }) {
  return (
    <Pressable onPress={onPress} disabled={dim} style={{ flex: flex ? 1 : undefined, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, opacity: dim ? 0.4 : 1, borderColor: on ? C.green : C.mutedBorder35, backgroundColor: on ? C.green : 'transparent' }}>
      <Tx w={700} s={11} c={on ? C.cream : C.muted}>{label}{sub ? <Tx s={10} c={on ? C.cream60 : C.gray}> {sub}</Tx> : null}</Tx>
    </Pressable>
  );
}

// Amount picker for one strategy: 25/50/75 % of `base`, a custom rupee figure (capped at `cap` when given),
// and — for To strategies — "Rest" (whatever is still unallocated).
function AmountPick({ v, base, cap, limit, onChange }) {
  const isCustom = v.pct == null && v.rest !== true;
  const shown = v.rest ? (limit || 0) : v.pct != null ? Math.round(base * v.pct) / 100 : digits(v.custom);
  const fits = p => limit == null || Math.round(base * p) / 100 <= limit + 0.5;
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {PCTS.map(p => <Chip key={p} flex label={p + '%'} dim={!fits(p)} on={v.pct === p} onPress={() => onChange({ pct: p, custom: '' })} />)}
        {limit != null && <Chip flex label="Rest" on={v.rest === true} onPress={() => onChange({ pct: null, custom: '', rest: true })} />}
        <Pressable onPress={() => onChange({ pct: null, custom: v.custom })} style={{ flex: 1.3, alignItems: 'center', paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: isCustom ? C.green : C.mutedBorder35, backgroundColor: isCustom ? C.green : 'transparent' }}>
          <Tx w={700} s={11} c={isCustom ? C.cream : C.muted}>₹ Custom</Tx>
        </Pressable>
      </View>
      {isCustom
        ? <Field value={digits(v.custom) ? digits(v.custom).toLocaleString('en-IN') : ''} onChangeText={t => { let x = digits(t); const c = cap != null ? cap : limit != null ? Math.floor(limit) : null; if (c != null && x > c) x = c; onChange({ pct: null, custom: x ? String(x) : '' }); }} numeric s={20} prefix="₹" placeholder="0" style={{ marginTop: 8 }} />
        : <Tx s={11} c={C.muted} style={{ marginTop: 8 }}>{v.rest ? 'Rest' : v.pct + '%'} = <Amt s={12} c={C.ink}>{fmt(shown)}</Amt></Tx>}
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
  const inv = investors.find(i => i.id === invId) || investors.find(i => preferName && norm(i.legalName) === norm(preferName)) || investors[0] || null;
  const invested = (inv && inv.invested) || { QAW: 0, QTF: 0, QGF: 0 };
  const held = STRATS.filter(s => invested[s] > 0);

  const [type, setType] = useState('Full Switch');
  const [fullFrom, setFullFrom] = useState({});
  const [from, setFrom] = useState({});   // strategy → { pct, custom }
  const [to, setTo] = useState({});       // strategy → { pct, custom }
  const [st, setSt] = useState({ busy: false, err: '', done: null });

  const isFull = type === 'Full Switch';
  const fromList = STRATS.filter(s => (isFull ? fullFrom[s] : from[s]));
  const fromAmt = s => { const c = from[s]; if (!c) return 0; return c.pct != null ? Math.round(invested[s] * c.pct) / 100 : Math.min(digits(c.custom), invested[s]); };
  const totalFrom = fromList.reduce((t, s) => t + fromAmt(s), 0);
  const toList = STRATS.filter(s => !fromList.includes(s) && to[s]);
  const fullTotal = fromList.reduce((t, s) => t + (isFull ? invested[s] || 0 : 0), 0);
  const outTotal = isFull ? fullTotal : totalFrom;   // what is moving out, in either mode
  const splitNeeded = !isFull || toList.length > 1;   // Full with ONE target needs no split: it gets everything
  const toFixed = s => { const c = to[s]; if (!c || c.rest) return 0; return c.pct != null ? Math.round(outTotal * c.pct) / 100 : digits(c.custom); };
  const toLimit = s => Math.max(0, outTotal - toList.filter(x => x !== s).reduce((t, x) => t + toFixed(x), 0));   // what is left for this target
  const toAmt = s => { const c = to[s]; if (!c) return 0; if (!splitNeeded) return outTotal; return c.rest ? toLimit(s) : Math.min(toFixed(s), toLimit(s)); };
  const totalTo = toList.reduce((t, s) => t + toAmt(s), 0);
  const balanced = Math.abs(outTotal - totalTo) < 0.5;

  const toggle = (setter, s) => setter(m => { const n = { ...m }; if (n[s]) delete n[s]; else n[s] = { pct: null, custom: '' }; return n; });
  const clearErr = () => setSt(s => ({ ...s, err: '' }));
  const pickType = t => { setType(t); setFullFrom({}); setFrom({}); setTo({}); clearErr(); };
  const pickInvestor = id => { setInvId(id); setFullFrom({}); setFrom({}); setTo({}); clearErr(); };

  const submit = async () => {
    if (st.busy) return;
    if (!fromList.length) return setSt(s => ({ ...s, err: isFull ? 'Select at least one strategy to switch from.' : 'Enter at least one From amount.' }));
    if (!isFull && fromList.some(s => fromAmt(s) <= 0)) return setSt(s => ({ ...s, err: 'Choose a percentage or enter an amount for every From strategy.' }));
    if (!toList.length) return setSt(s => ({ ...s, err: isFull ? 'Select at least one strategy to switch to.' : 'Enter at least one To amount.' }));
    if (splitNeeded && !balanced) return setSt(s => ({ ...s, err: `The total amount moving out (${fmt(outTotal)}) must equal the total amount moving in (${fmt(totalTo)}).` }));
    setSt({ busy: true, err: '', done: null });
    try {
      const body = isFull && toList.length === 1
        ? { switchType: 'Full Switch', from: fromList, to: toList }
        : { switchType: 'Partial Switch', fromAmounts: Object.fromEntries(fromList.map(s => [s, isFull ? invested[s] : fromAmt(s)])), toAmounts: Object.fromEntries(toList.map(s => [s, toAmt(s)])) };
      const r = await services.submitSwitchRequest({ investorId: inv.id, ...body });
      setSt({ busy: false, err: '', done: r });
    } catch (e) { setSt({ busy: false, err: e.message, done: null }); }
  };

  if (info.loading) return <View style={{ marginTop: 16 }}><Loading rows={2} h={60} /></View>;
  if (info.err) return <View style={{ marginTop: 16 }}><ErrorBox msg={info.err} onRetry={info.reload} /></View>;
  if (!inv) return <Tx s={12.5} c={C.muted} lh={1.6} style={{ marginTop: 16 }}>{(data && data.message) || 'We could not find your investor record. Please contact Investor Relations.'}</Tx>;

  const investorPicker = investors.length > 1 && (
    <>
      <Lbl style={{ marginTop: 14 }}>INVESTOR</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {investors.map(i => <Chip key={i.id} label={i.legalName} sub={i.pending ? 'request pending' : ''} on={i.id === inv.id} onPress={() => pickInvestor(i.id)} />)}
      </View>
    </>
  );

  if (inv.pending) {
    const p = inv.pending;
    return (
      <View>
        {investorPicker}
        <View style={{ marginTop: 16, borderWidth: 1, borderColor: C.gold, backgroundColor: 'rgba(218,189,56,0.10)', borderRadius: 10, padding: 14 }}>
          <Tx w={700} s={13}>{inv.legalName} already has a switch request in progress</Tx>
          <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 6 }}>Submitted {p.requestDate ? String(p.requestDate).slice(0, 10) : 'recently'}{p.switchType ? ' · ' + p.switchType : ''}. Our team will reach out once it is processed; a new request can be made after that.</Tx>
        </View>
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
          {inv.legalName}: {isFull ? `full switch of ${fmt(fullTotal)} from ${fromList.join(' + ')} to ${toList.map(s => toList.length > 1 ? `${s} (${fmt(toAmt(s))})` : s).join(' + ')}.` : `${fmt(totalFrom)} from ${fromList.join(' + ')} to ${toList.join(' + ')}.`} Your relationship manager will confirm the details with you.
        </Tx>
        {d.dryRun && <Tx s={11} c={C.gold} lh={1.5} center style={{ marginTop: 10 }}>Test server: the request passed every check but was not sent to the CRM.</Tx>}
        {!!d.requestId && <Tx s={11} c={C.gray} style={{ marginTop: 10 }}>Reference {d.requestId}</Tx>}
        <CTA label="DONE" onPress={onClose} style={{ marginTop: 20, alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <View>
      {investorPicker}
      <View style={{ marginTop: 14, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 }}>
        <Tx w={700} s={9.5} ls={0.1} c={C.muted}>{investors.length > 1 ? 'SELECTED INVESTOR' : 'INVESTOR'}</Tx>
        <Tx w={700} s={13} style={{ marginTop: 3 }}>{inv.legalName}</Tx>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
          {STRATS.map(s => <Tx key={s} s={11} c={C.muted}>{s} <Amt s={11} c={invested[s] > 0 ? C.ink : C.gray}>{fmt(invested[s])}</Amt></Tx>)}
        </View>
      </View>

      <Lbl>SWITCH TYPE</Lbl>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Chip flex label="Full" sub="entire holdings" on={isFull} onPress={() => pickType('Full Switch')} />
        <Chip flex label="Partial" sub="by amount" on={!isFull} onPress={() => pickType('Partial Switch')} />
      </View>

      <Lbl>SWITCH FROM{isFull ? ' · everything in the selected strategies' : ''}</Lbl>
      {held.length === 0 && <Tx s={12} c={C.muted} style={{ marginTop: 8 }}>No strategy holdings found on your investor record.</Tx>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {held.map(s => <Chip key={s} label={s} sub={fmt(invested[s])} on={!!(isFull ? fullFrom[s] : from[s])} onPress={() => { clearErr(); toggle(isFull ? setFullFrom : setFrom, s); }} />)}
      </View>
      {!isFull && fromList.map(s => (
        <View key={s} style={{ marginTop: 12, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Tx w={700} s={13}>{s} · {NAMES[s]}</Tx><Tx s={10.5} c={C.muted}>invested {fmt(invested[s])}</Tx>
          </View>
          <AmountPick v={from[s]} base={invested[s]} cap={Math.floor(invested[s])} onChange={v => { clearErr(); setFrom(m => ({ ...m, [s]: v })); }} />
          {fromAmt(s) >= invested[s] - 0.5 && <Tx s={11} c={C.gold} lh={1.4} style={{ marginTop: 6 }}>This moves everything out of {s}. If you want to exit {s} completely, choose Full switch instead.</Tx>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Tx s={11} c={C.muted}>Out <Amt s={11} c={C.ink}>{fmt(fromAmt(s))}</Amt></Tx>
            <Tx s={11} c={C.muted}>Remaining <Amt s={11} c={C.ink}>{fmt(Math.max(0, invested[s] - fromAmt(s)))}</Amt></Tx>
          </View>
        </View>
      ))}
      {fromList.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingHorizontal: 2 }}>
          <Tx w={700} s={11} ls={0.1} c={C.muted}>TOTAL MOVING OUT</Tx><Amt s={16}>{fmt(outTotal)}</Amt>
        </View>
      )}

      <Lbl>SWITCH TO</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {STRATS.map(s => <Chip key={s} label={s} sub={NAMES[s]} dim={fromList.includes(s)} on={toList.includes(s)} onPress={() => { clearErr(); toggle(setTo, s); }} />)}
      </View>
      {isFull && toList.length === 1 && <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>The full holdings of {fromList.join(' + ') || '…'} ({fmt(fullTotal)}) move to {toList[0]}.</Tx>}
      {isFull && toList.length > 1 && <Tx s={11} c={C.muted} lh={1.5} style={{ marginTop: 8 }}>Split the {fmt(fullTotal)} moving out across {toList.join(' + ')}:</Tx>}
      {splitNeeded && toList.map(s => (
        <View key={s} style={{ marginTop: 12, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 }}>
          <Tx w={700} s={13}>{s} · {NAMES[s]}</Tx>
          <Tx s={10.5} c={C.gray} style={{ marginTop: 2 }}>Share of the {fmt(outTotal)} moving out · {fmt(toLimit(s))} still to allocate</Tx>
          <AmountPick v={to[s]} base={outTotal} limit={toLimit(s)} onChange={v => { clearErr(); setTo(m => ({ ...m, [s]: v })); }} />
        </View>
      ))}
      {splitNeeded && toList.length > 0 && (
        <View style={{ marginTop: 10, borderRadius: 8, backgroundColor: balanced ? 'rgba(2,66,43,0.06)' : 'rgba(239,68,68,0.08)', paddingVertical: 9, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Tx s={11} c={C.muted}>Moving out</Tx><Amt s={12} c={C.ink}>{fmt(outTotal)}</Amt></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}><Tx s={11} c={C.muted}>Moving in</Tx><Amt s={12} c={balanced ? C.ink : C.red}>{fmt(totalTo)}</Amt></View>
          {!balanced && <Tx s={11} c={C.red} lh={1.4} style={{ marginTop: 6 }}>The amount moving in must equal the amount moving out (difference {fmt(Math.abs(outTotal - totalTo))}).</Tx>}
        </View>
      )}

      {!!st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 14 }}>{st.err}</Tx>}
      <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 12 }}>Invested values come from your investor record. One request can be open at a time; your relationship manager is notified when it is raised.</Tx>
      <CTA label={st.busy ? 'PLEASE WAIT…' : isFull ? 'REQUEST FULL SWITCH' : 'REQUEST SWITCH' + (totalFrom ? ' OF ' + fmt(totalFrom) : '')} onPress={submit} style={{ marginTop: 20, opacity: st.busy ? 0.6 : 1 }} />
    </View>
  );
}
