import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrazoCard, urgenciaDe } from '@/components/PrazoCard';
import { Aviso, Botao, Card, Titulo, Vazio } from '@/components/ui';
import { Config, contarNaoLidas, lerConfig, listarPrazos, listarRevisoes, Prazo, RevisaoPrazo } from '@/db/repo';
import { diaSemana, formatBR, hojeISO } from '@/prazos/datas';
import { aplicarRevisao } from '@/revisao';
import { cores, esp } from '@/theme';

export default function Inicio() {
  const db = useSQLiteContext();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const [revisoes, setRevisoes] = useState<RevisaoPrazo[]>([]);

  const carregar = useCallback(async () => {
    const [c, p, n, r] = await Promise.all([lerConfig(db), listarPrazos(db, 'pendente'), contarNaoLidas(db), listarRevisoes(db)]);
    setCfg(c);
    setPrazos(p);
    setNaoLidas(n);
    setRevisoes(r);
  }, [db]);

  async function aplicarTodas() {
    for (const r of revisoes) await aplicarRevisao(db, r);
    await carregar();
  }

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const urgentes = prazos.filter((p) => ['vencido', 'hoje'].includes(urgenciaDe(p))).length;
  const proximos = prazos.filter((p) => urgenciaDe(p) === 'proximo').length;
  const hoje = hojeISO();
  const primeiroNome = cfg?.nome?.split(' ').slice(0, 2).join(' ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: esp.l, gap: esp.l, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }>
        <View>
          <Text style={st.data}>
            {diaSemana(hoje)}, {formatBR(hoje)}
          </Text>
          <Text style={st.ola}>Olá{primeiroNome ? `, ${primeiroNome}` : ''} 👋</Text>
          {cfg?.demo && <Text style={st.demo}>Modo demonstração</Text>}
        </View>

        <View style={st.resumo}>
          <Resumo n={urgentes} rotulo="Vencem hoje / vencidos" cor={cores.vermelho} fundo={cores.vermelhoClaro} icone="alert-circle" />
          <Resumo n={proximos} rotulo="Nos próximos 3 dias" cor={cores.ambar} fundo={cores.ambarClaro} icone="time" />
          <Resumo n={prazos.length} rotulo="Prazos em aberto" cor={cores.primaria} fundo={cores.primariaClara} icone="briefcase" />
        </View>

        {revisoes.length > 0 && (
          <Card style={st.revisao}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sync-circle" size={22} color={cores.ambar} />
              <Text style={st.revTitulo}>
                {revisoes.length === 1 ? '1 prazo pode ter mudado' : `${revisoes.length} prazos podem ter mudado`}
              </Text>
            </View>
            <Text style={st.revTexto}>O calendário ou os feriados mudaram. Toque em um prazo para revisar, ou aplique as novas datas.</Text>
            {revisoes.slice(0, 5).map((r) => (
              <Text key={r.prazo.id} style={st.revItem} onPress={() => router.push(`/prazo/${r.prazo.id}`)}>
                • {r.prazo.descricao} ({r.prazo.processo}): {formatBR(r.prazo.data_fim)} →{' '}
                <Text style={{ fontWeight: '800' }}>{formatBR(r.novo.dataFim)}</Text>
              </Text>
            ))}
            <Botao titulo="Aplicar novas datas" icone="checkmark-done" onPress={aplicarTodas} />
          </Card>
        )}

        {naoLidas > 0 && (
          <Card onPress={() => router.push('/intimacoes')} style={st.alerta}>
            <View style={st.alertaIcone}>
              <Ionicons name="mail-unread" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.alertaTitulo}>
                {naoLidas} intimaç{naoLidas === 1 ? 'ão nova' : 'ões novas'}
              </Text>
              <Text style={st.alertaTexto}>Toque para revisar e criar os prazos.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={cores.primaria} />
          </Card>
        )}

        <Titulo>Próximos vencimentos</Titulo>
        {prazos.length === 0 ? (
          <Vazio
            icone="checkmark-done-circle-outline"
            titulo="Nenhum prazo em aberto"
            texto="Busque suas intimações no DJEN e crie os prazos com um toque."
            acao={<Botao titulo="Buscar intimações" icone="cloud-download-outline" onPress={() => router.push('/intimacoes')} />}
          />
        ) : (
          prazos.slice(0, 8).map((p) => <PrazoCard key={p.id} prazo={p} />)
        )}
        {prazos.length > 8 && <Botao titulo="Ver todos os prazos" variante="texto" onPress={() => router.push('/prazos')} />}

        <Aviso texto="O PrazoClaro é uma ferramenta de apoio. Confira sempre a contagem e eventuais suspensões específicas do seu tribunal." />
      </ScrollView>
    </SafeAreaView>
  );
}

function Resumo({ n, rotulo, cor, fundo, icone }: { n: number; rotulo: string; cor: string; fundo: string; icone: any }) {
  return (
    <View style={[st.resumoItem, { backgroundColor: fundo }]}>
      <Ionicons name={icone} size={20} color={cor} />
      <Text style={[st.resumoN, { color: cor }]}>{n}</Text>
      <Text style={[st.resumoRot, { color: cor }]}>{rotulo}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  data: { fontSize: 14, color: cores.textoSec, textTransform: 'capitalize' },
  ola: { fontSize: 28, fontWeight: '800', color: cores.texto, marginTop: 2 },
  demo: { marginTop: 6, alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: cores.ambar, backgroundColor: cores.ambarClaro, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  resumo: { flexDirection: 'row', gap: esp.s },
  resumoItem: { flex: 1, borderRadius: 16, padding: esp.m, gap: 2 },
  resumoN: { fontSize: 28, fontWeight: '800' },
  resumoRot: { fontSize: 12, fontWeight: '600' },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: esp.m, backgroundColor: cores.primariaClara, borderColor: '#C7D2FE' },
  alertaIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' },
  alertaTitulo: { fontSize: 16, fontWeight: '700', color: cores.primaria },
  alertaTexto: { fontSize: 13, color: cores.textoSec },
  revisao: { gap: 8, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  revTitulo: { fontSize: 16, fontWeight: '800', color: '#92400E' },
  revTexto: { fontSize: 13, color: cores.textoSec, lineHeight: 18 },
  revItem: { fontSize: 13, color: cores.texto, lineHeight: 19 },
});
