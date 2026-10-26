# Fortex

Intermediadora digital de fretes rodoviários. O contrato de transporte é firmado entre o embarcador e o transportador (TAC ou ETC); o Fortex faz o matching, calcula o preço a partir do piso ANTT e acompanha a viagem. MVP: grãos no corredor Goiás–Minas Gerais.

## Regras que o código não pode violar

1. **Piso ANTT:** nenhum frete é anunciado, ofertado ou publicado abaixo do piso mínimo (Lei 13.703/2018; Lei 15.485/2026; Res. ANTT 6.084/2026).
2. **100% ao transportador:** nada é descontado do frete (Lei 11.442/2007, art. 13-B). A taxa do Fortex é cobrada do embarcador, com nota fiscal própria.
3. **Pagamento via IPEF:** o frete passa por instituição de pagamento eletrônico de frete habilitada, com CIOT, adiantamento na coleta e saldo na entrega (prazo legal de até 30 dias úteis).
4. **Vale-Pedágio e estadia fora do frete;** estadia devida após 5 horas de espera (Lei 11.442, art. 11).

## Estrutura

| Pasta | O que é |
|---|---|
| `packages/pricing` | Motor de preço: piso ANTT, preço sugerido, bloqueio abaixo do piso e composição da cotação |
| `packages/validacao` | Validação local de CPF, CNPJ (inclusive alfanumérico), CNH, RENAVAM, placa e RNTRC |
| `packages/db` | Esquema do banco (Drizzle + PostgreSQL), migrações SQL e banco em memória para testes |
| `apps/api` | Back-end NestJS: cotação, cadastro de transportadores, veículos e embarcadores |
| `apps/web` | Web do embarcador (Next.js). Hoje tem a tela de publicar carga e cotação |
| `apps/mobile` | App do motorista (React Native com Expo). Hoje lista ofertas de exemplo |

Valores monetários são sempre inteiros em centavos.

## Rodando localmente

Requisitos: Node 22+, pnpm 10, Docker (para o banco).

```bash
pnpm install
cp .env.example .env
pnpm db:up          # PostgreSQL 16 com PostGIS
pnpm --filter @fortex/db build && DATABASE_URL=postgresql://fortex:fortex@localhost:5432/fortex pnpm --filter @fortex/db db:migrate
pnpm test           # testes (usam PostgreSQL em memória, sem Docker)
pnpm dev            # api em :3001, web em :3000
cd apps/mobile && pnpm dev   # app do motorista no Expo
```

## API

| Rota | O que faz |
|---|---|
| `POST /cotacoes` | Piso ANTT, preço sugerido e cotação; recusa frete abaixo do piso |
| `POST /transportadores` | Cadastra TAC (CPF + CNH) ou ETC (CNPJ), com RNTRC; começa `PENDENTE` |
| `GET /transportadores/:id` | Dados, veículos e elegibilidade para receber ofertas |
| `POST /transportadores/:id/veiculos` | Placa, RENAVAM, eixos (2–7 ou 9) e carroceria (graneleiro ou basculante) |
| `POST /embarcadores` | Cadastra embarcador por CNPJ ou CPF de produtor rural |
| `GET /embarcadores/:id` | Dados do embarcador |

O transportador só recebe ofertas com verificação `APROVADO` e ao menos um veículo ativo.

## Pendências do cadastro

- [ ] Autenticação (login por telefone com código) — as rotas ainda estão abertas; não expor fora do ambiente local.
- [ ] Verificação na fonte: RNTRC na ANTT, CNH no SENATRAN, CPF/CNPJ na Receita, prova de vida. Hoje a validação é só de formato e dígito verificador.
- [ ] Painel de aprovação manual de cadastros (com motivo obrigatório na reprovação, já garantido pelo banco).
- [ ] Seguros obrigatórios do transportador (RCTR-C) e documentos em anexo.

## Pendências antes de cotar de verdade

- [x] Coeficientes de granel sólido (Tabela A, lotação) carregados em `packages/pricing/src/tabela-vigente.ts`: Res. ANTT 6.084/2026 com o reajuste da Portaria SUROC 22/2026, em vigor desde 30/09/2026.
- [ ] Conferir esses coeficientes contra o DOU / ANTTlegis antes do lançamento (foram transcritos da LegisWeb).
- [ ] Atualizar a tabela a cada nova portaria de reajuste da ANTT. Tipos de carga sem coeficiente carregado respondem `TABELA_PISO_INDISPONIVEL`.
- [ ] Definir com o cliente o percentual da taxa Fortex (hoje 8%, valor do exemplo do estudo) e o adiantamento padrão.
- [ ] Escolher a IPEF parceira para a integração de CIOT, adiantamento e saldo.
- [ ] Parecer jurídico e tributário sobre o enquadramento como intermediadora.

## Documentos

- Estudo de viabilidade v0.3 (22/10/2026) — a v0.4 vai refletir o escopo só do Fortex.
- Protótipos das telas do MVP no canvas de design do projeto.
