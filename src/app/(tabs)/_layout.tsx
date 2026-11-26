import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useFocusEffect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { contarNaoLidas, lerConfig } from '@/db/repo';
import { cores } from '@/theme';

export default function TabsLayout() {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'onboarding'>('carregando');
  const [naoLidas, setNaoLidas] = useState(0);

  useFocusEffect(
    useCallback(() => {
      lerConfig(db).then((c) => setEstado(c.onboarded ? 'ok' : 'onboarding'));
      contarNaoLidas(db).then(setNaoLidas);
    }, [db]),
  );

  if (estado === 'carregando') return null;
  if (estado === 'onboarding') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.cinza,
        headerTitleStyle: { color: cores.texto, fontWeight: '700' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: cores.fundo },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
      screenListeners={{ focus: () => contarNaoLidas(db).then(setNaoLidas) }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="intimacoes"
        options={{
          title: 'Intimações',
          tabBarBadge: naoLidas > 0 ? naoLidas : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="mail-unread" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="prazos"
        options={{
          title: 'Prazos',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
