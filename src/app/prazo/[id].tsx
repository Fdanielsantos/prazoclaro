import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { textoContagem, urgenciaDe } from '@/components/PrazoCard';
import { Aviso, Botao, Card, Titulo } from '@/components/ui';
import {
  atualizarStatusPrazo,
  diasPuladosDe,
  excluirPrazo,
  lerConfig,
  listarFeriadosLocais,
  obterPrazo,
  Prazo,
  salvarNotifIds,
} from '@/db/repo';
import { agendarAlertas, cancelarAlertas } from '@/notificacoes';
import { diasUteisRestantes } from '@/prazos/calculo';
import { diaSemana, formatBR, hojeISO } from '@/prazos/datas';
import { relatorioCliente } from '@/relatorio';
import { cores, corUrgencia, esp } from '@/theme';

const MOTIVO_ICONE: Record<string, any> = {
  sabado: 'calendar-clear-outline',
  domingo: 'calendar-clear-outline',
  feriado: 'flag-outline',
  feriado_local: 'location-outline',
  recesso: 'snow-outline',
};

export default function DetalhePrazo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [p, setP] = useState<Prazo | null>(null);
  const [uteis, setUteis] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const pr = await obterPrazo(db, Number(id));
    setP(pr);
    if (pr) setUteis(diasUteisRestantes(hojeISO(), pr.data_fim, await listarFeriadosLocais(db)));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!p) return null;
  const u = urgenciaDe(p);
  const c = corUrgencia(u);
  const pulados = diasPuladosDe(p);
  const fds = pulados.filter((d) => d.motivo === 'sabado' || d.motivo === 'domingo').length;
  const especiais = pulados.filter((d) => d.motivo !== 'sabado' && d.motivo !== 'domingo');
  const notifs: string[] = JSON.parse(p.notif_ids || '[]');

  async function alternarStatus() {
    if (!p) return;
    if (p.status === 'pendente') {
      await cancelarAlertas(notifs);
      await salvarNotifIds(db, p.id, []);
      await atualizarStatusPrazo(db, p.id, 'cumprido');
    } else {
      await atualizarStatusPrazo(db, p.id, 'pendente');
      const cfg = await lerConfig(db);
      const ids = await agendarAlertas(p, { hora: cfg.horaAlerta, antecedencia: cfg.antecedencia });
      await salvarNotifIds(db, p.id, ids);
    }
    carregar();
  }

  async function compartilhar() {
    if (!p) return;
    const cfg = await lerConfig(db);
    await Share.share({ message: relatorioCliente(p, cfg.nome) });
  }

  function excluir() {
    Alert.alert('Excluir prazo?', 'Os alertas agendados também serão cancelados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await cancelarAlertas(notifs);
          await excluirPrazo(db, p!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: esp.l, gap: esp.l, paddingBottom: 60 }}>
      <View style={[st.hero, { backgroundColor: c.bg }]}>
        <Text style={[st.heroCont, { color: c.fg }]}>{textoContagem(p)}</Text>
        {p.status === 'pendente' && uteis !== null && uteis > 0 && (
          <Text style={[st.heroSub, { color: c.fg }]}>
            {uteis} dia{uteis === 1 ? '' : 's'} út{uteis === 1 ? 'il' : 'eis'} restante{uteis === 1 ? '' : 's'}
          </Text>
        )}
        <Text style={st.heroData}>{formatBR(p.data_fim)}</Text>
        <Text style={[st.heroDia, { color: c.fg }]}>{diaSemana(p.data_fim)}</Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={st.desc}>{p.descricao}</Text>
        <Text style={st.sec}>
          Proc. {p.processo}
          {p.tribunal ? ` · ${p.tribunal}` : ''}
        </Text>
        {p.orgao && <Text style={st.sec}>{p.orgao}</Text>}
        {p.cliente && <Text style={st.sec}>Cliente: {p.cliente}</Text>}
      </View>

      <Card style={{ gap: 4 }}>
        <Titulo style={{ marginBottom: 8 }}>Como o prazo foi calculado</Titulo>
        <Etapa icone="cloud-done-outline" titulo="Disponibilização no DJEN" data={p.data_disponibilizacao} />
        <Etapa icone="newspaper-outline" titulo="Publicação (1º dia útil seguinte)" data={p.data_publicacao} />
        <Etapa icone="play-outline" titulo="Início da contagem" data={p.data_inicio} />
        <Etapa
          icone="flag"
          titulo={`Vencimento · ${p.dias} dias ${p.contagem === 'uteis' ? 'úteis' : 'corridos'}`}
          data={p.data_fim}
          destaque
          ultimo
        />
        {(fds > 0 || especiais.length > 0) && (
          <View style={st.pulados}>
            <Text style={st.pulTitulo}>Dias desconsiderados</Text>
            {fds > 0 && <Text style={st.pulItem}>• {fds} dia(s) de fim de semana</Text>}
            {especiais.map((d) => (
              <View key={d.data} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name={MOTIVO_ICONE[d.motivo]} size={14} color={cores.textoSec} />
                <Text style={st.pulItem}>
                  {formatBR(d.data)} · {d.descricao}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={notifs.length ? 'notifications' : 'notifications-off-outline'} size={22} color={notifs.length ? cores.primaria : cores.cinza} />
        <Text style={{ flex: 1, fontSize: 14, color: cores.texto }}>
          {notifs.length
            ? `${notifs.length} alerta(s) agendado(s) neste aparelho antes do vencimento.`
            : p.status === 'cumprido'
              ? 'Sem alertas: o prazo foi cumprido.'
              : 'Nenhum alerta futuro agendado (verifique a permissão de notificações).'}
        </Text>
      </Card>

      <Botao titulo="Enviar relatório ao cliente" icone="logo-whatsapp" onPress={compartilhar} />
      <Botao
        titulo={p.status === 'pendente' ? 'Marcar como cumprido' : 'Reabrir prazo'}
        icone={p.status === 'pendente' ? 'checkmark-circle-outline' : 'refresh'}
        variante="secundario"
        onPress={alternarStatus}
      />
      {p.intimacao_id && (
        <Botao titulo="Ver intimação" icone="document-text-outline" variante="texto" onPress={() => router.push(`/intimacao/${p.intimacao_id}`)} />
      )}
      <Botao titulo="Excluir prazo" icone="trash-outline" variante="perigo" onPress={excluir} />
      <Aviso texto="Confira sempre a contagem: suspensões específicas do tribunal (ex.: indisponibilidade do sistema, portarias) não são consideradas automaticamente." />
    </ScrollView>
  );
}

function Etapa({ icone, titulo, data, destaque, ultimo }: { icone: any; titulo: string; data: string; destaque?: boolean; ultimo?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={[st.etIcone, destaque && { backgroundColor: cores.primaria }]}>
          <Ionicons name={icone} size={16} color={destaque ? '#fff' : cores.primaria} />
        </View>
        {!ultimo && <View style={st.etLinha} />}
      </View>
      <View style={{ flex: 1, paddingBottom: ultimo ? 0 : 14 }}>
        <Text style={[st.etTitulo, destaque && { color: cores.primaria }]}>{titulo}</Text>
        <Text style={st.etData}>
          {formatBR(data)} ({diaSemana(data)})
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: 20, padding: esp.xl, alignItems: 'center', gap: 2 },
  heroCont: { fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroSub: { fontSize: 13, fontWeight: '600' },
  heroData: { fontSize: 40, fontWeight: '800', color: cores.texto, marginTop: 6 },
  heroDia: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  desc: { fontSize: 22, fontWeight: '800', color: cores.texto },
  sec: { fontSize: 14, color: cores.textoSec },
  etIcone: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' },
  etLinha: { width: 2, flex: 1, backgroundColor: cores.borda, marginVertical: 2 },
  etTitulo: { fontSize: 14, fontWeight: '700', color: cores.texto },
  etData: { fontSize: 13, color: cores.textoSec },
  pulados: { marginTop: 12, backgroundColor: cores.fundo, borderRadius: 12, padding: 12, gap: 4 },
  pulTitulo: { fontSize: 13, fontWeight: '700', color: cores.texto, marginBottom: 2 },
  pulItem: { fontSize: 13, color: cores.textoSec },
});
