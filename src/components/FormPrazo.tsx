import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Botao, Campo, Card, Segmentado, Titulo } from '@/components/ui';
import { contextoCalendario, inserirPrazo, Intimacao, lerConfig, salvarNotifIds } from '@/db/repo';
import { agendarAlertas } from '@/notificacoes';
import { calcularPrazo, Contagem } from '@/prazos/calculo';
import { calendariosDe } from '@/prazos/calendarios';
import { diaSemana, formatBR } from '@/prazos/datas';
import type { ContextoCalendario } from '@/prazos/feriados';
import { partesComPrazoEmDobro, PRAZOS_COMUNS, sugerirDescricao, sugerirPrazo } from '@/prazos/sugestao';
import { agruparDiasNaoUteis } from '@/relatorio';
import { cores, esp } from '@/theme';

/** Formulário de criação do prazo a partir de uma intimação. */
export function FormPrazo({ intimacao: i, nomesPartes }: { intimacao: Intimacao; nomesPartes: string[] }) {
  const db = useSQLiteContext();
  const sug = useMemo(() => sugerirPrazo(i.texto, i.classe), [i.texto, i.classe]);
  const dobroPartes = useMemo(() => partesComPrazoEmDobro(...nomesPartes), [nomesPartes]);

  const [ctx, setCtx] = useState<ContextoCalendario | null>(null);
  const [diasBase, setDiasBase] = useState(sug.dias);
  const [contagem, setContagem] = useState<Contagem>(sug.contagem);
  const [dobro, setDobro] = useState(false);
  const [descricao, setDescricao] = useState(sugerirDescricao(i.texto));
  const [cliente, setCliente] = useState(i.partes?.split(',')[0]?.trim() ?? '');
  const [fundamento, setFundamento] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    contextoCalendario(db, i.tribunal).then(setCtx);
  }, [db, i.tribunal]);

  const dias = dobro ? diasBase * 2 : diasBase;
  const calc = useMemo(
    () => (ctx && dias > 0 ? calcularPrazo(i.data_disponibilizacao, { dias, contagem, calendario: ctx }) : null),
    [ctx, dias, contagem, i.data_disponibilizacao],
  );
  const naoUteis = useMemo(() => (calc ? agruparDiasNaoUteis(calc.diasPulados) : []), [calc]);

  function escolher(d: number, c: Contagem, desc?: string, fund?: string) {
    setDiasBase(d);
    setContagem(c);
    setFundamento(fund ?? null);
    if (desc) setDescricao(desc);
  }

  async function salvar() {
    if (!calc) return;
    if (!descricao.trim()) return Alert.alert('Descreva a providência', 'Ex.: Réplica à contestação.');
    setSalvando(true);
    try {
      const cfg = await lerConfig(db);
      const desc = descricao.trim() + (dobro ? ' (prazo em dobro)' : '');
      const pid = await inserirPrazo(
        db,
        { intimacao_id: i.id, processo: i.processo, descricao: desc, cliente: cliente.trim() || null, tribunal: i.tribunal },
        calc,
      );
      const ids = await agendarAlertas(
        { id: pid, processo: i.processo, descricao: desc, data_fim: calc.dataFim },
        { hora: cfg.horaAlerta, antecedencia: cfg.antecedencia },
      );
      await salvarNotifIds(db, pid, ids);
      router.replace(`/prazo/${pid}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card style={{ gap: esp.m }}>
      <Titulo>Criar prazo</Titulo>

      {/* De onde veio a sugestão */}
      {sug.origem === 'texto' && (
        <Nota icone="sparkles" cor={cores.primaria} fundo={cores.primariaClara}>
          {sug.candidatos.length > 1 ? 'Sugerimos o menor prazo encontrado no texto: ' : 'Identificamos no texto: '}
          <Text style={{ fontStyle: 'italic' }}>{sug.trecho}</Text>
        </Nota>
      )}
      {sug.origem === 'padrao' && (
        <Nota icone="information-circle" cor="#92400E" fundo={cores.ambarClaro}>
          Nenhum prazo encontrado no texto. Aplicamos o prazo supletivo de 5 dias (CPC, art. 218, §3º). Se o ato tiver prazo
          próprio em lei, escolha abaixo.
        </Nota>
      )}
      {sug.horas && (
        <Nota icone="alert-circle" cor={cores.vermelho} fundo={cores.vermelhoClaro}>
          O texto fixa prazo em horas ({sug.horas.quantidade}h), que se conta de minuto a minuto (CC, art. 132, §4º) — o app não
          calcula horas.{' '}
          {sug.origem === 'horas' ? `Sugerimos ${sug.dias} dia(s) corrido(s), arredondado para menos. ` : ''}
          <Text style={{ fontStyle: 'italic' }}>{sug.horas.trecho}</Text>
        </Nota>
      )}
      {sug.motivoCorridos && contagem === 'corridos' && (
        <Nota icone="time-outline" cor={cores.textoSec} fundo={cores.cinzaClaro}>
          {sug.motivoCorridos}
        </Nota>
      )}

      {/* Prazos encontrados no texto */}
      {sug.candidatos.length > 1 && (
        <View style={{ gap: 6 }}>
          <Text style={st.rot}>Prazos encontrados no texto</Text>
          <View style={st.chips}>
            {sug.candidatos.map((c) => (
              <Chip
                key={`${c.dias}${c.contagem}`}
                ativo={diasBase === c.dias && contagem === c.contagem && !fundamento}
                texto={`${c.dias} ${c.contagem === 'uteis' ? 'úteis' : 'corridos'}`}
                onPress={() => escolher(c.dias, c.contagem)}
              />
            ))}
          </View>
        </View>
      )}

      <Campo rotulo="Providência" value={descricao} onChangeText={setDescricao} placeholder="Ex.: Réplica à contestação" />
      <Campo rotulo="Cliente (para o relatório)" value={cliente} onChangeText={setCliente} placeholder="Nome do cliente" />

      {/* Prazos legais comuns */}
      <View style={{ gap: 6 }}>
        <Text style={st.rot}>Prazos comuns</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PRAZOS_COMUNS.map((p) => (
            <Chip
              key={p.rotulo}
              ativo={fundamento === p.fundamento && diasBase === p.dias}
              texto={`${p.rotulo} · ${p.dias}`}
              onPress={() => escolher(p.dias, p.contagem, p.descricao, p.fundamento)}
            />
          ))}
        </ScrollView>
        {fundamento && <Text style={st.fund}>Fundamento: {fundamento}</Text>}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={st.rot}>Prazo</Text>
        <View style={st.stepper}>
          <Pressable style={st.stepBtn} onPress={() => setDiasBase((d) => Math.max(1, d - 1))}>
            <Ionicons name="remove" size={22} color={cores.primaria} />
          </Pressable>
          <TextInput
            value={String(diasBase)}
            onChangeText={(t) => setDiasBase(Math.min(365, Number(t.replace(/\D/g, '')) || 0))}
            keyboardType="number-pad"
            style={st.stepInput}
          />
          <Text style={st.stepDias}>{dobro ? `dias × 2 = ${dias}` : 'dias'}</Text>
          <Pressable style={st.stepBtn} onPress={() => setDiasBase((d) => Math.min(365, d + 1))}>
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

      {/* Prazo em dobro */}
      <View style={st.dobro}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.dobroTitulo}>Prazo em dobro</Text>
          <Text style={st.dobroTexto}>
            {dobroPartes.length
              ? `Partes com essa prerrogativa: ${dobroPartes.join(', ')}. Se você as representa, ative (CPC, arts. 180, 183 e 186).`
              : 'Fazenda Pública, Ministério Público e Defensoria (CPC, arts. 180, 183 e 186); litisconsortes com procuradores distintos em autos físicos (art. 229).'}
          </Text>
        </View>
        <Switch value={dobro} onValueChange={setDobro} trackColor={{ true: cores.primaria }} />
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
          {naoUteis.length > 0 && (
            <View style={{ gap: 2, marginTop: 4 }}>
              <Text style={st.pulTitulo}>Dias não úteis considerados</Text>
              {naoUteis.map((l) => (
                <Text key={l} style={st.pulados}>
                  • {l}
                </Text>
              ))}
            </View>
          )}
          <Text style={st.cobertura}>
            {ctx && calendariosDe(i.tribunal, ctx.extras ?? null).length
              ? `Calendário aplicado: ${calendariosDe(i.tribunal, ctx.extras ?? null).map((c) => c.nome).join(', ')} + feriados nacionais e cadastrados.`
              : `Sem calendário próprio${i.tribunal ? ` do ${i.tribunal}` : ''} no app: considerados feriados nacionais, recesso e os feriados cadastrados nos Ajustes.`}
          </Text>
        </View>
      )}

      {calc?.avisos.map((a) => (
        <Nota key={a} icone="warning-outline" cor="#92400E" fundo={cores.ambarClaro}>
          {a}
        </Nota>
      ))}

      <Botao titulo="Salvar prazo e ativar alertas" icone="notifications" onPress={salvar} carregando={salvando} desabilitado={!calc} />
    </Card>
  );
}

function Nota({ icone, cor, fundo, children }: { icone: any; cor: string; fundo: string; children: React.ReactNode }) {
  return (
    <View style={[st.nota, { backgroundColor: fundo }]}>
      <Ionicons name={icone} size={16} color={cor} style={{ marginTop: 1 }} />
      <Text style={[st.notaTexto, { color: cor }]}>{children}</Text>
    </View>
  );
}

function Chip({ texto, ativo, onPress }: { texto: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, ativo && st.chipAtivo]}>
      <Text style={[st.chipTexto, ativo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
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
  rot: { fontSize: 14, fontWeight: '600', color: cores.texto },
  fund: { fontSize: 12, color: cores.textoSec },
  nota: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 10 },
  notaTexto: { flex: 1, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: cores.cinzaClaro, borderWidth: 1, borderColor: cores.borda },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { fontSize: 13, fontWeight: '600', color: cores.texto },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' },
  stepInput: { fontSize: 28, fontWeight: '800', color: cores.texto, minWidth: 56, textAlign: 'center' },
  stepDias: { fontSize: 16, color: cores.textoSec, flex: 1 },
  dobro: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: cores.fundo },
  dobroTitulo: { fontSize: 15, fontWeight: '700', color: cores.texto },
  dobroTexto: { fontSize: 12, color: cores.textoSec, lineHeight: 17 },
  resultado: { backgroundColor: cores.fundo, borderRadius: 14, padding: 14, gap: 6 },
  divisor: { height: 1, backgroundColor: cores.borda, marginVertical: 4 },
  vencRot: { fontSize: 13, color: cores.textoSec, fontWeight: '600' },
  venc: { fontSize: 26, fontWeight: '800', color: cores.primaria },
  vencDia: { fontSize: 16, fontWeight: '600', color: cores.textoSec },
  pulTitulo: { fontSize: 12, fontWeight: '700', color: cores.texto },
  pulados: { fontSize: 12, color: cores.textoSec, lineHeight: 17 },
  cobertura: { fontSize: 11, color: cores.textoSec, marginTop: 6, fontStyle: 'italic' },
});
