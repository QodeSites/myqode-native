// Chart pieces built with react-native-svg.
import React, { useState, useRef, useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from 'react-native-svg';
import { C, Tx } from '../ui';

const fmtDate = d => { const t = new Date(d); return isNaN(t) ? String(d) : t.getDate() + '/' + (t.getMonth() + 1) + '/' + t.getFullYear(); };
const signed = (v, dp = 2) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(dp) + '%';

// Touch / hover tooltip over a chart, like the web's: date, portfolio and benchmark at that point,
// plus the raw NAV / index level when the API sends them.
// tip = { kind: 'growth' | 'dd', dates, pts, bench, navs, bvals, xy, bxy, benchName }; vw/vh = viewBox size.
function ChartTip({ tip, vw, vh, height, lineColor, children }) {
  const ref = useRef(null);
  const box = useRef({ left: 0, w: 0 });     // chart's window position, measured when a gesture starts
  const pending = useRef(null), raf = useRef(null), timer = useRef(null), cur = useRef(null);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(null);
  const n = tip && tip.pts ? tip.pts.length : 0;
  const sig = n ? n + ':' + tip.dates[0] + ':' + tip.dates[n - 1] : '';
  useEffect(() => { cur.current = null; setIdx(null); }, [sig]);
  useEffect(() => () => { clearTimeout(timer.current); if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const measure = () => { if (ref.current && ref.current.measureInWindow) ref.current.measureInWindow((x, y, ww) => { if (ww) box.current = { left: x, w: ww }; }); };
  const show = i => { if (i !== cur.current) { cur.current = i; setIdx(i); } };
  // pageX is reliable on every platform (locationX depends on which child got the touch)
  const at = pageX => {
    if (n < 2 || pageX == null || isNaN(pageX)) return;
    clearTimeout(timer.current);
    pending.current = pageX;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const bw = box.current.w || w; if (!bw) return;
      const r = (pending.current - box.current.left) / bw;
      show(Math.max(0, Math.min(n - 1, Math.round(r * (n - 1)))));
    });
  };
  const release = () => { clearTimeout(timer.current); timer.current = setTimeout(() => show(null), 3000); };

  let body = null;
  if (n >= 2 && idx != null && tip.xy[idx] && w) {
    const growth = tip.kind === 'growth';
    // growth vs the web's anchor (NAV 10 when the history doesn't start at 10), else vs the first point in the window
    const v = growth ? (tip.growthBase != null && tip.navs && tip.navs[idx] != null ? (tip.navs[idx] / tip.growthBase - 1) * 100 : (tip.pts[idx] / tip.pts[0] - 1) * 100) : tip.pts[idx];
    const bv = tip.bench ? (growth ? (tip.bench[idx] / tip.bench[0] - 1) * 100 : tip.bench[idx]) : null;
    const nav = tip.navs && tip.navs[idx], bval = tip.bvals && tip.bvals[idx];
    const px = (tip.xy[idx][0] / vw) * w, py = (tip.xy[idx][1] / vh) * height;
    const bpy = tip.bxy && tip.bxy[idx] ? (tip.bxy[idx][1] / vh) * height : null;
    const boxW = 176, boxH = 46 + (bv != null ? 16 : 0) + (nav != null ? 15 : 0) + (bv != null && bval != null ? 15 : 0);
    const left = Math.max(0, Math.min(w - boxW, px > w / 2 ? px - boxW - 10 : px + 10));   // beside the finger, not under it
    body = (
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height, pointerEvents: 'none' }}>
        <View style={{ position: 'absolute', left: px - 0.5, top: 0, width: 1, height, backgroundColor: 'rgba(156,163,175,0.8)' }} />
        {bpy != null && <View style={{ position: 'absolute', left: px - 3, top: bpy - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: C.gray }} />}
        <View style={{ position: 'absolute', left: px - 4.5, top: py - 4.5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: lineColor, borderWidth: 1.5, borderColor: '#fff' }} />
        <View style={{
          position: 'absolute', left, width: boxW, top: Math.max(-6, Math.min(height - boxH, py - boxH / 2)),
          backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(55,88,79,0.25)', paddingVertical: 7, paddingHorizontal: 10,
        }}>
          <Tx w={700} s={11} c={C.ink}>{fmtDate(tip.dates[idx])}</Tx>
          <Tx w={700} s={11} c={growth ? C.green : C.red} style={{ marginTop: 3 }}>{growth ? 'Portfolio Growth' : 'Drawdown'}: {signed(v)}</Tx>
          {nav != null && <Tx s={10.5} c={C.muted}>NAV: {nav}</Tx>}
          {bv != null && <Tx w={700} s={11} c={C.muted} style={{ marginTop: 3 }} numberOfLines={1}>{tip.benchName}{growth ? '' : ' DD'}: {signed(bv)}</Tx>}
          {bv != null && bval != null && <Tx s={10.5} c={C.muted}>Value: {Number(bval).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Tx>}
        </View>
      </View>
    );
  }
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={e => { setW(e.nativeEvent.layout.width); measure(); }}
      onStartShouldSetResponder={() => n >= 2}
      onMoveShouldSetResponder={() => n >= 2}
      onResponderTerminationRequest={() => false}
      // returning true blocks the native ScrollView from taking the gesture, so the page doesn't scroll while scrubbing
      onResponderGrant={e => { const x = e.nativeEvent.pageX; measure(); at(x); return true; }}
      onResponderMove={e => at(e.nativeEvent.pageX)}
      onResponderRelease={release}
      onResponderTerminate={release}
      onMouseEnter={measure}
      onMouseMove={e => at(e.nativeEvent.pageX)}
      onMouseLeave={() => show(null)}
      style={{ height }}
    >
      <View style={{ pointerEvents: 'none' }}>{children}</View>
      {body}
    </View>
  );
}

// y-axis tick labels (top, middle, bottom) drawn over the chart, and x-axis dates under it.
function Axes({ yTicks, xDates, height, color, children }) {
  const ys = [8, height / 2, height - 8];
  return (
    <View>
      <View>
        {children}
        {(yTicks || []).map((t, i) => (
          <Tx key={i} s={9} c={color} style={{ position: 'absolute', left: 0, top: ys[i] - (i === 2 ? 12 : -1), pointerEvents: 'none' }}>{t}</Tx>
        ))}
      </View>
      {!!(xDates && xDates.length) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          {xDates.map((d, i) => <Tx key={i} s={9} c={color}>{d}</Tx>)}
        </View>
      )}
    </View>
  );
}

// Home NAV chart: grid lines at the axis ticks, area fill, benchmark, main line. Same series and scale as the web chart.
export function NavChart({ line, area, bench, tip, yTicks, xDates, height = 120 }) {
  return (
    <Axes yTicks={yTicks} xDates={xDates} height={height} color={C.gray}>
    <ChartTip tip={tip} vw={330} vh={120} height={height} lineColor={C.green}>
    <Svg width="100%" height={height} viewBox="0 0 330 120" preserveAspectRatio="none">
      <Defs>
        <SvgGrad id="cfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.green} stopOpacity={0.15} />
          <Stop offset="1" stopColor={C.green} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      <Line x1={0} y1={8} x2={330} y2={8} stroke={C.gray} strokeOpacity={0.3} strokeDasharray="3 3" />
      <Line x1={0} y1={60} x2={330} y2={60} stroke={C.gray} strokeOpacity={0.3} strokeDasharray="3 3" />
      <Line x1={0} y1={112} x2={330} y2={112} stroke={C.gray} strokeOpacity={0.3} strokeDasharray="3 3" />
      <Path d={area} fill="url(#cfill)" />
      <Path d={bench} fill="none" stroke={C.gray} strokeWidth={1.3} />
      <Path d={line} fill="none" stroke={C.green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
    </ChartTip>
    </Axes>
  );
}

// Drawdown chart: values ≤ 0, zero line at the top, red area below.
export function DrawdownChart({ line, area, bench, tip, height = 100 }) {
  return (
    <ChartTip tip={tip} vw={330} vh={100} height={height} lineColor={C.red}>
    <Svg width="100%" height={height} viewBox="0 0 330 100" preserveAspectRatio="none">
      <Defs>
        <SvgGrad id="ddfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.red} stopOpacity={0.05} />
          <Stop offset="1" stopColor={C.red} stopOpacity={0.22} />
        </SvgGrad>
      </Defs>
      <Line x1={0} y1={8} x2={330} y2={8} stroke={C.gray} strokeOpacity={0.5} />
      <Path d={area} fill="url(#ddfill)" />
      <Path d={bench} fill="none" stroke={C.gray} strokeWidth={1.2} strokeDasharray="4 4" />
      <Path d={line} fill="none" stroke={C.red} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
    </ChartTip>
  );
}

// Portfolio performance chart (dark header): benchmark + gold line with glow, same series and scale as the web chart.
export function PerfChart({ line, bench, tip, yTicks, xDates, height = 110 }) {
  return (
    <Axes yTicks={yTicks} xDates={xDates} height={height} color="rgba(239,236,211,0.5)">
    <ChartTip tip={tip} vw={358} vh={110} height={height} lineColor={C.gold}>
    <Svg width="100%" height={height} viewBox="0 0 358 110" preserveAspectRatio="none">
      <Line x1={0} y1={8} x2={358} y2={8} stroke={C.gray} strokeOpacity={0.25} strokeDasharray="3 3" />
      <Line x1={0} y1={55} x2={358} y2={55} stroke={C.gray} strokeOpacity={0.25} strokeDasharray="3 3" />
      <Line x1={0} y1={102} x2={358} y2={102} stroke={C.gray} strokeOpacity={0.25} strokeDasharray="3 3" />
      <Path d={bench} fill="none" stroke={C.gray} strokeWidth={1.2} opacity={0.7} />
      <Path d={line} fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" opacity={0.14} />
      <Path d={line} fill="none" stroke={C.gold} strokeWidth={2} strokeLinecap="round" />
    </Svg>
    </ChartTip>
    </Axes>
  );
}

// Holdings allocation donut. Slices as [{pct, color}]; drawn from 12 o'clock.
export function Donut({ slices, count = slices.length, size = 108 }) {
  const CIRC = 2 * Math.PI * 50;
  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={50} fill="none" stroke="rgba(55,88,79,0.12)" strokeWidth={13} />
        {slices.map((s, i) => {
          const el = (
            <Circle key={i} cx={60} cy={60} r={50} fill="none" stroke={s.color} strokeWidth={13}
              strokeDasharray={`${(s.pct / 100) * CIRC} ${CIRC}`}
              strokeDashoffset={-(offset / 100) * CIRC}
              transform="rotate(-90 60 60)" />
          );
          offset += s.pct;
          return el;
        })}
        <SvgText x={60} y={57} textAnchor="middle" fill={C.muted} fontSize={10} fontWeight="700" letterSpacing={0.8}>ALLOC</SvgText>
        <SvgText x={60} y={73} textAnchor="middle" fill={C.ink} fontSize={15} fontWeight="600">{count}</SvgText>
      </Svg>
    </View>
  );
}
