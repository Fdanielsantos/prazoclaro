# PrazoClaro ⏳

**Assistente de prazos processuais de bolso para advogados autônomos e pequenos escritórios.**

## O problema
Advogados independentes raramente pagam sistemas como Astrea ou Projuris e controlam prazos em planilhas ou agendas comuns. Essas ferramentas **não descontam fins de semana, feriados forenses nem o recesso de 20/12 a 20/01**, e um prazo perdido pode custar o processo do cliente.

## A solução
| Função | Como funciona |
|---|---|
| 📥 **Intimações do DJEN** | Busca automática pelo nº da OAB/UF na API pública do Diário de Justiça Eletrônico Nacional (Comunica PJe/CNJ). |
| 📋 **Colar intimação** | Para intimações recebidas por e-mail, PDF ou sistema do tribunal. |
| 🧮 **Cálculo automático** | Publicação no 1º dia útil após a disponibilização (Lei 11.419/06, art. 4º, §§3º e 4º), contagem em dias úteis (CPC, art. 219), feriados nacionais fixos e móveis (Carnaval, Sexta-feira Santa, Corpus Christi), recesso (CPC, art. 220) e feriados locais cadastrados. |
| 🔎 **Prazo sugerido** | Identifica no texto expressões como “no prazo de 15 (quinze) dias”. |
| 🧾 **Cálculo transparente** | Linha do tempo com disponibilização, publicação, início e vencimento, e a lista de dias desconsiderados. |
| 🔔 **Alertas locais** | Notificações X dias antes, na véspera e no dia do vencimento, mesmo sem internet. |
| 💬 **Relatório ao cliente** | Texto em linguagem simples, pronto para enviar por WhatsApp ou e-mail. |

## Arquitetura local-first (custo zero de backend)
- **Expo / React Native + Expo Router**, em TypeScript.
- **expo-sqlite:** intimações, prazos, feriados e configurações ficam só no aparelho.
- **expo-notifications:** alertas agendados localmente.
- A consulta vai direto do celular à API pública do DJEN. Não há servidor próprio.

## Como rodar
```bash
npm install
npx expo start --tunnel   # escaneie o QR code com a câmera do iPhone (Expo Go)
npm test                  # testes do motor de prazos
```
Sem OAB para testar? Escolha **“Explorar no modo demonstração”** na tela inicial.

## Estrutura
```
src/app/          telas (Expo Router): onboarding, abas, intimação, prazo
src/prazos/       motor de cálculo (datas, feriados, cálculo, sugestão)
src/djen/         cliente da API do DJEN + dados de demonstração
src/db/           schema e repositório SQLite
```

## Próximos passos
- Resumo da intimação com IA, via proxy.
- Importação de PDF.
- Visão de calendário.
- Publicação na App Store e na Play Store com EAS Build.

> O PrazoClaro é uma ferramenta de apoio e não substitui a conferência do advogado.
