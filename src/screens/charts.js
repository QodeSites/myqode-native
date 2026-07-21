// Chart pieces built with react-native-svg.
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from 'react-native-svg';
import { C } from '../ui';

// Home NAV chart: grid lines, area fill, dashed benchmark, main line.
export function NavChart({ line, area, bench, height = 120 }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 330 120" preserveAspectRatio="none">
      <Defs>
        <SvgGrad id="cfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.green} stopOpacity={0.15} />
          <Stop offset="1" stopColor={C.green} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      <Line x1={0} y1={16} x2={330} y2={16} stroke={C.gray} strokeOpacity={0.3} />
      <Line x1={0} y1={60} x2={330} y2={60} stroke={C.gray} strokeOpacity={0.3} />
      <Line x1={0} y1={104} x2={330} y2={104} stroke={C.gray} strokeOpacity={0.3} />
      <Path d={area} fill="url(#cfill)" />
      <Path d={bench} fill="none" stroke={C.gray} strokeWidth={1.3} strokeDasharray="4 4" />
      <Path d={line} fill="none" stroke={C.green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// Portfolio performance chart: dashed benchmark + gold line with glow.
export function PerfChart({ line, bench, height = 110 }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 358 110" preserveAspectRatio="none">
      <Path d={bench} fill="none" stroke={C.gray} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.6} />
      <Path d={line} fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" opacity={0.14} />
      <Path d={line} fill="none" stroke={C.gold} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Holdings allocation donut. Slices as [{pct, color}]; drawn from 12 o'clock.
export function Donut({ slices, size = 108 }) {
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
        <SvgText x={60} y={73} textAnchor="middle" fill={C.ink} fontSize={15} fontWeight="600">4</SvgText>
      </Svg>
    </View>
  );
}
