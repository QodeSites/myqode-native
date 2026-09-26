// Main app frame: scrolling dark-curtain header + cream zone per tab,
// fixed bottom nav with sliding gold thread, sheets, and success overlay.
import React, { useRef, useEffect } from 'react';
import { View, Pressable, Animated, Dimensions, Easing, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Tx, Amt, Chip, CurveCap, Fade, GoldThreads, useUI } from '../ui';
import { Bell, Refresh, ChevronDown, FamilyIcon, ChevronRight, TabHome, TabPortfolio, TabDocs, TabServices, TabMore } from '../icons';
import { PerfChart } from './charts';
import { HomeCream, PortfolioCream, HoldingsCream, HomeSkeleton, OtherSkeleton } from './tabs';
import { DocsCream } from './docs';
import { ServicesCream, RequestSheets } from './services';
import { MoreCream } from './more';
import { PageHost } from './pages';
import { SwitchSheet, SettingsSheet, NotifsSheet } from './sheets';

function Header({ V, insets }) {
  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable onPress={V.openSwitch} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(239,236,211,0.3)',
        borderRadius: 999, paddingVertical: 5, paddingRight: 12, paddingLeft: 5, minHeight: 38, flexShrink: 1,
      }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
          {V.isFamily ? <FamilyIcon s={15} /> : <Tx w={700} s={10} c={C.ink}>{V.acctInitials}</Tx>}
        </View>
        <Tx w={700} s={13} c={C.cream} numberOfLines={1} style={{ flexShrink: 1 }}>{V.acctName}</Tx>
        {!!V.acctTag && <Tx w={700} s={13} c={C.gold}>· {V.acctTag}</Tx>}
        {V.multiAcct && <ChevronDown />}
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable onPress={V.refresh} accessibilityLabel="Refresh" style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(239,236,211,0.22)', alignItems: 'center', justifyContent: 'center', opacity: V.refreshing ? 0.45 : 1 }}>
        <Refresh />
      </Pressable>
      <Pressable onPress={V.openNotifs} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(239,236,211,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Bell />
        {V.hasNotif && <View style={{ position: 'absolute', top: 10, right: 11, width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold }} />}
      </Pressable>
    </View>
  );
}

function DarkZone({ V }) {
  return (
    <>
      {!!V.viewing && (
        // A partner viewing one of their investors (read-only): who this is, and the way back.
        <View style={{ marginTop: 12, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.gold, borderRadius: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, backgroundColor: 'rgba(218,189,56,0.1)' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx w={700} s={9.5} ls={0.14} c={C.gold}>VIEWING · READ-ONLY</Tx>
            <Tx w={700} s={12.5} c={C.cream} numberOfLines={1} style={{ marginTop: 2 }}>{V.viewing}</Tx>
          </View>
          <Pressable onPress={V.exitView} accessibilityRole="button" accessibilityLabel="Back to the partner panel" style={{ backgroundColor: C.gold, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Tx w={700} s={11} c={C.ink}>Back to partner</Tx>
          </Pressable>
        </View>
      )}
      {V.testMode && (
        <View style={{ paddingTop: 10, paddingHorizontal: 22, flexDirection: 'row' }}>
          <View style={{ borderWidth: 1, borderColor: C.red, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Tx w={700} s={9.5} ls={0.18} c={C.red}>TEST MODE · CLIENT CONTACT BLOCKED{V.impersonated ? ' · IMPERSONATING' : ''}</Tx>
          </View>
        </View>
      )}
      {V.isDemo && (
        <View style={{ paddingTop: 10, paddingHorizontal: 22, flexDirection: 'row' }}>
          <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Tx w={700} s={9.5} ls={0.18} c={C.ink}>DEMO · SAMPLE DATA</Tx>
          </View>
        </View>
      )}
      {V.hasViews && (
        <View style={{ marginTop: 12, marginHorizontal: 22 }}>
          <Tx w={700} s={9.5} ls={0.14} c={C.cream60}>DATA SOURCE</Tx>
          <View style={{ marginTop: 6, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(239,236,211,0.25)', borderRadius: 999, padding: 3 }}>
            {V.viewChips.map(ch => (
              <Pressable key={ch.label} onPress={ch.pick} style={{ flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: 'center', backgroundColor: ch.active ? C.gold : 'transparent' }}>
                <Tx w={700} s={10.5} c={ch.active ? C.ink : C.cream60} numberOfLines={1}>{ch.label}</Tx>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {V.isHome && (
        <Fade style={{ paddingTop: 24, paddingHorizontal: 22 }}>
          <Tx w={700} s={11} ls={0.14} c={C.gold}>TOTAL PORTFOLIO VALUE</Tx>
          <Amt s={36} c={C.cream} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 8, letterSpacing: -0.5 }}>{V.heroValue}</Amt>
          <View style={{ width: 52, height: 2, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 }} />
          {!!V.asOf && <Tx s={12} c={C.cream60}>As of {V.asOf}</Tx>}
          {V.needsYou && (
            <Pressable onPress={V.goServices} style={{
              flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16,
              borderWidth: 1, borderColor: C.gold35, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
            }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold }} />
              <Tx s={11.5} c="rgba(239,236,211,0.85)" style={{ flex: 1 }}>{V.needsYouMsg}</Tx>
              <ChevronRight s={12} c={C.gold} w={1.6} />
            </Pressable>
          )}
        </Fade>
      )}
      {V.isPfGroup && (
        <View style={{ marginTop: 20, marginHorizontal: 22, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(239,236,211,0.25)', borderRadius: 999, padding: 3 }}>
          <Pressable onPress={V.segPerf} style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: V.isPortfolio ? C.gold : 'transparent' }}>
            <Tx w={700} s={11} ls={0.08} c={V.isPortfolio ? C.ink : C.cream60}>PERFORMANCE</Tx>
          </Pressable>
          <Pressable onPress={V.segHold} style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: V.isHoldings ? C.gold : 'transparent' }}>
            <Tx w={700} s={11} ls={0.08} c={V.isHoldings ? C.ink : C.cream60}>HOLDINGS</Tx>
          </Pressable>
        </View>
      )}
      {V.isPortfolio && (
        <Fade style={{ paddingTop: 16, paddingHorizontal: 22 }}>
          <Tx w={700} s={11} ls={0.14} c={C.gold}>PERFORMANCE</Tx>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
            <Tx f="play" w={600} s={24} c={C.cream}>NAV Performance</Tx>
            <Amt s={15} c={C.gold}>{V.growthNow}</Amt>
          </View>
          <View style={{ marginTop: 10 }}>
            <PerfChart line={V.perfLine} bench={V.perfBench} tip={V.perfTip} yTicks={V.yTicks} xDates={V.xDates} />
          </View>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 2, backgroundColor: C.gold }} />
              <Tx s={10.5} c={C.cream60}>Your portfolio</Tx>
            </View>
            {V.hasBench && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 14, height: 2, backgroundColor: C.gray }} />
                <Tx s={10.5} c={C.cream60}>{V.benchName}</Tx>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Tx s={10.5} c={C.cream40}>As of {V.asOf}</Tx>
          </View>
        </Fade>
      )}
      {V.isHoldings && (
        <Fade style={{ paddingTop: 16, paddingHorizontal: 22 }}>
          <Tx w={700} s={11} ls={0.14} c={C.gold}>HOLDINGS</Tx>
          <Tx f="play" w={600} s={24} c={C.cream} style={{ marginTop: 6 }}>{V.holdCount} {V.holdCount === 1 ? 'strategy' : 'strategies'}</Tx>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
            <Amt s={12} c={C.cream60}>{V.heroValue}</Amt>
            <Tx s={12} c={C.cream60}> · As of {V.asOf}</Tx>
          </View>
        </Fade>
      )}
      {V.isDocs && (
        <Fade style={{ paddingTop: 22, paddingHorizontal: 22 }}>
          <Tx w={700} s={11} ls={0.14} c={C.gold}>DOCUMENTS</Tx>
          <Tx f="play" w={600} s={24} c={C.cream} style={{ marginTop: 6 }}>Account Documents</Tx>
          <Tx s={12} c={C.cream60} style={{ marginTop: 6 }}>Agreement, account opening documents and CML</Tx>
        </Fade>
      )}
      {V.isServices && (
        <Fade style={{ paddingTop: 22, paddingHorizontal: 22 }}>
          <Tx w={700} s={11} ls={0.14} c={C.gold}>SERVICES</Tx>
          {V.svcPending ? (
            <>
              <Tx f="play" w={600} s={24} c={C.cream} style={{ marginTop: 6 }}>1 transfer processing</Tx>
              <Tx s={12} c={C.cream60} style={{ marginTop: 6 }}>{V.svcPendingSub}</Tx>
            </>
          ) : (
            <Tx f="play" w={600} s={24} c={C.cream} style={{ marginTop: 6 }}>Account Services</Tx>
          )}
        </Fade>
      )}
      {V.isMore && (
        <Fade style={{ paddingTop: 22, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            {V.isFamily ? <FamilyIcon s={26} /> : <Tx w={700} s={16} c={C.ink}>{V.acctInitials}</Tx>}
          </View>
          <View style={{ flex: 1 }}>
            <Tx f="play" w={600} s={22} c={C.cream}>{V.acctName}{V.acctTag ? <Tx f="play" w={600} s={22} c={C.gold}> · {V.acctTag}</Tx> : null}</Tx>
            <Tx s={11.5} c={C.cream60} style={{ marginTop: 3 }}>{V.acctCode}{V.sinceLbl ? ' · ' + V.sinceLbl : ''}</Tx>
          </View>
        </Fade>
      )}
    </>
  );
}

const NAV = [
  { key: 'home', label: 'Home', Icon: TabHome, go: 'goHome' },
  { key: 'portfolio', label: 'Portfolio', Icon: TabPortfolio, go: 'goPortfolio' },
  { key: 'docs', label: 'Documents', Icon: TabDocs, go: 'goDocs' },
  { key: 'services', label: 'Services', Icon: TabServices, go: 'goServices' },
  { key: 'more', label: 'More', Icon: TabMore, go: 'goMore' },
];

function BottomNav({ V, insets }) {
  const { rm } = useUI();
  const W = Dimensions.get('window').width;
  const seg = W / 5;
  const x = useRef(new Animated.Value(V.navIdx * seg + (seg - 30) / 2)).current;
  useEffect(() => {
    Animated.timing(x, {
      toValue: V.navIdx * seg + (seg - 30) / 2,
      duration: rm ? 0 : 300, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true,
    }).start();
  }, [V.navIdx]);
  return (
    <LinearGradient colors={['#02422B', '#001008']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 16) }}>
      
      <View style={{ flexDirection: 'row', paddingBottom: 8 }}>
        {NAV.map((n, i) => {
          const active = V.navIdx === i;
          const col = active ? C.gold : C.cream55;
          return (
            <Pressable key={n.key} onPress={V[n.go]} style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 9, minHeight: 44 }}>
              <n.Icon c={col} />
              <Tx w={700} s={10} c={col}>{n.label}</Tx>
            </Pressable>
          );
        })}
      </View>
      <Animated.View style={{ width: 30, height: 2, borderRadius: 1, backgroundColor: C.gold, transform: [{ translateX: x }] }} />
    </LinearGradient>
  );
}

export default function AppShell({ V }) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  // One scroll view holds every tab: each tab opens at its top, not where the last one was left.
  const scrollRef = useRef(null);
  useEffect(() => {
    const sv = scrollRef.current;
    const node = sv && (sv.scrollTo ? sv : sv.getNode && sv.getNode());
    if (node) node.scrollTo({ y: 0, animated: false });
    scrollY.setValue(0);
  }, [V.tab]);
  const darkY = scrollY.interpolate({ inputRange: [0, 200], outputRange: [0, 44], extrapolate: 'clamp' });
  const strY = scrollY.interpolate({ inputRange: [0, 200], outputRange: [0, 14], extrapolate: 'clamp' });
  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 130 }}
      
        // Pull down to refresh: same reload as the Refresh button in the header.
        refreshControl={<RefreshControl refreshing={!!V.refreshing} onRefresh={V.refresh} tintColor={C.gold} colors={[C.green]} progressViewOffset={insets.top} />}
      >
        <LinearGradient colors={C.darkGrad} locations={[0, 0.62, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ paddingBottom: 106 }}>
          <GoldThreads height={320} />
          <Animated.View style={{ transform: [{ translateY: darkY }] }}>
            <Header V={V} insets={insets} />
            <DarkZone V={V} />
          </Animated.View>
        </LinearGradient>
        <View style={{ marginTop: -48 }}>
          <CurveCap height={46} />
        </View>
        <View style={{ backgroundColor: C.cream, paddingHorizontal: 20, minHeight: 420 }}>
          {!V.loading && !V.hasData && ['home', 'portfolio', 'holdings'].includes(V.tab) && (
            <View style={{ marginTop: -14, padding: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center' }}>
              <Tx w={700} s={14} center>We couldn’t load your portfolio</Tx>
              <Tx s={12} c={C.muted} center lh={1.5} style={{ marginTop: 6 }}>{V.dataErr || 'Please try again in a moment.'}</Tx>
              <Pressable onPress={V.retry} style={{ marginTop: 14, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 8, backgroundColor: C.green }}>
                <Tx w={700} s={12} ls={0.08} c={C.gold}>TRY AGAIN</Tx>
              </Pressable>
            </View>
          )}
          {V.isHome && V.loading && <HomeSkeleton />}
          {V.isHome && V.ready && (
            <Animated.View style={{ transform: [{ translateY: strY }] }}>
              <HomeCream V={V} />
            </Animated.View>
          )}
          {V.skelOther && <OtherSkeleton />}
          {V.vPortfolio && <PortfolioCream V={V} />}
          {V.vHoldings && <HoldingsCream V={V} />}
          {V.vDocs && <DocsCream V={V} />}
          {V.vServices && <ServicesCream V={V} />}
          {V.vMore && <MoreCream V={V} />}
        </View>
      </Animated.ScrollView>

      {/* keeps status-bar icons legible when content scrolls beneath them */}
      <LinearGradient colors={['rgba(0,16,8,0.9)', 'rgba(0,16,8,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 14, pointerEvents: 'none' }} />
      <BottomNav V={V} insets={insets} />
      <RequestSheets V={V} />
      <SwitchSheet V={V} />
      <SettingsSheet V={V} />
      <NotifsSheet V={V} />
      {!!V.page && <PageHost V={V} />}
    </View>
  );
}
