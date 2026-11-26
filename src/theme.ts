export const cores = {
  primaria: '#1E3A8A',
  primariaClara: '#E8EEFC',
  fundo: '#F4F6FB',
  card: '#FFFFFF',
  texto: '#0F172A',
  textoSec: '#64748B',
  borda: '#E2E8F0',
  vermelho: '#DC2626',
  vermelhoClaro: '#FEE2E2',
  ambar: '#D97706',
  ambarClaro: '#FEF3C7',
  verde: '#16A34A',
  verdeClaro: '#DCFCE7',
  cinza: '#94A3B8',
  cinzaClaro: '#F1F5F9',
};

export const raio = { s: 8, m: 12, l: 18 };
export const esp = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };

export type Urgencia = 'vencido' | 'hoje' | 'proximo' | 'ok' | 'cumprido';

export function corUrgencia(u: Urgencia) {
  switch (u) {
    case 'vencido':
    case 'hoje':
      return { fg: cores.vermelho, bg: cores.vermelhoClaro };
    case 'proximo':
      return { fg: cores.ambar, bg: cores.ambarClaro };
    case 'ok':
      return { fg: cores.verde, bg: cores.verdeClaro };
    default:
      return { fg: cores.cinza, bg: cores.cinzaClaro };
  }
}
