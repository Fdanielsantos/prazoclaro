import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { Aviso, Botao, Campo, Card, Chips, Rotulo, Titulo } from '@/components/ui';
import {
  apagarTudo,
  Config,
  contarDadosDoPerfil,
  excluirFeriadoLocal,
  inserirFeriadoLocal,
  inserirIntimacoes,
  lerConfig,
  listarFeriadosLocais,
  removerDadosDemo,
  removerIntimacoesDJENSemPrazo,
  removerPerfil,
  salvarConfig,
} from '@/db/repo';
import { intimacoesDemo } from '@/djen/demo';
import { cancelarAlertas, notificacaoTeste } from '@/notificacoes';
import { formatBR, parseEntrada } from '@/prazos/datas';
import type { FeriadoLocal } from '@/prazos/feriados';
import { atualizarCalendario, coberturaCalendario, urlCalendario } from '@/revisao';
import { cores, esp } from '@/theme';

type FeriadoRow = FeriadoLocal & { id: number };

export default function Ajustes() {
  const db = useSQLiteContext();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [nome, setNome] = useState('');
  const [oab, setOab] = useState('');
  const [uf, setUf] = useState('');
  const [feriados, setFeriados] = useState<FeriadoRow[]>([]);
  const [fData, setFData] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fAnual, setFAnual] = useState(true);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    const c = await lerConfig(db);
    setCfg(c);
    setNome(c.nome);
    setOab(c.oab);
    setUf(c.uf);
    setFeriados(await listarFeriadosLocais(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function atualizar(parcial: Partial<Config>) {
    await salvarConfig(db, parcial);
    setCfg((c) => (c ? { ...c, ...parcial } : c));
  }

  async function salvarPerfil() {
    if (!cfg) return;
    const novaOab = oab.replace(/\D/g, '');
    const novaUf = uf.trim().toUpperCase();
    if (!novaOab || novaUf.length !== 2) return Alert.alert('Verifique OAB e UF');

    const trocouOab = novaOab !== cfg.oab || novaUf !== cfg.uf;
    if (!trocouOab && !cfg.demo) {
      await atualizar({ nome: nome.trim() });
      return Alert.alert('Perfil salvo');
    }

    Alert.alert(
      trocouOab ? `Usar a OAB ${novaOab}/${novaUf}?` : 'Sair do modo demonstração?',
      'As intimações de exemplo e as importadas da OAB anterior serão removidas da lista (as que já viraram prazo são mantidas). Em seguida o app consulta o DJEN com estes dados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await cancelarAlertas(await removerDadosDemo(db));
            await removerIntimacoesDJENSemPrazo(db);
            await atualizar({ nome: nome.trim(), oab: novaOab, uf: novaUf, demo: false, ultimaBusca: '' });
            router.navigate('/intimacoes');
          },
        },
      ],
    );
  }

  async function trocarPerfil() {
    const { intimacoes, prazos } = await contarDadosDoPerfil(db);
    const itens = [
      intimacoes > 0 && `${intimacoes} intimaç${intimacoes === 1 ? 'ão importada' : 'ões importadas'}`,
      prazos > 0 && `${prazos} prazo${prazos === 1 ? '' : 's'} criado${prazos === 1 ? '' : 's'} a partir dela${intimacoes === 1 ? '' : 's'} (e seus alertas)`,
    ].filter(Boolean);
    Alert.alert(
      'Trocar de perfil?',
      `O nome e a OAB ${cfg?.oab ? `${cfg.oab}/${cfg.uf} ` : ''}serão removidos` +
        (itens.length ? `, junto com ${itens.join(' e ')}` : '') +
        '.\n\nFeriados locais, preferências de alerta e intimações cadastradas manualmente são mantidos. Em seguida você poderá cadastrar outra OAB.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Trocar de perfil',
          style: 'destructive',
          onPress: async () => {
            await cancelarAlertas(await removerPerfil(db));
            router.replace('/onboarding');
          },
        },
      ],
    );
  }

  async function baixarCalendario() {
    setBaixando(true);
    const r = await atualizarCalendario(db);
    setBaixando(false);
    if (!r.ok) return Alert.alert('Não foi possível atualizar', r.erro);
    await carregar();
    Alert.alert(
      r.novo ? 'Calendário atualizado' : 'Calendário em dia',
      r.novo ? `Versão ${r.versao} instalada. Prazos salvos que mudarem aparecem na tela Início.` : `Você já tem a versão ${r.versao}.`,
    );
  }

  async function addFeriado() {
    const iso = parseEntrada(fData);
    if (!iso) return Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa.');
    if (!fDesc.trim()) return Alert.alert('Descreva o feriado', 'Ex.: Aniversário da cidade.');
    await inserirFeriadoLocal(db, { data: iso, descricao: fDesc.trim(), anual: fAnual });
    setFData('');
    setFDesc('');
    setFeriados(await listarFeriadosLocais(db));
  }

  async function alternarDemo(v: boolean) {
    if (v) {
      await atualizar({ demo: true });
      await inserirIntimacoes(db, intimacoesDemo());
      return;
    }
    await cancelarAlertas(await removerDadosDemo(db));
    await atualizar({ demo: false, ultimaBusca: '' });
    Alert.alert('Modo demonstração desligado', 'As intimações de exemplo foram removidas. A próxima busca consulta o DJEN de verdade.');
  }

  function apagar() {
    Alert.alert('Apagar todos os dados?', 'Intimações, prazos, feriados e configurações serão removidos deste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await Notifications.cancelAllScheduledNotificationsAsync();
          await apagarTudo(db);
          router.replace('/onboarding');
        },
      },
    ]);
  }

  if (!cfg) return null;
  const cobertura = coberturaCalendario(cfg.calendarioRemoto);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: esp.l, gap: esp.l, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Titulo>Perfil</Titulo>
        <Card style={{ gap: esp.m }}>
          <Campo rotulo="Nome (assina o relatório ao cliente)" value={nome} onChangeText={setNome} />
          <View style={{ flexDirection: 'row', gap: esp.m }}>
            <View style={{ flex: 2 }}>
              <Campo rotulo="Nº da OAB" value={oab} onChangeText={setOab} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Campo rotulo="UF" value={uf} onChangeText={setUf} maxLength={2} autoCapitalize="characters" />
            </View>
          </View>
          <Botao titulo="Salvar perfil" variante="secundario" onPress={salvarPerfil} />
          <Botao titulo="Trocar de perfil" icone="swap-horizontal" variante="texto" onPress={trocarPerfil} />
        </Card>

        <Titulo>Alertas</Titulo>
        <Card style={{ gap: esp.m }}>
          <Rotulo>Horário do alerta</Rotulo>
          <Chips opcoes={[7, 8, 9, 10, 12, 18]} valor={cfg.horaAlerta} onChange={(v) => atualizar({ horaAlerta: v })} sufixo="h" />
          <Rotulo>Primeiro aviso antes do vencimento</Rotulo>
          <Chips opcoes={[2, 3, 5, 7]} valor={cfg.antecedencia} onChange={(v) => atualizar({ antecedencia: v })} sufixo=" dias" />
          <Aviso texto="Além desse aviso, você é alertado na véspera e no dia do vencimento. Vale para prazos criados a partir de agora." />
          <Botao
            titulo="Testar notificação (5 s)"
            icone="notifications-outline"
            variante="texto"
            onPress={async () => {
              const ok = await notificacaoTeste();
              if (!ok) Alert.alert('Permissão negada', 'Ative as notificações do app nos Ajustes do iPhone.');
            }}
          />
        </Card>

        <Titulo>Calendário forense</Titulo>
        <Card style={{ gap: esp.m }}>
          <Text style={st.ajuda}>
            Sempre considerados: sábados, domingos, feriados nacionais em lei e o recesso de 20/12 a 20/01 (CPC, art. 220). Além
            disso, o app aplica o calendário próprio destes tribunais:
          </Text>
          <View style={st.siglas}>
            {cobertura.siglas.map((s) => (
              <Text key={s} style={st.sigla}>
                {s}
              </Text>
            ))}
          </View>
          <Text style={st.ajudaPeq}>
            Calendário v{cobertura.versao} · atualizado em {formatBR(cobertura.atualizadoEm)}. Para os demais tribunais, cadastre abaixo
            os feriados e suspensões.
          </Text>
          {urlCalendario() && (
            <Botao titulo="Atualizar calendário" icone="cloud-download-outline" variante="secundario" onPress={baixarCalendario} carregando={baixando} />
          )}
          <View style={st.linha}>
            <View style={{ flex: 1 }}>
              <Text style={st.linhaTexto}>Carnaval, Sexta-feira Santa e Corpus Christi</Text>
              <Text style={st.ajuda}>
                Não são feriados nacionais em lei. Ative se o seu tribunal suspende o expediente nesses dias. Desativado, o vencimento
                é calculado mais cedo, que é o lado seguro. (Na Justiça Federal, STF e STJ o Carnaval e a Semana Santa já são
                considerados por lei.)
              </Text>
            </View>
            <Switch
              value={cfg.feriadosTradicionais}
              onValueChange={(v) => atualizar({ feriadosTradicionais: v })}
              trackColor={{ true: cores.primaria }}
            />
          </View>
        </Card>

        <Titulo>Feriados locais</Titulo>
        <Card style={{ gap: esp.m }}>
          <Text style={st.ajuda}>
            Cadastre os feriados do seu estado, município ou tribunal e as suspensões de expediente por portaria. Prazos já salvos
            que mudarem de vencimento serão indicados na tela Início para você revisar.
          </Text>
          {feriados.map((f) => (
            <View key={f.id} style={st.feriado}>
              <Ionicons name="location-outline" size={18} color={cores.primaria} />
              <View style={{ flex: 1 }}>
                <Text style={st.fDesc}>{f.descricao}</Text>
                <Text style={st.fData}>{f.anual ? `${formatBR(f.data).slice(0, 5)} · todo ano` : formatBR(f.data)}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={async () => {
                  await excluirFeriadoLocal(db, f.id);
                  setFeriados(await listarFeriadosLocais(db));
                }}>
                <Ionicons name="close-circle" size={22} color={cores.cinza} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: esp.s }}>
            <View style={{ flex: 1 }}>
              <Campo placeholder="dd/mm/aaaa" value={fData} onChangeText={setFData} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1.4 }}>
              <Campo placeholder="Descrição" value={fDesc} onChangeText={setFDesc} />
            </View>
          </View>
          <View style={st.linha}>
            <Text style={st.linhaTexto}>Repete todo ano</Text>
            <Switch value={fAnual} onValueChange={setFAnual} trackColor={{ true: cores.primaria }} />
          </View>
          <Botao titulo="Adicionar feriado" icone="add" variante="secundario" onPress={addFeriado} />
        </Card>

        <Titulo>Aplicativo</Titulo>
        <Card style={{ gap: esp.m }}>
          <View style={st.linha}>
            <View style={{ flex: 1 }}>
              <Text style={st.linhaTexto}>Modo demonstração</Text>
              <Text style={st.ajuda}>Usa intimações de exemplo em vez de consultar o DJEN.</Text>
            </View>
            <Switch value={cfg.demo} onValueChange={alternarDemo} trackColor={{ true: cores.primaria }} />
          </View>
          <Botao titulo="Apagar todos os dados" icone="trash-outline" variante="perigo" onPress={apagar} />
        </Card>

        <Aviso texto="PrazoClaro v1.0 · Dados armazenados somente neste aparelho. Consulta à API pública do DJEN (Comunica PJe/CNJ). Ferramenta de apoio, não substitui a conferência do advogado." />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  ajuda: { fontSize: 13, color: cores.textoSec, lineHeight: 18 },
  ajudaPeq: { fontSize: 12, color: cores.textoSec, lineHeight: 17 },
  siglas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sigla: { fontSize: 12, fontWeight: '700', color: cores.primaria, backgroundColor: cores.primariaClara, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  feriado: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: cores.borda },
  fDesc: { fontSize: 15, fontWeight: '600', color: cores.texto },
  fData: { fontSize: 13, color: cores.textoSec },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  linhaTexto: { fontSize: 15, fontWeight: '600', color: cores.texto },
});
