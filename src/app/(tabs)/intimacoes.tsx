import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Botao, Card, Vazio } from '@/components/ui';
import { Config, inserirIntimacoes, Intimacao, lerConfig, listarIntimacoes, salvarConfig } from '@/db/repo';
import { buscarDJEN } from '@/djen/api';
import { intimacoesDemo } from '@/djen/demo';
import { formatCurto } from '@/prazos/datas';
import { cores, esp } from '@/theme';

export default function Intimacoes() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const [itens, setItens] = useState<Intimacao[]>([]);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const carregar = useCallback(async () => {
    const [l, c] = await Promise.all([listarIntimacoes(db), lerConfig(db)]);
    setItens(l);
    setCfg(c);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/intimacao/nova')} hitSlop={10} style={{ marginRight: 16 }}>
          <Ionicons name="add-circle" size={28} color={cores.primaria} />
        </Pressable>
      ),
    });
  }, [nav]);

  async function usarDemo() {
    const n = await inserirIntimacoes(db, intimacoesDemo());
    await carregar();
    return n;
  }

  async function buscar() {
    if (!cfg) return;
    setBuscando(true);
    try {
      let novas: number;
      if (cfg.demo) {
        await new Promise((r) => setTimeout(r, 700));
        novas = await usarDemo();
      } else {
        const lista = await buscarDJEN(cfg.oab, cfg.uf);
        novas = await inserirIntimacoes(db, lista);
      }
      await salvarConfig(db, { ultimaBusca: new Date().toISOString() });
      await carregar();
      Alert.alert(
        'Busca concluída',
        novas > 0 ? `${novas} intimaç${novas === 1 ? 'ão nova encontrada' : 'ões novas encontradas'}.` : 'Nenhuma intimação nova nos últimos 30 dias.',
      );
    } catch (e: any) {
      Alert.alert('Não foi possível consultar o DJEN', `${e?.message ?? 'Erro de conexão'}.\n\nVocê pode tentar novamente ou carregar intimações de exemplo.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Usar exemplos', onPress: () => usarDemo() },
      ]);
    } finally {
      setBuscando(false);
    }
  }

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return itens;
    return itens.filter((i) => [i.processo, i.tribunal, i.orgao, i.partes, i.texto].some((c) => c?.toLowerCase().includes(f)));
  }, [itens, filtro]);

  const ultima = cfg?.ultimaBusca ? new Date(cfg.ultimaBusca) : null;

  return (
    <FlatList
      data={filtrados}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={{ padding: esp.l, gap: esp.m, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={buscando} onRefresh={buscar} />}
      ListHeaderComponent={
        <View style={{ gap: esp.m, marginBottom: esp.xs }}>
          <Botao
            titulo={cfg?.demo ? 'Buscar intimações (demo)' : `Buscar no DJEN · OAB ${cfg?.oab ?? ''}/${cfg?.uf ?? ''}`}
            icone="cloud-download-outline"
            onPress={buscar}
            carregando={buscando}
          />
          <Text style={st.ultima}>
            {ultima
              ? `Última busca: ${ultima.toLocaleDateString('pt-BR')} às ${ultima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · últimos 30 dias`
              : 'Busca os últimos 30 dias no Diário de Justiça Eletrônico Nacional'}
          </Text>
          {itens.length > 0 && (
            <View style={st.busca}>
              <Ionicons name="search" size={18} color={cores.cinza} />
              <TextInput
                placeholder="Filtrar por processo, tribunal, parte…"
                placeholderTextColor={cores.cinza}
                value={filtro}
                onChangeText={setFiltro}
                style={{ flex: 1, fontSize: 15, color: cores.texto }}
                clearButtonMode="while-editing"
              />
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        itens.length === 0 ? (
          <Vazio
            icone="mail-open-outline"
            titulo="Nenhuma intimação ainda"
            texto="Toque em “Buscar no DJEN” ou use o botão + para colar o texto de uma intimação."
          />
        ) : (
          <Text style={st.ultima}>Nenhum resultado para “{filtro}”.</Text>
        )
      }
      renderItem={({ item }) => <ItemIntimacao i={item} />}
    />
  );
}

function ItemIntimacao({ i }: { i: Intimacao }) {
  return (
    <Card onPress={() => router.push(`/intimacao/${i.id}`)} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {!i.lida && <View style={st.ponto} />}
        <Badge texto={i.tribunal ?? 'Manual'} cor={cores.primaria} fundo={cores.primariaClara} />
        {i.prazo_id ? <Badge texto="✓ Prazo criado" cor={cores.verde} fundo={cores.verdeClaro} /> : null}
        <View style={{ flex: 1 }} />
        <Text style={st.data}>{formatCurto(i.data_disponibilizacao)}</Text>
      </View>
      <Text style={[st.proc, !i.lida && { fontWeight: '800' }]}>{i.processo}</Text>
      {i.orgao && (
        <Text style={st.orgao} numberOfLines={1}>
          {i.orgao}
        </Text>
      )}
      <Text style={st.trecho} numberOfLines={2}>
        {i.texto}
      </Text>
    </Card>
  );
}

const st = StyleSheet.create({
  ultima: { fontSize: 12, color: cores.textoSec, textAlign: 'center' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cores.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: cores.borda },
  ponto: { width: 9, height: 9, borderRadius: 5, backgroundColor: cores.vermelho },
  data: { fontSize: 13, color: cores.textoSec, fontWeight: '600' },
  proc: { fontSize: 16, fontWeight: '700', color: cores.texto },
  orgao: { fontSize: 13, color: cores.textoSec },
  trecho: { fontSize: 14, color: cores.texto, lineHeight: 20, opacity: 0.8 },
});
