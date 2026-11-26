import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Campo, IconName } from '@/components/ui';
import { inserirIntimacoes, salvarConfig } from '@/db/repo';
import { intimacoesDemo } from '@/djen/demo';
import { pedirPermissao } from '@/notificacoes';
import { cores, esp } from '@/theme';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

const BENEFICIOS: { icone: IconName; titulo: string; texto: string }[] = [
  { icone: 'cloud-download-outline', titulo: 'Intimações do DJEN', texto: 'Busca automática pelo seu número da OAB.' },
  { icone: 'calculator-outline', titulo: 'Prazos em dias úteis', texto: 'Desconta fins de semana, feriados e o recesso forense.' },
  { icone: 'notifications-outline', titulo: 'Alertas no celular', texto: 'Avisos antes do vencimento, mesmo sem internet.' },
  { icone: 'chatbubbles-outline', titulo: 'Relatório ao cliente', texto: 'Texto claro, pronto para enviar no WhatsApp.' },
];

export default function Onboarding() {
  const db = useSQLiteContext();
  const [nome, setNome] = useState('');
  const [oab, setOab] = useState('');
  const [uf, setUf] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function comecar() {
    const ufN = uf.trim().toUpperCase();
    if (!oab.replace(/\D/g, '')) return Alert.alert('Informe sua OAB', 'Digite o número da sua inscrição na OAB.');
    if (!UFS.includes(ufN)) return Alert.alert('UF inválida', 'Informe a sigla do estado da OAB, ex.: SP.');
    setSalvando(true);
    await salvarConfig(db, { nome: nome.trim(), oab: oab.replace(/\D/g, ''), uf: ufN, demo: false, onboarded: true });
    await pedirPermissao();
    router.replace('/intimacoes');
  }

  async function demo() {
    setSalvando(true);
    await salvarConfig(db, { nome: nome.trim() || 'Dra. Ana Demonstração', oab: '123456', uf: 'SP', demo: true, onboarded: true });
    await inserirIntimacoes(db, intimacoesDemo());
    await pedirPermissao();
    router.replace('/intimacoes');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.primaria }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={st.hero}>
            <View style={st.logo}>
              <Ionicons name="hourglass-outline" size={34} color={cores.primaria} />
            </View>
            <Text style={st.marca}>PrazoClaro</Text>
            <Text style={st.slogan}>Seu assistente de prazos processuais, no bolso.</Text>
          </View>

          <View style={st.painel}>
            {BENEFICIOS.map((b) => (
              <View key={b.titulo} style={st.benef}>
                <View style={st.benefIcone}>
                  <Ionicons name={b.icone} size={22} color={cores.primaria} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.benefTitulo}>{b.titulo}</Text>
                  <Text style={st.benefTexto}>{b.texto}</Text>
                </View>
              </View>
            ))}

            <View style={{ gap: esp.m, marginTop: esp.m }}>
              <Campo rotulo="Seu nome (opcional)" placeholder="Ex.: Dr. Flávio Santos" value={nome} onChangeText={setNome} />
              <View style={{ flexDirection: 'row', gap: esp.m }}>
                <View style={{ flex: 2 }}>
                  <Campo rotulo="Nº da OAB" placeholder="123456" keyboardType="number-pad" value={oab} onChangeText={setOab} />
                </View>
                <View style={{ flex: 1 }}>
                  <Campo
                    rotulo="UF"
                    placeholder="SP"
                    autoCapitalize="characters"
                    maxLength={2}
                    value={uf}
                    onChangeText={setUf}
                  />
                </View>
              </View>
              <Botao titulo="Começar" icone="arrow-forward" onPress={comecar} carregando={salvando} />
              <Botao titulo="Explorar no modo demonstração" variante="texto" onPress={demo} desabilitado={salvando} />
              <Text style={st.priv}>
                🔒 Seus dados ficam apenas neste aparelho. A consulta é feita direto na API pública do DJEN (CNJ).
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: esp.xl, gap: 8 },
  logo: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  marca: { fontSize: 32, fontWeight: '800', color: '#fff' },
  slogan: { fontSize: 16, color: '#C7D2FE', textAlign: 'center' },
  painel: { flex: 1, backgroundColor: cores.fundo, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: esp.xl, gap: esp.l, paddingBottom: 48 },
  benef: { flexDirection: 'row', gap: esp.m, alignItems: 'center' },
  benefIcone: { width: 44, height: 44, borderRadius: 12, backgroundColor: cores.primariaClara, alignItems: 'center', justifyContent: 'center' },
  benefTitulo: { fontSize: 15, fontWeight: '700', color: cores.texto },
  benefTexto: { fontSize: 13, color: cores.textoSec },
  priv: { fontSize: 12, color: cores.textoSec, textAlign: 'center', lineHeight: 17 },
});
