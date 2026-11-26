import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { Prazo } from '@/db/repo';
import { diffDays, formatBR, hojeISO } from '@/prazos/datas';
import { cores, corUrgencia, Urgencia } from '@/theme';

import { Card } from './ui';

export function urgenciaDe(p: Pick<Prazo, 'status' | 'data_fim'>): Urgencia {
  if (p.status === 'cumprido') return 'cumprido';
  const d = diffDays(hojeISO(), p.data_fim);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoje';
  if (d <= 3) return 'proximo';
  return 'ok';
}

export function textoContagem(p: Pick<Prazo, 'status' | 'data_fim'>): string {
  if (p.status === 'cumprido') return 'Cumprido';
  const d = diffDays(hojeISO(), p.data_fim);
  if (d < 0) return `Vencido há ${-d} dia${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  return `Faltam ${d} dias`;
}

export function PrazoCard({ prazo }: { prazo: Prazo }) {
  const u = urgenciaDe(prazo);
  const c = corUrgencia(u);
  const [dia, mes] = formatBR(prazo.data_fim).split('/');
  return (
    <Card onPress={() => router.push(`/prazo/${prazo.id}`)} style={st.card}>
      <View style={[st.barra, { backgroundColor: c.fg }]} />
      <View style={[st.data, { backgroundColor: c.bg }]}>
        <Text style={[st.dia, { color: c.fg }]}>{dia}</Text>
        <Text style={[st.mes, { color: c.fg }]}>{['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][Number(mes) - 1]}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={st.desc} numberOfLines={1}>
          {prazo.descricao}
        </Text>
        <Text style={st.proc} numberOfLines={1}>
          {prazo.processo}
          {prazo.tribunal ? ` · ${prazo.tribunal}` : ''}
        </Text>
        <Text style={[st.cont, { color: c.fg }]}>
          {u === 'cumprido' ? '✓ ' : ''}
          {textoContagem(prazo)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={cores.cinza} />
    </Card>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, overflow: 'hidden' },
  barra: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  data: { width: 54, height: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dia: { fontSize: 22, fontWeight: '800' },
  mes: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 16, fontWeight: '700', color: cores.texto },
  proc: { fontSize: 13, color: cores.textoSec },
  cont: { fontSize: 13, fontWeight: '700' },
});
