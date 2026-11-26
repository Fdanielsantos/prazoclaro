import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormPrazo } from '@/components/FormPrazo';
import { PartesIntimacao, PontosDeAtencao, TeorIntimacao } from '@/components/Teor';
import { Badge, Botao, Card, Titulo } from '@/components/ui';
import { AdvogadoIntimado, Destinatario, excluirIntimacao, Intimacao, lerJSON, marcarLida, obterIntimacao } from '@/db/repo';
import { estruturarTeor, pontosDeAtencao } from '@/djen/formatar';
import { diaSemana, formatBR } from '@/prazos/datas';
import { cores, esp } from '@/theme';

export default function DetalheIntimacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const nav = useNavigation();
  const [i, setI] = useState<Intimacao | null>(null);

  useEffect(() => {
    (async () => {
      const it = await obterIntimacao(db, Number(id));
      if (!it) return;
      setI(it);
      if (!it.lida) await marcarLida(db, it.id);
    })();
  }, [db, id]);

  useEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable
          hitSlop={10}
          onPress={() =>
            Alert.alert('Excluir intimação?', 'Ela será removida deste aparelho.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Excluir',
                style: 'destructive',
                onPress: async () => {
                  await excluirIntimacao(db, Number(id));
                  router.back();
                },
              },
            ])
          }>
          <Ionicons name="trash-outline" size={22} color={cores.vermelho} />
        </Pressable>
      ),
    });
  }, [nav, db, id]);

  const teor = useMemo(() => (i ? estruturarTeor(i.texto) : null), [i]);
  const atencao = useMemo(() => (i ? pontosDeAtencao(i.texto) : []), [i]);
  const destinatarios = useMemo(() => lerJSON<Destinatario>(i?.destinatarios), [i]);
  const advogados = useMemo(() => lerJSON<AdvogadoIntimado>(i?.advogados), [i]);
  // Nomes das partes (para detectar prazo em dobro): cabeçalho do texto + destinatários da API.
  const nomesPartes = useMemo(
    () => [...(teor?.cabecalho.filter((c) => !/advogad|procurador|relator/i.test(c.rotulo)).map((c) => c.valor) ?? []), ...destinatarios.map((d) => d.nome), i?.partes ?? ''],
    [teor, destinatarios, i],
  );

  if (!i || !teor) return null;

  // tipoDocumento do STJ é uma frase inteira ("VISTA à(s) parte(s)..."): no selo, só os curtos.
  const rotuloDoc = i.tipo_documento && i.tipo_documento.length <= 30 ? i.tipo_documento : i.tipo;
  const temPartes = teor.cabecalho.length > 0 || destinatarios.length > 0 || advogados.length > 0 || !!i.partes;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: esp.l, gap: esp.l, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {i.tribunal && <Badge texto={i.tribunal} cor={cores.primaria} fundo={cores.primariaClara} />}
            {rotuloDoc && <Badge texto={rotuloDoc} cor={cores.textoSec} fundo={cores.cinzaClaro} />}
            {i.origem === 'demo' && <Badge texto="Exemplo" cor={cores.ambar} fundo={cores.ambarClaro} />}
          </View>
          <Text style={st.proc} selectable>
            {i.processo}
          </Text>
          {i.classe && <Text style={st.classe}>{i.classe}</Text>}
          {i.orgao && (
            <View style={st.meta}>
              <Ionicons name="business-outline" size={15} color={cores.textoSec} />
              <Text style={st.sec}>{i.orgao}</Text>
            </View>
          )}
          <View style={st.meta}>
            <Ionicons name="calendar-outline" size={15} color={cores.textoSec} />
            <Text style={st.sec}>
              Disponibilizada em {formatBR(i.data_disponibilizacao)} ({diaSemana(i.data_disponibilizacao)})
            </Text>
          </View>
        </View>

        <PontosDeAtencao frases={atencao} />

        <Card style={{ gap: esp.m }}>
          <TeorIntimacao titulo={teor.titulo} paragrafos={teor.paragrafos} />
          {i.link && (
            <Botao titulo="Abrir documento no tribunal" icone="open-outline" variante="secundario" onPress={() => Linking.openURL(i.link!)} />
          )}
        </Card>

        {temPartes && (
          <Card style={{ gap: esp.m }}>
            <Titulo>Partes</Titulo>
            <PartesIntimacao destinatarios={destinatarios} advogados={advogados} cabecalho={teor.cabecalho} partesTexto={i.partes} />
          </Card>
        )}

        {i.prazo_id ? (
          <Card style={{ gap: 10, backgroundColor: cores.verdeClaro, borderColor: '#BBF7D0' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.verde }}>✓ Prazo já cadastrado para esta intimação</Text>
            <Botao titulo="Ver prazo" icone="calendar" onPress={() => router.push(`/prazo/${i.prazo_id}`)} />
          </Card>
        ) : (
          <FormPrazo intimacao={i} nomesPartes={nomesPartes} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  proc: { fontSize: 20, fontWeight: '800', color: cores.texto },
  sec: { flex: 1, fontSize: 14, color: cores.textoSec, lineHeight: 19 },
  classe: { fontSize: 15, fontWeight: '600', color: cores.texto },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});
