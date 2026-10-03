import React, { useEffect } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import MyQode from './src/main';
import CrashGuard from './src/crashGuard';
import { initMonitoring, wrapRoot } from './src/monitoring';

initMonitoring();

// Web: a deploy replaces the hashed bundle, but an open tab keeps running the old one. When the tab comes back into
// view, compare the page's bundle with the server's and reload onto the new build.
function useWebBuildRefresh() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const mine = (document.querySelector('script[src*="/_expo/static/js/web/"]') || {}).src;
    if (!mine) return undefined; // dev server: Metro handles reloads
    const bundle = s => (s.match(/_expo\/static\/js\/web\/[^"']+\.js/) || [])[0];
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(location.pathname, { cache: 'no-store' }).then(r => r.text()).then(html => {
        const live = bundle(html);
        if (live && !mine.endsWith(live)) location.reload();
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    return () => { document.removeEventListener('visibilitychange', check); };
  }, []);
}

function App() {
  useWebBuildRefresh();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 1024;   // signed in: src/web/desktop.js dashboard
  const [loaded] = useFonts({
    PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold,
    Lato_400Regular, Lato_700Bold, Lato_900Black,
    Inter_400Regular, Inter_600SemiBold, Inter_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#001008' }} />;
  const app = (
    <SafeAreaProvider>
      <CrashGuard><MyQode desktop={desktop} /></CrashGuard>
    </SafeAreaProvider>
  );
  if (Platform.OS !== 'web') return app;
  if (desktop) return <View style={{ flex: 1, backgroundColor: '#001008' }}>{app}</View>;   // MyQode lays out desktop itself
  // Web (served at /app on the myQode server): the phone layout in a centred column on wide screens, on the
  // brand's dark green — screens, sheets and pages all stay inside it.
  return (
    <View style={{ flex: 1, backgroundColor: '#001008', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden', backgroundColor: '#EFECD3', boxShadow: '0 0 40px rgba(0,0,0,0.35)' }}>
        {app}
      </View>
    </View>
  );
}

export default wrapRoot(App);
