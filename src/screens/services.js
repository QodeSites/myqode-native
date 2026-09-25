// Services tab + request sheets. Every request posts to /api/mobile/services/* or
// /engagement/referral, which email Investor Relations and return an inquiry id.
import React, { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, Tx, Amt, Card, Sheet, Field, CTA, Fade } from '../ui';
import { Plus, ChevronRight, ChevronDown, Copy, Check } from '../icons';
import { services, payments, isDemo } from '../api';
import { titleCase } from '../adapt';
import { useLoad, SectionLabel, AccountChips, Loading, ErrorBox } from './kit';
import { PayOnline } from './pay';
import { clean, check, LIMITS } from '../validate';
import { SetupSip } from './sip';
import { SwitchForm } from './switch';

const STRATS = [['QAW', 'All Weather'], ['QTF', 'Tactical'], ['QGF', 'Growth']];

// Withdrawals are deliberately not offered in the app (Investor Relations handles them); the API route stays.
// Add funds is the big card above this list, so it is not repeated here.
const ITEMS = [
  { key: 'r-switch', title: 'Switch strategy', sub: 'Move capital between strategies' },
  { key: 'r-strategy', title: 'Ask about a strategy', sub: 'Send a question to the investment team' },
  { key: 'r-discussion', title: 'Book a discussion', sub: 'Request a call with Investor Relations' },
  { key: 'r-account', title: 'Raise a query', sub: 'Account changes, family linking, or anything else' },
];

export function ServicesCream({ V }) {
  // Activity lives in one place with a switch, instead of three sections stacked under each other:
  // ONLINE & SIPs (Razorpay orders + SIP mandates, per account) | CONTRIBUTIONS (every cash movement).
  const [view, setView] = useState('online');
  const opts = V.acctOptions;
  const [sel, setSel] = useState(null);
  const accountId = sel && opts.some(o => o.id === sel) ? sel : opts[0] && opts[0].id;
  const inv = useLoad(() => (accountId ? Promise.all([payments.investmentStatus(accountId), services.transactions(accountId)]) : Promise.resolve(null)), [accountId, V.rk]);
  const status = !inv.loading && inv.data ? inv.data[0] : null;
  const all = status ? [...(status.active || []), ...(status.completed || [])] : [];
  const n = x => (inv.loading ? '…' : String(x));
  return (
    <Fade>
      <Pressable onPress={V.openAdd} style={{ marginTop: -34 }}>
        <Card big style={{ paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green }}><Plus s={18} /></View>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>Add funds</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>One-time online payment, SIP, or bank transfer</Tx>
          </View>
          <ChevronRight />
        </Card>
      </Pressable>
      <SectionLabel>REQUESTS & SUPPORT</SectionLabel>
      <Card style={{ overflow: 'hidden' }}>
        {ITEMS.map((it, i) => (
          <Pressable key={it.key} onPress={() => V.openReq(it.key)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 52,
            borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0, borderColor: C.hairline,
          }}>
            <View style={{ flex: 1 }}>
              <Tx w={700} s={13}>{it.title}</Tx>
              <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{it.sub}</Tx>
            </View>
            <ChevronRight />
          </Pressable>
        ))}
      </Card>

      <SectionLabel>ACTIVITY</SectionLabel>
      <Segment value={view} onPick={setView} options={[['online', 'ONLINE & SIPs · ' + n(all.length)], ['cash', 'CONTRIBUTIONS · ' + V.txAll.length]]} />
      {view === 'online'
        ? <Investments V={V} opts={opts} accountId={accountId} onPickAccount={setSel} inv={inv} all={all} />
        : <CashList V={V} />}
      <Tx s={11} c={C.gray} style={{ marginTop: 14, marginLeft: 2 }}>As of {V.asOf}</Tx>
    </Fade>
  );
}

// Pill switch, same look as the Add Funds sheet's mode toggle.
function Segment({ value, onPick, options }) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(55,88,79,0.25)', borderRadius: 999, padding: 3, marginBottom: 12 }}>
      {options.map(([k, l]) => (
        <Pressable key={k} onPress={() => onPick(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: value === k ? C.green : 'transparent' }}>
          <Tx w={700} s={10.5} ls={0.04} c={value === k ? C.gold : C.muted}>{l}</Tx>
        </Pressable>
      ))}
    </View>
  );
}

// Contributions & withdrawals (bank transfers, redemptions): first few rows, then "show all".
function CashList({ V }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? V.txAll : V.txAll.slice(0, 5);
  const foldable = V.txAll.length > 5;
  if (!V.hasTx) {
    return (
      <Card style={{ padding: 18 }}>
        <Tx s={12.5} c={C.muted} lh={1.6} center>No contributions or withdrawals recorded yet.</Tx>
      </Card>
    );
  }
  return (
    <Card style={{ overflow: 'hidden' }}>
      {rows.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < rows.length - 1 || foldable ? 1 : 0, borderColor: C.hairline }}>
          <View style={{ flex: 1 }}>
            <Tx w={700} s={13}>{t.title}</Tx>
            <Tx s={11} c={C.muted} style={{ marginTop: 2 }}>{t.sub}</Tx>
          </View>
          <Amt s={13} c={t.color}>{t.amt}</Amt>
        </View>
      ))}
      {foldable && (
        <Pressable onPress={() => setShowAll(v => !v)} style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Tx w={700} s={11} ls={0.08} c={C.green}>{showAll ? 'SHOW FEWER' : 'SHOW ALL ' + V.txAll.length}</Tx>
        </Pressable>
      )}
    </Card>
  );
}

// Online investments (Razorpay orders and SIP mandates) from payments/investment-status
// and services/transactions. Pause/resume/cancel call the SIP routes.
function Investments({ V, opts, accountId, onPickAccount, inv, all }) {
  const [act, setAct] = useState({ busy: '', msg: '', err: '' });
  const [kind, setKind] = useState('all');   // all | one-time | sip
  const [open, setOpen] = useState({});      // orderId → expanded? (default: live ones open, finished ones folded)
  const items = all
    .filter(it => kind === 'all' || (kind === 'sip') === (it.paymentType === 'SIP'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const when = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const counts = { all: all.length, 'one-time': all.filter(i => i.paymentType !== 'SIP').length, sip: all.filter(i => i.paymentType === 'SIP').length };
  const isOpen = it => (it.orderId in open ? open[it.orderId] : !it.isTerminal);

  const sipAction = async (it, action) => {
    if (act.busy) return;
    setAct({ busy: it.orderId, msg: '', err: '' });
    try {
      const r = action === 'cancel' ? await services.cancelSip(it.orderId, accountId) : await services.pauseResumeSip(it.orderId, accountId, action);
      setAct({ busy: '', msg: (r && r.message) || 'Done.', err: '' });
      inv.reload();
    } catch (e) { setAct({ busy: '', msg: '', err: e.message }); }
  };

  return (
    <>
      {opts.length > 1 && <View style={{ marginTop: -4, marginBottom: 12 }}><AccountChips options={opts} value={accountId} onPick={onPickAccount} /></View>}
      {inv.loading && (
        <Card style={{ padding: 22, alignItems: 'center' }}>
          <ActivityIndicator color={C.green} />
          <Tx s={12} c={C.muted} style={{ marginTop: 10 }}>Checking your online payments and SIPs…</Tx>
        </Card>
      )}
      {!inv.loading && !!inv.err && <ErrorBox msg={inv.err} onRetry={inv.reload} />}
      {!inv.loading && inv.data && all.length === 0 && (
        <Card style={{ padding: 18, alignItems: 'center' }}>
          <Tx w={700} s={13} center>No online payments or SIPs yet</Tx>
          <Tx s={12} c={C.muted} lh={1.6} center style={{ marginTop: 6 }}>Bank transfers appear under Contributions. Use Add Funds to pay online or set up a SIP.</Tx>
          <CTA label="ADD FUNDS" onPress={V.openAdd} style={{ marginTop: 14, alignSelf: 'stretch', paddingVertical: 12 }} />
        </Card>
      )}
      {!inv.loading && all.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[['all', 'All'], ['one-time', 'One-time'], ['sip', 'SIP']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setKind(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: kind === k ? C.green : C.mutedBorder35, backgroundColor: kind === k ? C.green : 'transparent' }}>
              <Tx w={700} s={11} c={kind === k ? C.cream : C.muted}>{l} · {counts[k]}</Tx>
            </Pressable>
          ))}
        </View>
      )}
      {!inv.loading && all.length > 0 && items.length === 0 && (
        <Card style={{ padding: 18 }}><Tx s={12.5} c={C.muted} center>Nothing of this type yet.</Tx></Card>
      )}
      {!inv.loading && items.map(it => {
        const sip = it.paymentType === 'SIP', st = it.investmentStatus || '';
        // Razorpay can pause only a subscription whose first instalment has been charged (`active`); one that
        // is only `authenticated` (mandate registered, first charge ahead) can be cancelled but not paused.
        // SIP_AUTHORISED = mandate registered, first instalment ahead (cancel only);
        // SIP_ACTIVE = charged at least once (pause available).
        const canPause = sip && st === 'SIP_ACTIVE', canResume = sip && st === 'SIP_PAUSED';
        const canCancel = sip && !it.isTerminal;
        const charges = sip ? (it.chargeHistory || (it.sip && it.sip.charges) || []) : [];
        const exp = isOpen(it);
        const next = it.sip && it.sip.nextChargeDate ? String(it.sip.nextChargeDate).slice(0, 10) : '';
        return (
          <Card key={it.orderId} style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: it.statusColor || C.gold, overflow: 'hidden' }}>
            <Pressable onPress={() => setOpen(o => ({ ...o, [it.orderId]: !exp }))} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Tx w={700} s={13} style={{ flex: 1 }}>{sip ? 'SIP · ' + titleCase((it.sip && it.sip.frequency) || it.frequency || '') : it.isNewStrategy ? 'New strategy' : 'One-time investment'}</Tx>
                <Amt s={14}>{it.formattedAmount || '₹' + Number(it.amount || 0).toLocaleString('en-IN')}</Amt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: it.statusColor || C.gold }} />
                <Tx w={700} s={11} c={C.muted} numberOfLines={1} style={{ flex: 1 }}>
                  {it.statusLabel || st}
                  {!!next && <Tx s={11} c={C.gray}>{'  · next ' + next}</Tx>}
                  {charges.length > 0 && <Tx s={11} c={C.gray}>{'  · ' + charges.length + (charges.length === 1 ? ' instalment' : ' instalments')}</Tx>}
                </Tx>
                <View style={{ transform: [{ rotate: exp ? '180deg' : '0deg' }] }}><ChevronDown s={11} c={C.muted} /></View>
              </View>
            </Pressable>
            {exp && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                {!!it.statusMessage && <Tx s={11.5} c={C.muted} lh={1.5}>{it.statusMessage}</Tx>}
                {Array.isArray(it.timeline) && it.timeline.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    {it.timeline.map((t, i) => (
                      <View key={i} style={{ flex: 1 }}>
                        <View style={{ height: 3, borderRadius: 2, backgroundColor: t.done || t.completed ? C.green : 'rgba(55,88,79,0.18)' }} />
                        <Tx s={9} c={C.muted} numberOfLines={1} style={{ marginTop: 4 }}>{t.label || t.step || t.status}</Tx>
                      </View>
                    ))}
                  </View>
                )}
                <Tx s={10.5} c={C.gray} style={{ marginTop: 8 }}>{sip ? 'Set up ' : 'Placed '}{when(it.createdAt)}{it.paymentTime ? ' · paid ' + when(it.paymentTime) : ''}</Tx>
                {/* subscription id: development builds only */}
                {__DEV__ && sip && <Tx s={10} c={C.gray} style={{ marginTop: 2 }}>Ref {it.orderId}</Tx>}
                {charges.length > 0 && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: C.hairline, paddingTop: 8 }}>
                    <Tx w={700} s={10} ls={0.1} c={C.muted}>INSTALMENTS</Tx>
                    {charges.map((ch, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ch.status === 'SUCCESS' ? C.pos : ch.status === 'FAILED' ? C.red : C.gold }} />
                        <Tx s={11} c={C.muted} style={{ flex: 1 }}>{ch.installmentNumber ? '#' + ch.installmentNumber + ' · ' : ''}{when(ch.paidAt || ch.chargeDate)}</Tx>
                        <Amt s={11.5}>{ch.formattedAmount || '₹' + Number(ch.amount || 0).toLocaleString('en-IN')}</Amt>
                        <Tx w={700} s={9.5} c={ch.status === 'SUCCESS' ? C.pos : ch.status === 'FAILED' ? C.red : C.muted}>{ch.status}</Tx>
                      </View>
                    ))}
                  </View>
                )}
                {(canPause || canResume || canCancel) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {canPause && <CTA label={act.busy === it.orderId ? '…' : 'PAUSE'} outline onPress={() => sipAction(it, 'pause')} style={{ flex: 1, paddingVertical: 11 }} />}
                    {canResume && <CTA label={act.busy === it.orderId ? '…' : 'RESUME'} outline onPress={() => sipAction(it, 'resume')} style={{ flex: 1, paddingVertical: 11 }} />}
                    {canCancel && <CTA label={act.busy === it.orderId ? '…' : 'CANCEL SIP'} outline onPress={() => sipAction(it, 'cancel')} style={{ flex: 1, paddingVertical: 11 }} />}
                  </View>
                )}
              </View>
            )}
          </Card>
        );
      })}
      {!!act.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginBottom: 10 }}>{act.err}</Tx>}
      {!!act.msg && <Tx s={12} c={C.green} style={{ marginBottom: 10 }}>{act.msg}</Tx>}
      {!inv.loading && all.length > 0 && (
        <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 2, marginLeft: 2 }}>Tap a card for details. Use Add Funds for a new payment or SIP.</Tx>
      )}
    </>
  );
}

function Shell({ V, title, sub, children }) {
  return (
    <Sheet visible onClose={V.closeSheet}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}>
        <Tx f="play" w={600} s={21}>{title}</Tx>
        {!!sub && <Tx s={12} c={C.muted} lh={1.5} style={{ marginTop: 3 }}>{sub}</Tx>}
        {children}
      </View>
    </Sheet>
  );
}

const Lbl = ({ children }) => <Tx w={700} s={10} ls={0.12} c={C.gray} style={{ marginTop: 18 }}>{children}</Tx>;

export const FORMS = {
  'r-strategy': {
    title: 'Ask about a strategy', sub: 'Your question goes straight to the investment team.', cta: 'SEND QUESTION',
    fields: [{ k: 'q', label: 'YOUR QUESTION', kind: 'multiline', validate: x => check.text(x, { min: 10, what: 'your question' }) }],
    submit: (a, v) => services.strategyInquiry({ accountId: a, question: v.q.trim() }),
  },
  'r-discussion': {
    title: 'Book a discussion', sub: 'Tell us what you’d like to talk about and we’ll arrange a call.', cta: 'REQUEST A CALL',
    fields: [{ k: 't', label: 'TOPIC', kind: 'multiline', validate: x => check.text(x, { min: 5, what: 'the topic' }) }],
    submit: (a, v) => services.discussion({ accountId: a, topic: v.t.trim() }),
  },
  'r-account': {
    title: 'Raise a query', sub: 'Account changes, linking a family member’s account, or anything else you need from Investor Relations.', cta: 'SEND QUERY',
    fields: [{ k: 'm', label: 'YOUR QUERY', kind: 'multiline', validate: x => check.text(x, { min: 10, what: 'your query' }) }],
    submit: (a, v) => services.accountRequest({ accountId: a, message: v.m.trim() }),
  },
};

export function FormBody({ cfg, opts, onDone, doneLabel = 'DONE' }) {
  const [acct, setAcct] = useState(opts[0] && opts[0].id);
  const [v, setV] = useState(cfg.init || {});
  const [st, setSt] = useState({ busy: false, err: '', ref: null });
  const [errs, setErrs] = useState({});   // field → message, shown under the field
  const set = (k, val) => { setV(p => ({ ...p, [k]: val })); if (errs[k]) setErrs(e => ({ ...e, [k]: '' })); };
  // What typing may put into a field of each kind (letters never reach a phone field, etc.)
  const tidy = (f, t) => (f.kind === 'phone' ? clean.phone(t) : f.kind === 'email' ? clean.email(t) : f.kind === 'name' ? clean.name(t)
    : clean.text(t, f.max || (f.kind === 'multiline' ? LIMITS.message : LIMITS.name)));

  const submit = async () => {
    if (st.busy) return;
    // Per-field rules first (each field's own `validate`), then the form's cross-field check.
    const fe = {};
    cfg.fields.forEach(f => { const m = f.validate ? f.validate(v[f.k], v) : ''; if (m) fe[f.k] = m; });
    setErrs(fe);
    const bad = Object.values(fe)[0] || (cfg.check ? cfg.check(v) : '');
    if (bad) return setSt({ busy: false, err: Object.keys(fe).length > 1 ? 'Please fix the highlighted fields.' : bad, ref: null });
    setSt({ busy: true, err: '', ref: null });
    try {
      const r = await cfg.submit(acct, v);
      setSt({ busy: false, err: '', ref: String((r && r.inquiry_id) || '') });
    } catch (e) { setSt({ busy: false, err: e.message, ref: null }); }
  };

  if (st.ref !== null) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}><Check s={22} w={2.4} /></View>
        <Tx w={700} s={15} style={{ marginTop: 14 }}>Request received</Tx>
        <Tx s={12.5} c={C.muted} lh={1.6} center style={{ marginTop: 8 }}>Our Investor Relations team will get back to you shortly.</Tx>
        {!!st.ref && <Tx s={11} c={C.gray} style={{ marginTop: 10 }}>Reference {st.ref}</Tx>}
        <CTA label={doneLabel} onPress={onDone} style={{ marginTop: 20, alignSelf: 'stretch' }} />
      </View>
    );
  }
  return (
    <View>
      {opts.length > 1 && cfg.account !== false && <><Lbl>ACCOUNT</Lbl><AccountChips options={opts} value={acct} onPick={setAcct} /></>}
      {cfg.fields.map(f => (
        <View key={f.k}>
          {f.kind === 'strat' ? (
            <>
              <Lbl>{f.label}</Lbl>
              <AccountChips options={STRATS.map(s => ({ id: s[0], label: s[1] }))} value={v[f.k]} onPick={x => set(f.k, x)} />
            </>
          ) : f.kind === 'amount' ? (
            <Field label={f.label} value={v[f.k] ? v[f.k].toLocaleString('en-IN') : ''}
              onChangeText={t => set(f.k, parseInt(t.replace(/\D/g, '') || '0', 10))} numeric s={24} prefix="₹" style={{ marginTop: 18 }} />
          ) : (
            <Field label={f.label} value={v[f.k] || ''} onChangeText={t => set(f.k, tidy(f, t))} multiline={f.kind === 'multiline'}
              keyboardType={f.kind === 'email' ? 'email-address' : f.kind === 'phone' ? 'number-pad' : undefined}
              autoCapitalize={f.kind === 'email' ? 'none' : f.kind === 'name' ? 'words' : undefined}
              prefix={f.kind === 'phone' ? '+91' : undefined} placeholder={f.placeholder}
              maxLength={f.kind === 'phone' ? 10 : f.max || (f.kind === 'multiline' ? LIMITS.message : f.kind === 'email' ? LIMITS.email : LIMITS.name)}
              error={errs[f.k]} hint={f.kind === 'multiline' && (v[f.k] || '').length > 0 ? `${(v[f.k] || '').length} / ${f.max || LIMITS.message}` : f.hint}
              style={{ marginTop: 18 }} />
          )}
        </View>
      ))}
      {!!st.err && <Tx s={12} c={C.red} lh={1.45} style={{ marginTop: 14 }}>{st.err}</Tx>}
      <CTA label={st.busy ? 'PLEASE WAIT…' : cfg.cta} onPress={submit} style={{ marginTop: 22, opacity: st.busy ? 0.6 : 1 }} />
    </View>
  );
}

function CopyRow({ k, v, last }) {
  const [done, setDone] = useState(false);
  return (
    <Pressable onPress={() => { Clipboard.setStringAsync(String(v)).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1500); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderColor: C.hairline }}>
      <View style={{ flex: 1 }}>
        <Tx w={700} s={9.5} ls={0.1} c={C.muted}>{k}</Tx>
        <Tx w={700} s={13} style={{ marginTop: 3 }}>{v}</Tx>
      </View>
      {done ? <Tx w={700} s={10} c={C.green}>COPIED</Tx> : <Copy />}
    </Pressable>
  );
}

function AddFunds({ V }) {
  const bank = useLoad(() => services.bankDetails(), []);
  // Same values the server returns (and the web's Account Services page shows) — shown at once, replaced by the API answer
  const b = bank.data || (!bank.err && !isDemo() ? { payableTo: 'Qode Advisors LLP', accountNumber: '43377275922', bank: 'SBI Bank – Corporate Account Group Branch', ifsc: 'SBIN0009995', micr: '40000213' } : null);
  const rec = V.payRecover;   // set by main.js when an order / SIP was in the browser and the app reloaded
  const [mode, setMode] = useState(rec && rec.kind === 'sip' ? 'sip' : 'online');
  const subs = { online: 'Top up your investment with a one-time online payment.', sip: 'Set up a recurring investment — authorise once, Razorpay debits automatically on schedule.', bank: 'Transfer from your registered bank account by NEFT, RTGS or IMPS using the details below.' };
  return (
    <Shell V={V} title="Add funds" sub={subs[mode]}>
      <View style={{ marginTop: 14, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(55,88,79,0.25)', borderRadius: 999, padding: 3 }}>
        {[['online', 'ADD FUNDS'], ['sip', 'SET UP SIP'], ['bank', 'BANK TRANSFER']].map(([k, l]) => (
          <Pressable key={k} onPress={() => setMode(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: mode === k ? C.green : 'transparent' }}>
            <Tx w={700} s={10.5} ls={0.04} c={mode === k ? C.gold : C.muted}>{l}</Tx>
          </Pressable>
        ))}
      </View>
      {mode === 'online' && <PayOnline V={V} recover={rec && rec.kind !== 'sip' ? rec : null} onDone={() => V.bumpRefresh && V.bumpRefresh()} />}
      {mode === 'sip' && <SetupSip V={V} recover={rec && rec.kind === 'sip' ? rec : null} onDone={() => V.bumpRefresh && V.bumpRefresh()} />}
      {mode === 'bank' && <>
      {bank.loading && !b && <View style={{ marginTop: 16 }}><Loading rows={2} h={56} /></View>}
      {!!bank.err && <View style={{ marginTop: 16 }}><ErrorBox msg={bank.err} onRetry={bank.reload} /></View>}
      {b && (
        <View style={{ marginTop: 14, borderWidth: 1, borderColor: 'rgba(55,88,79,0.2)', borderRadius: 8, paddingHorizontal: 14 }}>
          <CopyRow k="PAYABLE TO" v={b.payableTo} />
          <CopyRow k="ACCOUNT NUMBER" v={b.accountNumber} />
          <CopyRow k="BANK" v={b.bank} />
          <CopyRow k="IFSC" v={b.ifsc} />
          <CopyRow k="MICR" v={b.micr} last />
        </View>
      )}
      <Tx s={11} c={C.gray} lh={1.5} style={{ marginTop: 14 }}>Please transfer only from your registered bank account and inform Investor Relations after the transfer.</Tx>
      <CTA label="DONE" onPress={V.closeSheet} style={{ marginTop: 18 }} />
      </>}
    </Shell>
  );
}

export function RequestSheets({ V }) {
  const k = V.sheet;
  if (k === 'r-add') return <AddFunds V={V} />;
  if (k === 'r-switch') {
    return (
      <Shell V={V} title="Switch strategy" sub="Move part or all of an account into another Qode strategy.">
        <SwitchForm onClose={V.closeSheet} preferName={V.acctName} />
      </Shell>
    );
  }
  const cfg = FORMS[k];
  if (!cfg) return null;
  return (
    <Shell V={V} title={cfg.title} sub={cfg.sub}>
      <FormBody key={k} cfg={cfg} opts={V.acctOptions} onDone={V.closeSheet} />
    </Shell>
  );
}
