import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { textoContagem, urgenciaDe } from '@/components/PrazoCard';
import { Aviso, Botao, Card, Titulo } from '@/components/ui';
import { exportarParaAgenda } from '@/agenda';
import {
  atualizarStatusPrazo,
  contextoCalendario,
  diasPuladosDe,
  excluirPrazo,
  ignorarRevisao,
  lerConfig,
  lerJSON,
  listarRevisoes,
  obterPrazo,
  Prazo,
  RevisaoPrazo,
  salvarNotifIds,
} from '@/db/repo';
import { agendarAlertas, cancelarAlertas } from '@/notificacoes';
import { diasUteisRestantes } from '@/prazos/calculo';
import { diaSemana, formatBR, hojeISO } from '@/prazos/datas';
import { agruparDiasNaoUteis, relatorioCliente, textoTempestividade } from '@/relatorio';
import { aplicarRevisao } from '@/revisao';
import { cores, corUrgencia, esp } from '@/theme';

export default function DetalhePrazo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [p, setP] = useState<Prazo | null>(null);
  const [uteis, setUteis] = useState<number | null>(null);
  const [revisao, setRevisao] = useState<RevisaoPrazo | null>(null);

  const carregar = useCallback(async () => {
    const pr = await obterPrazo(db, Number(id));
    setP(pr);
    if (!pr) return;
    setUteis(diasUteisRestantes(hojeISO(), pr.data_fim, await contextoCalendario(db, pr.tribunal)));
    setRevisao(pr.status === 'pendente' ? ((await listarRevisoes(db)).find((r) => r.prazo.id === pr.id) ?? null) : null);
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
  const especiais = agruparDiasNaoUteis(pulados);
  const avisos = lerJSON<string>(p.avisos);
  const notifs = lerJSON<string>(p.notif_ids);

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

  async function agenda() {
    if (!p) return;
    const cfg = await lerConfig(db);
    const ok = await exportarParaAgenda(p, cfg.antecedencia);
    if (!ok) Alert.alert('Indisponível', 'O compartilhamento de arquivos não está disponível neste aparelho.');
  }

  async function tempestividade() {
    if (!p) return;
    await Share.share({ message: textoTempestividade(p) });
  }

  async function aplicar() {
    if (!revisao) return;
    await aplicarRevisao(db, revisao);
    carregar();
  }

  async function manter() {
    if (!revisao) return;
    await ignorarRevisao(db, revisao);
    setRevisao(null);
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

      {revisao && (
        <Card style={st.revisao}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Ionicons name="sync-circle" size={22} color={cores.ambar} />
            <Text style={st.revTitulo}>O calendário mudou</Text>
          </View>
          <Text style={st.revTexto}>
            Recalculado com o calendário atual, o vencimento passa de {formatBR(p.data_fim)} para{' '}
            <Text style={{ fontWeight: '800' }}>{formatBR(revisao.novo.dataFim)}</Text> ({diaSemana(revisao.novo.dataFim)}).
          </Text>
          {revisao.motivos.map((m) => (
            <Text key={m} style={st.revMotivo}>
              {m}
            </Text>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao titulo="Aplicar nova data" onPress={aplicar} style={{ flex: 1 }} />
            <Botao titulo="Manter" variante="secundario" onPress={manter} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

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
            {fds > 0 && <Text style={st.pulItem}>• {fds} dia(s) de sábado ou domingo (CPC, art. 216)</Text>}
            {especiais.map((l) => (
              <Text key={l} style={st.pulItem}>
                • {l}
              </Text>
            ))}
          </View>
        )}
        {avisos.map((a) => (
          <View key={a} style={st.aviso}>
            <Ionicons name="warning-outline" size={15} color="#92400E" />
            <Text style={st.avisoTxt}>{a}</Text>
          </View>
        ))}
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
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Botao titulo="Agenda" icone="calendar-outline" variante="secundario" onPress={agenda} style={{ flex: 1 }} />
        <Botao titulo="Tempestividade" icone="document-text-outline" variante="secundario" onPress={tempestividade} style={{ flex: 1 }} />
      </View>
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
      <Aviso texto="Confira sempre a contagem: suspensões por portaria ou indisponibilidade do sistema só entram se estiverem no calendário do app ou cadastradas nos Ajustes." />
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
  pulItem: { fontSize: 13, color: cores.textoSec, lineHeight: 18 },
  aviso: { flexDirection: 'row', gap: 6, marginTop: 10, backgroundColor: cores.ambarClaro, borderRadius: 10, padding: 10 },
  avisoTxt: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  revisao: { gap: 8, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  revTitulo: { fontSize: 16, fontWeight: '800', color: '#92400E' },
  revTexto: { fontSize: 14, color: cores.texto, lineHeight: 20 },
  revMotivo: { fontSize: 12, color: cores.textoSec },
});
