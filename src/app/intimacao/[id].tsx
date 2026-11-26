import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Botao, Campo, Card, Segmentado, Titulo } from '@/components/ui';
import {
  excluirIntimacao,
  inserirPrazo,
  Intimacao,
  lerConfig,
  listarFeriadosLocais,
  marcarLida,
  obterIntimacao,
  salvarNotifIds,
} from '@/db/repo';
import { agendarAlertas } from '@/notificacoes';
import { calcularPrazo, Contagem } from '@/prazos/calculo';
import { diaSemana, formatBR } from '@/prazos/datas';
import type { FeriadoLocal } from '@/prazos/feriados';
import { sugerirDescricao, sugerirPrazo } from '@/prazos/sugestao';
import { cores, esp } from '@/theme';

export default function DetalheIntimacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const nav = useNavigation();
  const [i, setI] = useState<Intimacao | null>(null);
  const [locais, setLocais] = useState<FeriadoLocal[]>([]);
  const [expandido, setExpandido] = useState(false);

  // formulário do prazo
  const [dias, setDias] = useState(15);
  const [contagem, setContagem] = useState<Contagem>('uteis');
  const [descricao, setDescricao] = useState('');
  const [cliente, setCliente] = useState('');
  const [trecho, setTrecho] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const it = await obterIntimacao(db, Number(id));
      if (!it) return;
      setI(it);
      setLocais(await listarFeriadosLocais(db));
      if (!it.lida) await marcarLida(db, it.id);
      const sug = sugerirPrazo(it.texto);
      setDias(sug.dias);
      setContagem(sug.contagem);
      setTrecho(sug.trecho);
      setDescricao(sugerirDescricao(it.texto));
      setCliente(it.partes?.split(',')[0]?.trim() ?? '');
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

  const calc = useMemo(
    () => (i && dias > 0 ? calcularPrazo(i.data_disponibilizacao, { dias, contagem, feriadosLocais: locais }) : null),
    [i, dias, contagem, locais],
  );

  async function salvar() {
    if (!i || !calc) return;
    if (!descricao.trim()) return Alert.alert('Descreva a providência', 'Ex.: Réplica à contestação.');
    setSalvando(true);
    try {
      const cfg = await lerConfig(db);
      const pid = await inserirPrazo(
        db,
        { intimacao_id: i.id, processo: i.processo, descricao: descricao.trim(), cliente: cliente.trim() || null },
        calc,
      );
      const ids = await agendarAlertas(
        { id: pid, processo: i.processo, descricao: descricao.trim(), data_fim: calc.dataFim },
        { hora: cfg.horaAlerta, antecedencia: cfg.antecedencia },
      );
      await salvarNotifIds(db, pid, ids);
      router.replace(`/prazo/${pid}`);
    } finally {
      setSalvando(false);
    }
  }

  if (!i) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: esp.l, gap: esp.l, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {i.tribunal && <Badge texto={i.tribunal} cor={cores.primaria} fundo={cores.primariaClara} />}
            {i.tipo && <Badge texto={i.tipo} cor={cores.textoSec} fundo={cores.cinzaClaro} />}
            {i.origem === 'demo' && <Badge texto="Exemplo" cor={cores.ambar} fundo={cores.ambarClaro} />}
          </View>
          <Text style={st.proc} selectable>
            {i.processo}
          </Text>
          {i.classe && <Text style={st.sec}>{i.classe}</Text>}
          {i.orgao && <Text style={st.sec}>{i.orgao}</Text>}
          {i.partes && <Text style={st.sec}>Partes: {i.partes}</Text>}
          <Text style={st.sec}>Disponibilizada no DJEN em {formatBR(i.data_disponibilizacao)}</Text>
        </View>

        <Card style={{ gap: 8 }}>
          <Titulo>Teor da intimação</Titulo>
          <Text style={st.texto} selectable numberOfLines={expandido ? undefined : 8}>
            {i.texto}
          </Text>
          {i.texto.length > 400 && (
            <Botao titulo={expandido ? 'Mostrar menos' : 'Ler texto completo'} variante="texto" onPress={() => setExpandido(!expandido)} style={{ minHeight: 36, paddingVertical: 6 }} />
          )}
          {i.link && (
            <Botao titulo="Abrir documento no tribunal" icone="open-outline" variante="secundario" onPress={() => Linking.openURL(i.link!)} />
          )}
        </Card>

        {i.prazo_id ? (
          <Card style={{ gap: 10, backgroundColor: cores.verdeClaro, borderColor: '#BBF7D0' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.verde }}>✓ Prazo já cadastrado para esta intimação</Text>
            <Botao titulo="Ver prazo" icone="calendar" onPress={() => router.push(`/prazo/${i.prazo_id}`)} />
          </Card>
        ) : (
          <Card style={{ gap: esp.m }}>
            <Titulo>Criar prazo</Titulo>
            {trecho ? (
              <View style={st.sugestao}>
                <Ionicons name="sparkles" size={16} color={cores.primaria} />
                <Text style={st.sugTexto}>
                  Identificamos no texto: <Text style={{ fontStyle: 'italic' }}>{trecho}</Text>
                </Text>
              </View>
            ) : (
              <View style={st.sugestao}>
                <Ionicons name="information-circle" size={16} color={cores.primaria} />
                <Text style={st.sugTexto}>Prazo não identificado no texto; sugerimos o prazo geral de 15 dias úteis. Ajuste se necessário.</Text>
              </View>
            )}

            <Campo rotulo="Providência" value={descricao} onChangeText={setDescricao} placeholder="Ex.: Réplica à contestação" />
            <Campo rotulo="Cliente (para o relatório)" value={cliente} onChangeText={setCliente} placeholder="Nome do cliente" />

            <View style={{ gap: 6 }}>
              <Text style={st.rot}>Prazo</Text>
              <View style={st.stepper}>
                <Pressable style={st.stepBtn} onPress={() => setDias((d) => Math.max(1, d - 1))}>
                  <Ionicons name="remove" size={22} color={cores.primaria} />
                </Pressable>
                <TextInput
                  value={String(dias)}
                  onChangeText={(t) => setDias(Math.min(365, Number(t.replace(/\D/g, '')) || 0))}
                  keyboardType="number-pad"
                  style={st.stepInput}
                />
                <Text style={st.stepDias}>dias</Text>
                <Pressable style={st.stepBtn} onPress={() => setDias((d) => Math.min(365, d + 1))}>
                  <Ionicons name="add" size={22} color={cores.primaria} />
                </Pressable>
              </View>
              <Segmentado
                opcoes={[
                  { valor: 'uteis', rotulo: 'Dias úteis (CPC)' },
                  { valor: 'corridos', rotulo: 'Dias corridos' },
                ]}
                valor={contagem}
                onChange={setContagem}
              />
            </View>

            {calc && (
              <View style={st.resultado}>
                <Linha rotulo="Publicação" valor={formatBR(calc.dataPublicacao)} />
                <Linha rotulo="Início da contagem" valor={formatBR(calc.dataInicio)} />
                <View style={st.divisor} />
                <Text style={st.vencRot}>Vencimento</Text>
                <Text style={st.venc}>
                  {formatBR(calc.dataFim)} <Text style={st.vencDia}>({diaSemana(calc.dataFim)})</Text>
                </Text>
                {calc.diasPulados.length > 0 && (
                  <Text style={st.pulados}>
                    {calc.diasPulados.length} dia(s) não útil(eis) desconsiderado(s)
                    {calc.diasPulados.some((d) => d.motivo === 'recesso') ? ', incluindo o recesso forense' : ''}
                    {calc.diasPulados.some((d) => d.motivo === 'feriado' || d.motivo === 'feriado_local') ? ' e feriados' : ''}.
                  </Text>
                )}
              </View>
            )}

            <Botao titulo="Salvar prazo e ativar alertas" icone="notifications" onPress={salvar} carregando={salvando} desabilitado={!calc} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: cores.textoSec, fontSize: 14 }}>{rotulo}</Text>
      <Text style={{ color: cores.texto, fontSize: 14, fontWeight: '600' }}>{valor}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  proc: { fontSize: 20, fontWeight: '800', color: cores.texto },
  sec: { fontSize: 14, color: cores.textoSec },
  texto: { fontSize: 15, lineHeight: 22, color: cores.texto },
  rot: { fontSize: 14, fontWeight: '600', color: cores.texto },
  sugestao: { flexDirection: 'row', gap: 8, backgroundColor: cores.primariaClara, padding: 10, borderRadius: 10 },
  sugTexto: { flex: 1, fontSize: 13, color: cores.primaria, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' },
  stepInput: { fontSize: 28, fontWeight: '800', color: cores.texto, minWidth: 56, textAlign: 'center' },
  stepDias: { fontSize: 16, color: cores.textoSec, flex: 1 },
  resultado: { backgroundColor: cores.fundo, borderRadius: 14, padding: 14, gap: 6 },
  divisor: { height: 1, backgroundColor: cores.borda, marginVertical: 4 },
  vencRot: { fontSize: 13, color: cores.textoSec, fontWeight: '600' },
  venc: { fontSize: 26, fontWeight: '800', color: cores.primaria },
  vencDia: { fontSize: 16, fontWeight: '600', color: cores.textoSec },
  pulados: { fontSize: 12, color: cores.textoSec },
});
