import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { cores, esp, raio } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function Botao({
  titulo,
  onPress,
  icone,
  variante = 'primario',
  carregando,
  desabilitado,
  style,
}: {
  titulo: string;
  onPress: () => void;
  icone?: IconName;
  variante?: 'primario' | 'secundario' | 'perigo' | 'texto';
  carregando?: boolean;
  desabilitado?: boolean;
  style?: ViewStyle;
}) {
  const v = {
    primario: { bg: cores.primaria, fg: '#fff', borda: cores.primaria },
    secundario: { bg: cores.card, fg: cores.primaria, borda: cores.primaria },
    perigo: { bg: cores.card, fg: cores.vermelho, borda: cores.vermelho },
    texto: { bg: 'transparent', fg: cores.primaria, borda: 'transparent' },
  }[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado || carregando}
      style={({ pressed }) => [
        s.botao,
        { backgroundColor: v.bg, borderColor: v.borda, opacity: desabilitado ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {carregando ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icone && <Ionicons name={icone} size={18} color={v.fg} />}
          <Text style={[s.botaoTexto, { color: v.fg }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Badge({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  return (
    <View style={[s.badge, { backgroundColor: fundo }]}>
      <Text style={[s.badgeTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

export function Vazio({ icone, titulo, texto, acao }: { icone: IconName; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <View style={s.vazio}>
      <View style={s.vazioIcone}>
        <Ionicons name={icone} size={36} color={cores.primaria} />
      </View>
      <Text style={s.vazioTitulo}>{titulo}</Text>
      <Text style={s.vazioTexto}>{texto}</Text>
      {acao}
    </View>
  );
}

export function Titulo({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[s.titulo, style]}>{children}</Text>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <Text style={s.rotulo}>{children}</Text>;
}

export function Campo(props: TextInputProps & { rotulo?: string }) {
  const { rotulo, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {rotulo && <Rotulo>{rotulo}</Rotulo>}
      <TextInput placeholderTextColor={cores.cinza} style={[s.campo, style]} {...rest} />
    </View>
  );
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable key={o.valor} onPress={() => onChange(o.valor)} style={[s.segItem, ativo && s.segAtivo]}>
            <Text style={[s.segTexto, ativo && { color: cores.primaria }]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<T extends string | number>({
  opcoes,
  valor,
  onChange,
  sufixo = '',
}: {
  opcoes: T[];
  valor: T;
  onChange: (v: T) => void;
  sufixo?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map((o) => {
        const ativo = o === valor;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} style={[s.chip, ativo && s.chipAtivo]}>
            <Text style={[s.chipTexto, ativo && { color: '#fff' }]}>
              {o}
              {sufixo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Aviso({ texto }: { texto: string }) {
  return (
    <View style={s.aviso}>
      <Ionicons name="information-circle-outline" size={16} color={cores.textoSec} />
      <Text style={s.avisoTexto}>{texto}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: cores.card,
    borderRadius: raio.l,
    padding: esp.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: raio.m,
    borderWidth: 1.5,
    minHeight: 50,
  },
  botaoTexto: { fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeTexto: { fontSize: 12, fontWeight: '700' },
  vazio: { alignItems: 'center', padding: esp.xl, gap: esp.s, marginTop: 40 },
  vazioIcone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: esp.s,
  },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  vazioTexto: { fontSize: 15, color: cores.textoSec, textAlign: 'center', marginBottom: esp.m, lineHeight: 21 },
  titulo: { fontSize: 13, fontWeight: '700', color: cores.textoSec, textTransform: 'uppercase', letterSpacing: 0.6 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.texto },
  campo: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.m,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: cores.texto,
  },
  seg: { flexDirection: 'row', backgroundColor: cores.cinzaClaro, borderRadius: raio.m, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: raio.s },
  segAtivo: { backgroundColor: cores.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segTexto: { fontSize: 14, fontWeight: '600', color: cores.textoSec },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.card,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { fontSize: 14, fontWeight: '600', color: cores.texto },
  aviso: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 4 },
  avisoTexto: { flex: 1, fontSize: 12, color: cores.textoSec, lineHeight: 17 },
});
