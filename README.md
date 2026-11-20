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
| `apps/api` | Back-end NestJS: cotação, login, cadastro, verificação, publicação de frete, matching, aceite e status |
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

Toda rota exige login (`Authorization: Bearer <token>`), salvo as marcadas como públicas.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /health` | público | Situação da API |
| `POST /cotacoes` | público | Simulador: piso ANTT, preço sugerido e cotação; recusa frete abaixo do piso |
| `POST /auth/codigo` | público | Envia código de 6 dígitos para o celular |
| `POST /auth/entrar` | público | Troca telefone + código por um token de sessão (30 dias) |
| `POST /auth/sair` | logado | Revoga o token |
| `GET /eu` | logado | Usuário, papel e vínculo |
| `POST /transportadores` | NOVO | Cadastra TAC (CPF + CNH) ou ETC (CNPJ) com RNTRC e vira MOTORISTA |
| `GET /transportadores/:id` | dono ou ADMIN | Dados, veículos e elegibilidade para receber ofertas |
| `POST /transportadores/:id/veiculos` | dono ou ADMIN | Placa, RENAVAM, eixos (2–7 ou 9) e carroceria |
| `POST /embarcadores` | NOVO | Cadastra por CNPJ ou CPF de produtor rural e vira EMBARCADOR |
| `GET /embarcadores/:id` | dono ou ADMIN | Dados do embarcador |
| `GET /admin/cadastros/pendentes` | ADMIN | Fila de verificação |
| `POST /admin/transportadores/:id/verificacao` | ADMIN | `EM_ANALISE`, `APROVADO` ou `REPROVADO` (motivo obrigatório) |
| `POST /admin/embarcadores/:id/verificacao` | ADMIN | Idem, para embarcador |
| `POST /fretes` | EMBARCADOR aprovado | Publica frete com cotação congelada; avisa os motoristas compatíveis |
| `GET /fretes` | logado | Fretes do embarcador, do motorista ou todos (ADMIN) |
| `GET /fretes/:id` | partes ou ADMIN | Frete, motorista designado e linha do tempo; motorista vê os publicados |
| `POST /fretes/:id/aceitar` | MOTORISTA compatível | Aceite atômico: só o primeiro leva |
| `POST /fretes/:id/status` | partes ou ADMIN | Avança, devolve (desistência) ou cancela (motivo obrigatório) |
| `PUT /motorista/disponibilidade` | MOTORISTA | Disponível, posição e destino pretendido |
| `GET /motorista/ofertas` | MOTORISTA | Fretes que ele pode aceitar agora, na ordem do matching |

Regras do login: código vale 10 minutos e uma vez só; 5 tentativas por código; até 3 códigos por telefone a cada 15 minutos; o banco guarda só o HMAC do código e o hash do token. O telefone do login é o telefone do cadastro, e cada telefone tem um cadastro só. Decisões do painel ficam na tabela `auditoria`.

O transportador só recebe ofertas com verificação `APROVADO` e ao menos um veículo ativo.

Para criar o primeiro administrador: entre uma vez com o telefone e rode `DATABASE_URL=... pnpm --filter @fortex/api admin:promover +55DDDNUMERO`.

Em desenvolvimento o código de acesso aparece no console da API. Em produção a API não sobe sem `AUTH_SECRET` (32+ caracteres) e sem um provedor de SMS/WhatsApp.

## Fretes e matching

**Publicação.** Só embarcador aprovado. MVP: granel sólido, graneleiro ou basculante. O frete guarda a cotação do momento (piso, norma, frete, adiantamento, saldo, Vale-Pedágio e taxa), para que um reajuste da ANTT não mude um frete já ofertado. Sem valor informado, o frete sai pelo preço sugerido (hoje, o piso). O banco recusa frete abaixo do piso e adiantamento + saldo diferente do frete. A distância informada não pode ser menor que a linha reta entre origem e destino nem mais de 3 vezes maior.

**Matching** (`apps/api/src/fretes/matching.ts`). Entra quem tem cadastro aprovado, está disponível com posição de até 12 h, está a até 200 km da origem, tem veículo ativo com os mesmos eixos e carroceria e não tem frete em andamento. Ordem: primeiro quem tem destino pretendido a até 100 km do destino da carga (retorno), depois o mais perto da origem. Os 20 primeiros são avisados.

**Ciclo** (`apps/api/src/fretes/status.ts`).

| De | Para | Quem |
|---|---|---|
| PUBLICADO | ACEITO | motorista compatível (rota de aceite) |
| PUBLICADO | CANCELADO | embarcador, admin |
| ACEITO | EM_COLETA | motorista (chegou para carregar) |
| ACEITO | PUBLICADO | motorista desiste, admin; o frete volta à vitrine e os motoristas são avisados de novo |
| ACEITO | CANCELADO | embarcador, admin |
| EM_COLETA | EM_TRANSITO | motorista (coleta confirmada) |
| EM_COLETA | CANCELADO | qualquer parte (espera, carga divergente, avaria) |
| EM_TRANSITO | ENTREGUE | motorista, admin |

Cada mudança fica em `frete_eventos`, com quem e quando. Um motorista tem um frete em andamento por vez (garantido no banco).

## Pendências de fretes

- [ ] Ligar a IPEF: CIOT na publicação ou no aceite, adiantamento ao confirmar a coleta, saldo na entrega.
- [ ] Confirmação de entrega pelo embarcador (hoje o motorista marca) e comprovante.
- [ ] Checklist fotográfico na coleta e na entrega (desenhado nos protótipos).
- [ ] Contagem de estadia a partir de EM_COLETA (5 horas) e valores de cancelamento e deslocamento.
- [ ] Distância calculada por roteirização em vez de informada; geocodificação de cidades.
- [ ] Avisos reais: push no app e WhatsApp (hoje `NotificadorConsole`).
- [ ] Busca geográfica com PostGIS quando o volume de motoristas crescer (hoje filtro por faixa de latitude + cálculo em memória).
- [ ] Telas: publicação e acompanhamento na web, ofertas e viagem no app.

## Pendências do cadastro e do login

- [ ] Escolher o provedor de SMS/WhatsApp e implementar o `EnviadorCodigo` real.
- [ ] Limite de requisições por IP (no proxy ou com `@nestjs/throttler`) antes de expor a API.
- [ ] Verificação na fonte: RNTRC na ANTT, CNH no SENATRAN, CPF/CNPJ na Receita, prova de vida. Hoje a validação é só de formato e dígito verificador.
- [ ] Telas do painel administrativo e de login no app e na web (a API já está pronta).
- [ ] Motoristas vinculados a uma ETC (hoje cada ETC tem um usuário).
- [ ] Seguros obrigatórios do transportador (RCTR-C) e documentos em anexo.

## Pendências antes de cotar de verdade

- [x] Coeficientes de granel sólido (Tabela A, lotação) carregados em `packages/pricing/src/tabela-vigente.ts`: Res. ANTT 6.084/2026 com o reajuste da Portaria SUROC 22/2026, em vigor desde 30/09/2026.
- [ ] Conferir esses coeficientes contra o DOU / ANTTlegis antes do lançamento (foram transcritos da LegisWeb).
- [ ] Atualizar a tabela a cada nova portaria de reajuste da ANTT. Tipos de carga sem coeficiente carregado respondem `TABELA_PISO_INDISPONIVEL`.
- [ ] Definir o percentual da taxa Fortex (hoje 8%, valor do exemplo do estudo) e o adiantamento padrão (hoje 40%).
- [ ] Escolher a IPEF parceira para a integração de CIOT, adiantamento e saldo.
- [ ] Parecer jurídico e tributário sobre o enquadramento como intermediadora.

## Documentos

- Estudo de viabilidade v0.3 (22/10/2026) — a v0.4 vai refletir o escopo só do Fortex.
- Protótipos das telas do MVP no canvas de design do projeto.
