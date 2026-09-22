// SVG icons ported 1:1 from the design's inline SVGs.
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C } from './ui';

export const Bell = ({ s = 18, c = C.cream }) => (
  <Svg width={s} height={s + 1} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
    <Path d="M10 18a2 2 0 004 0" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const Refresh = ({ s = 18, c = C.cream }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 11a8 8 0 1 0-2.3 5.7" /><Path d="M20 4v7h-7" />
  </Svg>
);

export const ChevronDown = ({ s = 10, c = 'rgba(239,236,211,0.7)' }) => (
  <Svg width={s} height={s * 0.6} viewBox="0 0 10 6" fill="none">
    <Path d="M1 1l4 4 4-4" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const ChevronRight = ({ s = 14, c = C.muted, w = 1.8 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M9 5l7 7-7 7" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronLeft = ({ s = 20, c = C.cream, w = 1.8 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M15 5l-7 7 7 7" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const FaceID = ({ s = 20, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={18} height={18} rx={5} stroke={c} strokeWidth={1.6} />
    <Path d="M8.5 9.5v-1M15.5 9.5v-1M8 14.5c1 1.2 2.4 1.8 4 1.8s3-.6 4-1.8" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const Check = ({ s = 13, c = C.green, w = 2.2 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SmallCheck = ({ s = 10, c = C.gold, on = true }) => (
  <Svg width={s} height={s} viewBox="0 0 12 12" fill="none" opacity={on ? 1 : 0}>
    <Path d="M2 6.5l2.5 2.5L10 3.5" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Copy = ({ s = 12, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Rect x={9} y={9} width={11} height={11} rx={2} stroke={c} strokeWidth={1.6} />
    <Path d="M5 15V5a1 1 0 011-1h9" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const Phone = ({ s = 16, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

export const MailIcon = ({ s = 16, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={5} width={18} height={14} rx={2} stroke={c} strokeWidth={1.6} />
    <Path d="M3 7l9 6 9-6" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

export const Download = ({ s = 16, c = C.muted }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4v11M7 11l5 5 5-5M5 20h14" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Plus = ({ s = 20, c = C.gold, w = 1.8 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={w} strokeLinecap="round" />
  </Svg>
);

export const ArrowDown = ({ s = 20, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M12 19V5M6 13l6 6 6-6" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const DocIcon = ({ s = 19, c = C.green, w = 1.6 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M7 3h7l4 4v14H7z" stroke={c} strokeWidth={w} strokeLinejoin="round" />
    <Path d="M10 12h6M10 16h6" stroke={c} strokeWidth={w} strokeLinecap="round" />
  </Svg>
);

export const Swap = ({ s = 20, c = C.green, w = 1.8 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 7h13M13 3l4 4-4 4" /><Path d="M20 17H7M11 13l-4 4 4 4" />
  </Svg>
);

export const Bars = ({ s = 19, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const Gear = ({ s = 18, c = C.green }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={c} strokeWidth={1.6} />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={c} strokeWidth={1.4} />
  </Svg>
);

export const Crown = ({ s = 13 }) => (
  <Svg width={s} height={s * 0.85} viewBox="0 0 14 12" fill="none">
    <Path d="M1 3.5l3 2.5L7 1l3 5 3-2.5-1 7.5H2z" fill={C.gold} />
  </Svg>
);

// Bottom tab icons.
export const TabHome = ({ c }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
    <Path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);
export const TabPortfolio = ({ c }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3a9 9 0 109 9h-9z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
    <Path d="M15 3.5A9 9 0 0120.5 9H15z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);
export const TabDocs = ({ c }) => <DocIcon s={21} c={c} w={1.6} />;
export const TabServices = ({ c }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={4} width={7} height={7} rx={1.5} stroke={c} strokeWidth={1.6} />
    <Rect x={13} y={4} width={7} height={7} rx={1.5} stroke={c} strokeWidth={1.6} />
    <Rect x={4} y={13} width={7} height={7} rx={1.5} stroke={c} strokeWidth={1.6} />
    <Rect x={13} y={13} width={7} height={7} rx={1.5} stroke={c} strokeWidth={1.6} />
  </Svg>
);
export const TabMore = ({ c }) => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
    <Circle cx={5} cy={12} r={1.7} fill={c} />
    <Circle cx={12} cy={12} r={1.7} fill={c} />
    <Circle cx={19} cy={12} r={1.7} fill={c} />
  </Svg>
);

// Carousel slide icons (inside double gold rings).
export const CarMountain = ({ s = 34 }) => (
  <Svg width={s} height={s} viewBox="0 0 34 34" fill="none">
    <Path d="M4 24 C11 12 23 12 30 24" stroke={C.gold} strokeWidth={1.5} strokeLinecap="round" />
    <Path d="M10 24 C14 17 20 17 24 24" stroke={C.gold} strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
    <Circle cx={17} cy={9} r={1.5} fill={C.gold} />
  </Svg>
);
export const CarGrid = ({ s = 30 }) => (
  <Svg width={s} height={s} viewBox="0 0 30 30" fill="none">
    <Rect x={4} y={4} width={9.5} height={9.5} rx={2} stroke={C.gold} strokeWidth={1.5} />
    <Rect x={16.5} y={4} width={9.5} height={9.5} rx={2} stroke={C.gold} strokeWidth={1.5} />
    <Rect x={4} y={16.5} width={9.5} height={9.5} rx={2} stroke={C.gold} strokeWidth={1.5} />
    <Rect x={16.5} y={16.5} width={9.5} height={9.5} rx={2} stroke={C.gold} strokeWidth={1.5} />
  </Svg>
);
export const CarDoc = ({ s = 30 }) => (
  <Svg width={s} height={s} viewBox="0 0 30 30" fill="none">
    <Path d="M8 3h10l5 5v19H8z" stroke={C.gold} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M18 3v5h5" stroke={C.gold} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M12 14h7M12 18.5h7" stroke={C.gold} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const Search = ({ s = 16, c = C.gray }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Circle cx={11} cy={11} r={6.5} stroke={c} strokeWidth={1.6} />
    <Path d="M16 16l4.5 4.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const InfoCircle = ({ s = 13, c = C.gray }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={1.5} />
    <Path d="M12 11v5M12 8v.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const GoldDocIcon = ({ s = 20 }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <Path d="M7 3h7l4 4v14H7z" stroke={C.gold} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M14 3v4h4" stroke={C.gold} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M10 13h6M10 16.5h6" stroke={C.gold} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const CarChat = ({ s = 30 }) => (
  <Svg width={s} height={s} viewBox="0 0 30 30" fill="none">
    <Path d="M4 6h22v14H14l-6 5v-5H4z" stroke={C.gold} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M9 11h12M9 15h7" stroke={C.gold} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);
export const CarSliders = ({ s = 30 }) => (
  <Svg width={s} height={s} viewBox="0 0 30 30" fill="none">
    <Path d="M5 9h20M5 15h20M5 21h20" stroke={C.gold} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={12} cy={9} r={2.4} fill={C.ink} stroke={C.gold} strokeWidth={1.5} />
    <Circle cx={19} cy={15} r={2.4} fill={C.ink} stroke={C.gold} strokeWidth={1.5} />
    <Circle cx={10} cy={21} r={2.4} fill={C.ink} stroke={C.gold} strokeWidth={1.5} />
  </Svg>
);
