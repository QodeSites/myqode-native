import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import MyQode from './src/main';

export default function App() {
  const [loaded] = useFonts({
    PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold,
    Lato_400Regular, Lato_700Bold, Lato_900Black,
    Inter_400Regular, Inter_600SemiBold, Inter_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#001008' }} />;
  return (
    <SafeAreaProvider>
      <MyQode />
    </SafeAreaProvider>
  );
}
