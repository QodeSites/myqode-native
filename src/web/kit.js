// myQode web design system. The phone app and the website share data and brand colours, but not their look:
// the website is a desktop dashboard — white surfaces with hairline borders on a warm grey canvas, Inter for all
// interface text and figures (Playfair only for the brand and page titles), sentence-case section titles, light
// data tables, segmented controls, and the brand green / gold used as accents rather than as surfaces.
// Every screen in src/web/ builds from these pieces. `C` here is the web palette: it keeps the app's key names so
// shared code keeps working, with web values.
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { View, Pressable, TextInput, ActivityIndicator, Modal, ScrollView, Platform, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { C as APP, Tx as AppTx, Amt, useUI } from '../ui';
import { ChevronRight, ChevronDown } from '../icons';

import { userMessage } from '../errors';
export const C = {
  ...APP,
  canvas: '#EFECD3',     // page background: the brand cream
  card: '#F9F7EC',       // surfaces: warm ivory
  subtle: '#F3F0DF',     // wells, footers
  hover: 'rgba(218,189,56,0.10)',
  line: 'rgba(55,88,79,0.15)',   // hairline borders
  line2: 'rgba(55,88,79,0.3)',   // control borders
  track: 'rgba(55,88,79,0.10)',  // empty part of bars and skeletons
  ink: '#0E1A15',
  ink2: '#4F5C56',       // secondary text
  ink3: '#86918B',       // tertiary text, labels
  green: '#02422B',
  greenTint: 'rgba(2,66,43,0.07)',
  goldText: '#8A700C',   // gold that reads on white
  goldTint: 'rgba(218,189,56,0.16)',
  pos: '#15803D',
  red: '#C2362F',
  posTint: 'rgba(21,128,61,0.09)',
  redTint: 'rgba(194,54,47,0.08)',
  // app key names, web values
  cream: '#EFECD3',
  muted: '#4F5C56',
  gray: '#86918B',
  hairline: 'rgba(55,88,79,0.15)',
  mutedBorder: 'rgba(55,88,79,0.3)',
  mutedBorder35: 'rgba(55,88,79,0.35)',
};

// Inter has 400 / 600 / 700; map the app's other weights onto them.
const IW = { 400: 400, 500: 400, 600: 600, 700: 600, 800: 700, 900: 700 };
/** Text. Inter by default; f="play" for the brand serif (titles only). */
export function Tx({ f = 'inter', w = 400, ...rest }) {
  if (f === 'play') return <AppTx f="play" w={w >= 700 ? 700 : w >= 600 ? 600 : 500} {...rest} />;
  if (f === 'lato') return <AppTx f="lato" w={w} {...rest} />;
  return <AppTx f="inter" w={IW[w] || 400} {...rest} />;
}
export { Amt };

// Approximate Inter widths (in em) for the characters in figures; tabular digits are a fixed width.
const CW = ch => ('0123456789₹'.includes(ch) ? 0.65 : ',.:'.includes(ch) ? 0.3 : ' '.includes(ch) ? 0.28 : '+−-–%'.includes(ch) ? 0.62 : /[A-Z]/.test(ch) ? 0.68 : 0.56);
/** A figure that keeps its size when it fits and shrinks (down to `min`) when its box is too narrow, so large
 *  amounts are never cut off. Accounts for the text-size setting (Amt multiplies by it) and letter spacing. */
export function FitAmt({ children, s = 22, min = 12, style, ...rest }) {
  const { z } = useUI();
  const [box, setBox] = useState(0);
  const text = String(children == null ? '' : children);
  const ls = (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {}).letterSpacing || 0;
  const units = [...text].reduce((n, ch) => n + CW(ch), 0);
  let size = s;
  // Text width ≈ size × z × units + letterSpacing × characters; solve for the size that fits the box.
  if (box > 0 && units > 0) size = Math.max(min, Math.min(s, Math.floor(((box - 4 - ls * text.length) / (units * z)) * 10) / 10));
  // The estimate can run short (fonts, zoom), and a figure must never end in "…": on the web the real text is measured
  // and shrunk further until it fits; below a readable floor it wraps instead.
  const [k, setK] = useState(1);
  const ref = useRef(null);
  const floor = Math.min(min, 10);
  const wrap = size * k <= floor;
  useLayoutEffect(() => { setK(1); }, [text, box, size, z]);
  useLayoutEffect(() => {
    const t = ref.current && ref.current.firstChild;
    if (!web || !t || wrap || !box) return;
    if (t.scrollWidth > t.clientWidth + 1) setK(x => Math.max(floor / size, x * 0.92));
  });
  return (
    <View ref={ref} onLayout={e => setBox(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch', minWidth: 0 }}>
      <Amt s={Math.round(size * k * 10) / 10} numberOfLines={wrap ? undefined : 1} style={style} {...rest}>{text}</Amt>
    </View>
  );
}

// Section titles read as sentences on the web ("Strategy accounts"), whatever case the caller passes.
const KEEP = new Set(['NAV', 'SIP', 'STP', 'PMS', 'SI', 'DD', 'IR', 'PDF', 'FAQ', 'CAGR', 'P&L', 'UCC', 'GST', 'PAN', 'KYC', 'TDS', 'ID', 'XIRR', 'AUM', 'GSTIN', 'IFSC', 'SOA', 'CSV']);
export function sentence(t) {
  if (typeof t !== 'string' || t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t;
  return t.split(' ').map((w, i) => {
    const bare = w.replace(/[^A-Z&0-9]/g, '');
    if (KEEP.has(bare) || /^\d/.test(w) || /\d[A-Z]$/.test(w)) return w;
    const lw = w.toLowerCase();
    return i === 0 ? lw.charAt(0).toUpperCase() + lw.slice(1) : lw;
  }).join(' ');
}

const web = Platform.OS === 'web';
// Clips like overflow hidden, but is not a scroll container, so a sticky table header inside still pins to the page.
export const CLIP = web ? 'clip' : 'hidden';

/** Surface: white, hairline border, 12 px corners. */
export function Card({ style, children }) {
  return <View style={[{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line }, style]}>{children}</View>;
}

/** A row of columns with a consistent gutter. */
export const Row = ({ children, style, gap = 20, top }) => (
  <View style={[{ flexDirection: 'row', gap, alignItems: top ? 'flex-start' : 'stretch' }, style]}>{children}</View>
);
/** Wrapping grid: children get `minWidth` and grow to fill the row. */
export const Grid = ({ children, min = 260, gap = 16, style }) => (
  <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
    {React.Children.map(children, ch => ch && <View style={{ flexGrow: 1, flexBasis: min, minWidth: min }}>{ch}</View>)}
  </View>
);

/** Heading inside the content area (the top bar holds the page's H1). */
export function PageIntro({ title, sub, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
      <View style={{ flex: 1 }}>
        {!!title && <Tx w={600} s={20} role="heading" aria-level={2}>{sentence(title)}</Tx>}
        {!!sub && <Tx s={13.5} c={C.ink2} lh={1.55} style={{ marginTop: 6, maxWidth: 760 }}>{sub}</Tx>}
      </View>
      {right}
    </View>
  );
}

/** Small label above a figure or field. */
export const Label = ({ children, style, c = C.ink3 }) => <Tx w={600} s={12} c={c} style={style}>{sentence(children)}</Tx>;

/** Card with a header (title, optional subtitle and actions). pad=0 for edge-to-edge tables. */
export function Panel({ title, sub, right, children, style, pad = 20, footer }) {
  return (
    <Card style={[{ overflow: CLIP }, style]}>
      {(!!title || !!right) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: pad === 0 ? 14 : 0 }}>
          <View style={{ flexShrink: 1 }}>
            {typeof title === 'string' ? <Tx w={600} s={14.5} c={C.green} role="heading" aria-level={3}>{sentence(title)}</Tx> : title || null}
            {!!sub && <Tx s={12} c={C.ink3} style={{ marginTop: 2 }}>{sub}</Tx>}
          </View>
          {right}
        </View>
      )}
      <View style={pad ? { padding: pad, paddingTop: title || right ? 14 : pad } : null}>{children}</View>
      {!!footer && <View style={{ borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.subtle }}>{footer}</View>}
    </Card>
  );
}

/** Change badge: tinted green / red with the figure. */
export function Delta({ text, neg, zero, s = 12, style }) {
  if (!text) return null;
  const fg = zero ? C.ink2 : neg ? C.red : C.pos, bg = zero ? C.track : neg ? C.redTint : C.posTint;
  return (
    <View style={[{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 }, style]}>
      <Amt s={s} c={fg}>{text}</Amt>
    </View>
  );
}

/** KPI tile: label, large figure, optional note or delta. */
export function Stat({ label, value, color = C.ink, note, delta, deltaNeg, style, icon }) {
  return (
    <Card style={[{ flexGrow: 1, paddingVertical: 16, paddingHorizontal: 18, justifyContent: 'flex-start', borderTopWidth: 2.5, borderTopColor: C.gold }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Label>{label}</Label>
      </View>
      <FitAmt w={600} s={22} c={color} style={{ marginTop: 8, letterSpacing: -0.3 }}>{value}</FitAmt>
      {(!!note || !!delta) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {!!delta && <Delta text={delta} neg={deltaNeg} s={11.5} />}
          {!!note && <Tx s={12} c={C.ink3} numberOfLines={1} style={{ flexShrink: 1 }}>{note}</Tx>}
        </View>
      )}
    </Card>
  );
}

/** Deep-green feature surface (one per page at most: the headline figure or a call to action). */
export function DarkCard({ children, style }) {
  return (
    <LinearGradient colors={['#034A31', '#012A1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 12, padding: 24 }, style]}>
      {children}
    </LinearGradient>
  );
}

/** Buttons: primary (green), outline (white), ghost (text), gold (on dark surfaces), danger. */
export function Btn({ label, onPress, kind = 'primary', icon, disabled, busy, style, small }) {
  const pal = {
    primary: { bg: C.green, hov: '#012A1C', fg: C.gold, bd: C.green },
    outline: { bg: C.card, hov: C.hover, fg: C.ink, bd: C.line2 },
    gold: { bg: C.gold, hov: '#e8cc4e', fg: C.ink, bd: C.gold },
    ghost: { bg: 'transparent', hov: C.greenTint, fg: C.green, bd: 'transparent' },
    danger: { bg: C.card, hov: C.redTint, fg: C.red, bd: 'rgba(194,54,47,0.4)' },
  }[kind];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }} onPress={disabled || busy ? undefined : onPress} style={({ hovered }) => [{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: small ? 34 : 40, paddingHorizontal: small ? 12 : 16, borderRadius: 8, borderWidth: 1,
      backgroundColor: hovered && !disabled ? pal.hov : pal.bg, borderColor: pal.bd, opacity: disabled ? 0.45 : 1,
    }, style]}>
      {busy ? <ActivityIndicator size="small" color={pal.fg} /> : icon}
      <Tx w={600} s={small ? 12.5 : 13.5} c={pal.fg}>{label}</Tx>
    </Pressable>
  );
}

/** Segmented control (filters, ranges). options: [[value, label, disabled?]]; small for a compact one (table header
 *  rows). A disabled option is greyed out and can't be picked (e.g. a period with no data behind it yet). */
export function Chips({ value, options, onChange, style, small }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', backgroundColor: 'rgba(55,88,79,0.09)', borderRadius: 9, padding: 3, gap: 2 }, style]}>
      {options.map(([k, l, off]) => {
        const on = value === k;
        return (
          <Pressable key={String(k)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!off }} disabled={!!off} onPress={off ? undefined : () => onChange(k)} style={({ hovered }) => ({
            paddingVertical: small ? 4 : 6, paddingHorizontal: small ? 10 : 12, borderRadius: 7, outlineStyle: 'none',
            backgroundColor: on ? C.green : hovered && !off ? 'rgba(255,255,255,0.6)' : 'transparent', opacity: off ? 0.35 : 1,
            cursor: off ? 'not-allowed' : undefined,
          })}>
            <Tx w={600} s={small ? 12 : 12.5} c={on ? C.gold : C.ink2}>{l}</Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Dropdown: a field-like trigger (optional muted label, the current text, a chevron) that opens a floating menu.
 *  options: [{ id, label, note?, disabled? }] or { section: 'Heading' } rows (a disabled option is greyed out); value: the selected id; onPick(id) closes the menu
 *  unless the id is in keepOpen (e.g. 'custom', to show extra fields). children: extra content under the options,
 *  or a function (close) => node. Clicking outside or pressing Escape closes it. Give the row it sits in a zIndex
 *  so the menu floats over what follows. */
export function Dropdown({ label, text, options = [], value, onPick, keepOpen = [], children, width, maxWidth = 380, menuWidth = 300, align = 'left', disabled, a11yLabel }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const extra = typeof children === 'function' ? children(close) : children;
  return (
    <View style={{ zIndex: open ? 60 : 1, width, maxWidth, flexShrink: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={a11yLabel || label || text} accessibilityState={{ expanded: open, disabled: !!disabled }}
        onPress={disabled ? undefined : () => setOpen(o => !o)}
        style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
          backgroundColor: C.card, borderColor: open || (hovered && !disabled) ? C.green : C.line2, opacity: disabled ? 0.5 : 1, outlineStyle: 'none' })}>
        {!!label && <Tx w={600} s={12} c={C.ink3}>{label}</Tx>}
        <Tx w={600} s={13} numberOfLines={1} style={{ flexShrink: 1 }}>{text}</Tx>
        <ChevronDown s={10} c={C.ink2} />
      </Pressable>
      {open && (
        <>
          <Pressable accessibilityLabel="Close menu" onPress={close}
            style={{ position: Platform.OS === 'web' ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, cursor: 'default' }} />
          <View style={{ position: 'absolute', top: 40, [align === 'right' ? 'right' : 'left']: 0, zIndex: 1, width: menuWidth, borderWidth: 1, borderColor: C.line,
            borderRadius: 10, backgroundColor: C.card, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
            {options.length > 0 && (
              <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingVertical: 4 }}>
                {options.map((o, i) => (o.section ? (
                  <Tx key={'s' + i} w={600} s={11.5} c={C.ink3} style={{ paddingHorizontal: 14, paddingTop: i ? 10 : 6, paddingBottom: 4 }}>{o.section}</Tx>
                ) : (
                  <Pressable key={String(o.id)} accessibilityRole="menuitem" accessibilityState={{ selected: o.id === value, disabled: !!o.disabled }} disabled={!!o.disabled}
                    onPress={o.disabled ? undefined : () => { if (onPick) onPick(o.id); if (!keepOpen.includes(o.id)) close(); }}
                    style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 9, paddingHorizontal: 14, outlineStyle: 'none',
                      opacity: o.disabled ? 0.4 : 1, cursor: o.disabled ? 'not-allowed' : undefined,
                      backgroundColor: o.id === value ? C.greenTint : hovered && !o.disabled ? C.hover : 'transparent' })}>
                    <Tx w={o.id === value ? 600 : 400} s={13} c={o.id === value ? C.green : C.ink} numberOfLines={1} style={{ flex: 1 }}>{o.label}</Tx>
                    {!!o.note && <Tx s={12} c={C.ink3} numberOfLines={1}>{o.note}</Tx>}
                  </Pressable>
                )))}
              </ScrollView>
            )}
            {!!extra && <View style={{ padding: 14, borderTopWidth: options.length ? 1 : 0, borderColor: C.line }}>{extra}</View>}
          </View>
        </>
      )}
    </View>
  );
}

/** Underlined tabs (section switchers). options: [[value, label]] */
export function Tabs({ value, options, onChange, style }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderColor: C.line }, style]}>
      {options.map(([k, l]) => {
        const on = value === k;
        return (
          <Pressable key={String(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)} style={({ hovered }) => ({ paddingVertical: 11, opacity: hovered && !on ? 0.75 : 1, outlineStyle: 'none' })}>
            <Tx w={600} s={13.5} c={on ? C.green : C.ink3}>{l}</Tx>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1, backgroundColor: on ? C.gold : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labelled text field. */
export function Input({ label, value, onChangeText, placeholder, secure, error, hint, right, multiline, keyboardType, autoFocus, onSubmitEditing, style }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={style}>
      {!!label && <Tx w={600} s={12.5} c={C.ink2} style={{ marginBottom: 6 }}>{sentence(label)}</Tx>}
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, backgroundColor: C.card,
        borderColor: error ? C.red : focus ? C.green : C.line2, paddingHorizontal: 12, minHeight: multiline ? 110 : 44,
        shadowColor: C.green, shadowOpacity: focus ? 0.12 : 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, outlineWidth: focus ? 3 : 0, outlineColor: 'rgba(2,66,43,0.12)', outlineStyle: 'solid' }}>
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.ink3}
          secureTextEntry={secure} multiline={multiline} keyboardType={keyboardType} autoFocus={autoFocus} autoCapitalize="none"
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={onSubmitEditing}
          style={{ flex: 1, alignSelf: 'stretch', minHeight: multiline ? 96 : 42, width: '100%', paddingVertical: 10, fontSize: 14, lineHeight: 20, backgroundColor: 'transparent', borderWidth: 0, color: C.ink, fontFamily: 'Inter_400Regular', outlineStyle: 'none', textAlignVertical: multiline ? 'top' : 'center' }} />
        {right}
      </View>
      {!!(error || hint) && <Tx s={12} c={error ? C.red : C.ink3} style={{ marginTop: 6 }}>{error || hint}</Tx>}
    </View>
  );
}

/** Date field. On the web a real DOM <input type="date"> (the browser's calendar picker), styled like Input;
 *  value / min / max are YYYY-MM-DD and onChangeText gets YYYY-MM-DD ('' when cleared). Elsewhere it falls back to Input. */
export function DateField({ label, value, onChangeText, min, max, error, hint, placeholder = 'YYYY-MM-DD', style }) {
  const [focus, setFocus] = useState(false);
  const msg = typeof error === 'string' ? error : '';   // error={true} only colours the border
  if (Platform.OS !== 'web') return <Input label={label} value={value} onChangeText={onChangeText} placeholder={placeholder} error={msg || undefined} hint={hint} style={style} />;
  return (
    <View style={style}>
      {!!label && <Tx w={600} s={12.5} c={C.ink2} style={{ marginBottom: 6 }}>{sentence(label)}</Tx>}
      {React.createElement('input', {
        type: 'date', value: value || '', min: min || undefined, max: max || undefined, 'aria-label': label || 'Date',
        onChange: e => onChangeText && onChangeText(e.target.value || ''),
        onFocus: () => setFocus(true), onBlur: () => setFocus(false),
        style: {
          boxSizing: 'border-box', width: '100%', height: 44, padding: '0 12px', borderRadius: 8, borderStyle: 'solid', borderWidth: 1,
          borderColor: error ? C.red : focus ? C.green : C.line2, backgroundColor: C.card, color: value ? C.ink : C.ink3,
          fontFamily: 'Inter_400Regular, Inter, system-ui, sans-serif', fontSize: 14, lineHeight: '20px', cursor: 'pointer',
          outline: focus ? '3px solid rgba(2,66,43,0.12)' : 'none', colorScheme: 'light',
        },
      })}
      {!!(msg || hint) && <Tx s={12} c={msg ? C.red : C.ink3} style={{ marginTop: 6 }}>{msg || hint}</Tx>}
    </View>
  );
}

/** Data table. cols: [{ key, label, flex?, w?, right?, render?(row) }]; rows: array; onRowPress?(row); selected?(row).
 *  Right-aligned (figure) columns are as wide as their widest value, header included, and never shrink, so an amount
 *  or a date is never cut to "…" however narrow the window or large the zoom. Left-aligned columns share what is left
 *  (by `flex`) and keep their text inside the cell: one-line text ends in "…", other text wraps. `w` fixes a width.
 *  The header sticks to the top of the page while the rows scroll; sticky={false} turns that off. */
export function Table({ cols, rows, onRowPress, empty = 'Nothing to show yet.', dense, selected, sticky = true }) {
  const cell = { paddingVertical: dense ? 9 : 12, paddingHorizontal: 16 };
  const root = useRef(null);
  const [fit, setFit] = useState({});   // measured content width of each right-aligned column, by key
  const measure = useCallback(() => {
    const el = root.current;
    if (!web || !el || !el.querySelectorAll) return;
    const next = {};
    el.querySelectorAll('[data-fit]').forEach(n => { const k = n.getAttribute('data-fit'); next[k] = Math.max(next[k] || 0, Math.ceil(n.getBoundingClientRect().width)); });
    setFit(prev => (Object.keys(next).length === Object.keys(prev).length && Object.keys(next).every(k => prev[k] === next[k]) ? prev : next));
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    if (!web) return undefined;
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const size = c => (c.w ? { width: c.w, flexGrow: 0, flexShrink: 0 }
    : c.right && fit[c.key] ? { width: fit[c.key] + cell.paddingHorizontal * 2, flexGrow: 0, flexShrink: 0 }
    : { flexGrow: c.flex || 1, flexShrink: 1, flexBasis: 0, minWidth: 0 });
  // A figure column's content is laid out at its natural width (max-content) and measured; the column then takes it.
  const fitBox = (c, child) => (c.right && !c.w && web
    ? <View dataSet={{ fit: c.key }} style={{ width: 'max-content', alignItems: 'flex-end' }}>{child}</View>
    : child);
  const head = [{ flexDirection: 'row', backgroundColor: C.green }, sticky && web && { position: 'sticky', top: 0, zIndex: 2 }];
  return (
    <View ref={root}>
      <View style={head}>
        {cols.map(c => (
          <View key={c.key} style={[cell, size(c), { paddingVertical: 9, overflow: CLIP, alignItems: c.right ? 'flex-end' : 'stretch', justifyContent: 'center' }]}>
            {fitBox(c, <Tx w={600} s={11.5} c={C.cream} numberOfLines={c.right ? undefined : 1} style={{ textAlign: c.right ? 'right' : 'left' }}>{sentence(c.label)}</Tx>)}
          </View>
        ))}
      </View>
      {rows.length === 0 && <Tx s={13} c={C.ink3} style={{ padding: 20 }}>{empty}</Tx>}
      {rows.map((r, i) => {
        const inner = cols.map(c => (
          <View key={c.key} style={[cell, size(c), { overflow: CLIP, alignItems: c.right ? 'flex-end' : 'stretch', justifyContent: 'center' }]}>
            {fitBox(c, c.render ? c.render(r) : <Tx s={13.5} numberOfLines={c.right ? undefined : 2}>{r[c.key] == null ? '' : String(r[c.key])}</Tx>)}
          </View>
        ));
        const sel = selected && selected(r);
        const base = { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderColor: C.line };
        return onRowPress
          ? <Pressable key={r.id || i} accessibilityRole="button" onPress={() => onRowPress(r)} style={({ hovered }) => [base, { backgroundColor: sel ? C.greenTint : hovered ? C.hover : 'transparent' }]}>{inner}</Pressable>
          : <View key={r.id || i} style={base}>{inner}</View>;
      })}
    </View>
  );
}

/** Horizontal bar list (allocation, breakdowns). items: [{ key, label, sub?, value (text), pct (0-100), color }].
 *  dp: decimals on the percentage (holdings show 2). */
export function BarList({ items, style, dp = 0 }) {
  return (
    <View style={[{ gap: 14 }, style]}>
      {items.map(it => (
        <View key={it.key || it.label}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: it.color || C.green }} />
            <Tx w={600} s={13} numberOfLines={1} style={{ flex: 1 }}>{it.label}{it.sub ? <Tx s={12} c={C.ink3}>{'  ' + it.sub}</Tx> : null}</Tx>
            {!!it.value && <Amt s={12.5} c={C.ink2}>{it.value}</Amt>}
            <Amt w={600} s={13} style={{ width: dp ? 64 : 48, textAlign: 'right' }}>{dp ? (Number(it.pct) || 0).toFixed(dp) : Math.round(it.pct)}%</Amt>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: C.track, marginTop: 7, overflow: 'hidden' }}>
            <View style={{ width: Math.max(1.5, Math.min(100, it.pct)) + '%', height: 6, borderRadius: 3, backgroundColor: it.color || C.green }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Key-value list (details panels). items: [[label, value, color?]] */
export function KeyVals({ items, style }) {
  return (
    <View style={style}>
      {items.map(([k, v, col], i) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
          <Tx s={13} c={C.ink2}>{k}</Tx>
          {typeof v === 'string' || typeof v === 'number' ? <Amt s={13.5} w={600} c={col || C.ink}>{v}</Amt> : v}
        </View>
      ))}
    </View>
  );
}

/** "View all ›" style text link. */
export const TextLink = ({ label, onPress, c = C.green }) => (
  <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 0.7 : 1 })}>
    <Tx w={600} s={13} c={c}>{label}</Tx><ChevronRight s={11} c={c} />
  </Pressable>
);

/** Status badge. tone: 'ok' | 'warn' | 'bad' | 'neutral' */
export function Pill({ label, tone = 'neutral' }) {
  const [fg, bg] = { ok: [C.pos, C.posTint], warn: [C.goldText, C.goldTint], bad: [C.red, C.redTint], neutral: [C.ink2, C.track] }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' }}>
      <Tx w={600} s={11.5} c={fg}>{sentence(String(label))}</Tx>
    </View>
  );
}

/** Loading / empty / error blocks. */
export const Loading = ({ rows = 4 }) => (
  <View style={{ gap: 12 }}>{Array.from({ length: rows }).map((_, i) => <View key={i} style={{ height: 56, borderRadius: 10, backgroundColor: C.track }} />)}</View>
);
export const Empty = ({ children, title }) => (
  <Card style={{ paddingVertical: 36, paddingHorizontal: 28, alignItems: 'center' }}>
    {!!title && <Tx w={600} s={15} center style={{ marginBottom: 6 }}>{title}</Tx>}
    <Tx s={13.5} c={C.ink2} center lh={1.6} style={{ maxWidth: 520 }}>{children}</Tx>
  </Card>
);
export function ErrorBlock({ msg, onRetry }) {
  return (
    <Card style={{ padding: 28, alignItems: 'center' }}>
      <Tx w={600} s={15} center>We couldn’t load this</Tx>
      <Tx s={13} c={C.ink2} center lh={1.5} style={{ marginTop: 6, maxWidth: 520 }}>{userMessage(msg)}</Tx>
      {!!onRetry && <Btn label="Try again" kind="outline" small onPress={onRetry} style={{ marginTop: 14 }} />}
    </Card>
  );
}

/** Centred modal dialog. */
export function Dialog({ visible, onClose, title, children, width = 560 }) {
  if (!visible) return null;
  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(14,26,21,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <Card style={{ width, maxWidth: '100%', maxHeight: '88%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderColor: C.line }}>
            <Tx w={600} s={16} style={{ flex: 1 }}>{title}</Tx>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={({ hovered }) => ({ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? C.hover : 'transparent' })}>
              <Tx w={600} s={15} c={C.ink3}>✕</Tx>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 22 }}>{children}</ScrollView>
        </Card>
      </View>
    </Modal>
  );
}

/* ── The phone app in the stores ───────────────────────────────────────────────────────────────────────────
 * Same addresses as the server's update prompt (myQode app/api/mobile/app-version: APP_IOS_URL / APP_ANDROID_URL). */
export const STORE_LINKS = {
  ios: 'https://apps.apple.com/in/app/myqode/id6761060137',
  android: 'https://play.google.com/store/apps/details?id=com.qodeinvest.myqode',
};
// Store marks (Simple Icons, CC0), drawn in the badge's text colour.
const APPLE_MARK = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
const PLAY_MARK = 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z';
const openStore = url => {
  if (web && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  else Linking.openURL(url).catch(() => {});
};

function StoreBadge({ url, mark, top, name, dark }) {
  const fg = dark ? C.cream : C.ink;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={top + ' ' + name} onPress={() => openStore(url)}
      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, height: 42, paddingLeft: 11, paddingRight: 14, borderRadius: 9, borderWidth: 1,
        borderColor: dark ? 'rgba(239,236,211,0.28)' : C.line2, backgroundColor: hovered ? (dark ? 'rgba(239,236,211,0.08)' : C.hover) : 'transparent' })}>
      <Svg width={18} height={18} viewBox="0 0 24 24"><Path d={mark} fill={fg} /></Svg>
      <View>
        <Tx s={9.5} c={dark ? 'rgba(239,236,211,0.7)' : C.ink3} lh={1.1}>{top}</Tx>
        <Tx w={600} s={13.5} c={fg} lh={1.2} numberOfLines={1}>{name}</Tx>
      </View>
    </Pressable>
  );
}

// The sidebar's store link: just the mark in a small square (the sidebar is too narrow for two full badges).
function StoreIcon({ url, mark, label, dark }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => openStore(url)}
      style={({ hovered }) => ({ width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
        borderColor: dark ? 'rgba(239,236,211,0.22)' : C.line2, backgroundColor: hovered ? (dark ? 'rgba(239,236,211,0.1)' : C.hover) : 'transparent' })}>
      <Svg width={15} height={15} viewBox="0 0 24 24"><Path d={mark} fill={dark ? C.cream : C.ink} /></Svg>
    </Pressable>
  );
}

/** "Get the myQode app": App Store and Google Play buttons. dark: for the green brand panels. compact: one line
 *  (label, then the two store marks) for the sidebars. center: label and buttons centred (the sign-in page). */
export function AppLinks({ dark, compact, center, label = 'Get the myQode app', style }) {
  if (compact) return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
      <Tx w={600} s={11.5} c={dark ? 'rgba(239,236,211,0.7)' : C.ink2} style={{ flex: 1 }} numberOfLines={1}>{label}</Tx>
      <StoreIcon dark={dark} url={STORE_LINKS.ios} mark={APPLE_MARK} label="Download on the App Store" />
      <StoreIcon dark={dark} url={STORE_LINKS.android} mark={PLAY_MARK} label="Get it on Google Play" />
    </View>
  );
  return (
    <View style={[{ gap: 10, alignItems: center ? 'center' : 'stretch' }, style]}>
      {!!label && <Tx w={600} s={12} c={dark ? 'rgba(239,236,211,0.75)' : C.ink2} center={center}>{label}</Tx>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start', gap: 10 }}>
        <StoreBadge dark={dark} url={STORE_LINKS.ios} mark={APPLE_MARK} top="Download on the" name="App Store" />
        <StoreBadge dark={dark} url={STORE_LINKS.android} mark={PLAY_MARK} top="Get it on" name="Google Play" />
      </View>
    </View>
  );
}
