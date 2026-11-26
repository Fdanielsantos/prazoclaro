import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DB_NAME, migrar } from '@/db/schema';
import '@/notificacoes';
import { cores } from '@/theme';

SplashScreen.preventAutoHideAsync();

const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: cores.primaria, background: cores.fundo, card: cores.card, text: cores.texto },
};

export default function RootLayout() {
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrar}>
      <ThemeProvider value={tema}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: cores.primaria,
            headerTitleStyle: { color: cores.texto },
            headerBackTitle: 'Voltar',
            contentStyle: { backgroundColor: cores.fundo },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="intimacao/[id]" options={{ title: 'Intimação' }} />
          <Stack.Screen name="intimacao/nova" options={{ title: 'Colar intimação', presentation: 'modal' }} />
          <Stack.Screen name="prazo/[id]" options={{ title: 'Prazo' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
