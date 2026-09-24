# Shortlink Encurtador

API de encurtamento de URLs desenvolvida em Node.js, Express e TypeScript. O projeto usa PostgreSQL como armazenamento persistente e Redis como cache distribuído.

## Autoria

O repositório está associado ao usuário **Kauane03**, conforme os campos `repository` e `homepage` do `package.json`. A estrutura e a implementação atual foram organizadas para demonstrar conceitos de APIs stateless, concorrência, persistência e cache em Sistemas Distribuídos.

## O que já foi feito

- Migração da estrutura de JavaScript para TypeScript.
- Configuração do compilador em `tsconfig.json`.
- Configuração dos scripts `build` e `start`.
- API HTTP com Express.
- Endpoint `POST /links` para criar links curtos.
- Geração de códigos Base62 aleatórios.
- Persistência dos links no PostgreSQL.
- Tratamento de colisões de código usando o erro PostgreSQL `23505`.
- Retry automático com `while` até inserir um código disponível.
- Cache distribuído com Redis.
- Endpoint `GET /:code` com fluxo cache-aside:
  1. procura no Redis;
  2. em caso de cache miss, consulta o PostgreSQL;
  3. grava o resultado no Redis com TTL;
  4. redireciona com HTTP 302.
- Uso de variáveis de ambiente por meio do pacote `dotenv`.
- Comentários em português explicando escalabilidade, concorrência, stateless e cache distribuído.

## Estrutura de pastas

```text
shortlink-encurtador/
├── config/
│   └── db.ts
├── db/
│   └── schema.ts
├── controllers/
│   └── linkController.ts
├── utils/
│   └── base62.ts
├── server.ts
├── drizzle.config.ts
├── drizzle/
│   └── 0000_wakeful_darwin.sql
├── tsconfig.json
├── package.json
└── package-lock.json
```

### `server.ts`

É o ponto de entrada da aplicação. Ele:

- carrega as variáveis do `.env`;
- cria o servidor Express;
- configura CORS e leitura de JSON;
- cria e conecta o cliente Redis;
- registra as rotas;
- inicia a API na porta configurada.

O servidor não guarda sessões nem links em memória. Por isso, várias instâncias podem rodar atrás de um balanceador de carga sem depender da afinidade de sessão.

### `config/db.ts`

Cria um `Pool` de conexões do PostgreSQL e uma instância do Drizzle sobre esse pool. O pool evita abrir uma nova conexão para cada requisição e permite reutilizar conexões com o banco.

O PostgreSQL é a fonte persistente dos dados. O Redis pode perder dados do cache sem perder os links, porque o fallback consulta o banco.

### `db/schema.ts`

Define a tabela `links` usando o schema do Drizzle. A definição corresponde a:

- `id`: `BIGSERIAL` e chave primária;
- `shortCode`: `VARCHAR(32)`, obrigatório e único;
- `originalUrl`: `TEXT`, obrigatório;
- `createdAt`: `TIMESTAMPTZ`, obrigatório e preenchido com `NOW()`.

### `drizzle.config.ts` e `drizzle/`

Configuram e armazenam as migrations do Drizzle. O arquivo SQL em `drizzle/` é gerado a partir de `db/schema.ts`; ele cria a tabela no PostgreSQL sem precisar copiar SQL manualmente.

### `controllers/linkController.ts`

Contém a lógica dos endpoints:

- `createShortLink`: valida a URL, gera o código Base62, insere no banco, trata colisões e popula o Redis.
- `redirectShortLink`: consulta o Redis primeiro, consulta o banco em caso de cache miss, repopula o cache e responde com redirecionamento `302`.

A restrição `UNIQUE` no PostgreSQL é essencial para que concorrências entre requisições ou instâncias sejam resolvidas corretamente.

### `utils/base62.ts`

Gera códigos curtos usando os caracteres `0-9`, `a-z` e `A-Z`. A função usa bytes aleatórios para reduzir a probabilidade de colisões, mas a garantia final de unicidade é responsabilidade do banco de dados.

## Pré-requisitos

- Node.js 20 ou superior recomendado.
- npm.
- PostgreSQL local ou hospedado.
- Redis local ou hospedado.

Docker não é obrigatório. Em um computador mais fraco, PostgreSQL e Redis podem ser usados em serviços externos, como Neon/Supabase para PostgreSQL e Upstash para Redis.

## Configuração do banco

O schema está definido em `db/schema.ts`. Para gerar uma migration depois de alterar o schema:

```bash
npm run db:generate
```

Para aplicar a migration no banco configurado em `DATABASE_URL`:

```bash
npm run db:migrate
```

A migration atual cria a tabela equivalente ao SQL abaixo:

```sql
CREATE TABLE "links" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "short_code" varchar(32) NOT NULL,
  "original_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "links_short_code_unique" UNIQUE("short_code")
);
```

A coluna `short_code` precisa ser `UNIQUE`. Sem essa restrição, duas requisições concorrentes poderiam gravar o mesmo código e o tratamento do erro `23505` não seria acionado.

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000

# Pode ser usada uma URL completa ou as variáveis PGHOST, PGPORT etc.
DATABASE_URL=postgresql://usuario:senha@localhost:5432/encurtador

REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600
PG_POOL_MAX=10
```

Para usar serviços em nuvem, substitua `DATABASE_URL` e `REDIS_URL` pelas URLs fornecidas pelos serviços. Não publique o `.env` no GitHub.

## Instalação e execução

Instale as dependências:

```bash
npm install
```

Compile o TypeScript:

```bash
npm run build
```

Crie/aplique a tabela usando Drizzle:

```bash
npm run db:migrate
```

Inicie a API compilada:

```bash
npm start
```

A API ficará disponível, por padrão, em `http://localhost:3000`.

## Uso da API

### Criar um link curto

Requisição:

```bash
curl -X POST http://localhost:3000/links ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://www.example.com\"}"
```

No PowerShell, também é possível usar:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/links -ContentType "application/json" -Body '{"url":"https://www.example.com"}'
```

Resposta esperada:

```json
{
  "code": "aZ91kLm",
  "shortUrl": "http://localhost:3000/aZ91kLm"
}
```

### Redirecionar para a URL original

```http
GET /aZ91kLm
```

A resposta é HTTP `302` para a URL original.

Se o código não existir, a API responde HTTP `404`.

## Fluxo distribuído

### Criação

1. A instância stateless recebe a URL.
2. Gera um código Base62.
3. Tenta inseri-lo no PostgreSQL.
4. Se ocorrer `23505`, outra requisição já usou aquele código; um novo código é gerado.
5. Após a persistência, a URL é colocada no Redis com TTL.

O banco é a autoridade para unicidade. Isso é mais seguro do que tentar garantir exclusividade apenas na memória de uma instância.

### Redirecionamento

1. A API procura `link:<codigo>` no Redis.
2. Se encontrar, faz cache hit e redireciona sem consultar o banco.
3. Se não encontrar, faz cache miss e consulta o PostgreSQL.
4. Se encontrar no banco, armazena novamente no Redis com TTL.
5. Redireciona com HTTP `302`.

Esse padrão reduz a carga no banco quando os links são acessados repetidamente e permite que várias instâncias compartilhem o mesmo cache.

## Limitações atuais

- Ainda não há testes automatizados; o script `npm test` é apenas um placeholder.
- O controller ainda usa SQL parametrizado com `pg`; o Drizzle está integrado para schema, migrations e acesso futuro tipado. A tabela já é criada pela migration do Drizzle.
- O tratamento global de erros do Express ainda pode ser melhorado para retornar respostas padronizadas.
- O endpoint não possui autenticação, autorização ou controle de abuso.
- Não há rate limiting, observabilidade, métricas ou tracing.
- O loop de colisão não possui limite máximo de tentativas. Na prática, colisões são improváveis com o código atual, mas um limite com resposta de erro seria mais defensivo.
- O Redis é obrigatório para iniciar a aplicação nesta versão. Não existe fallback automático para rodar sem cache.
- O projeto aceita qualquer URL sintaticamente válida; não verifica se o endereço realmente existe ou é seguro.
- O `GET /:code` pode conflitar futuramente com novas rotas de primeiro nível, caso elas sejam adicionadas sem planejamento.
- O diretório `dist/` é gerado pelo build e não deve ser editado manualmente.

## O que falta para funcionar

1. Instalar as dependências com `npm install`.
2. Ter acesso a um PostgreSQL e executar `npm run db:migrate` para criar a tabela `links`.
3. Ter acesso a um Redis.
4. Criar o arquivo `.env` com as URLs corretas.
5. Executar `npm run build`.
6. Executar `npm start`.
7. Testar o `POST /links` e acessar a `shortUrl` retornada.

Sem PostgreSQL, o projeto compila, mas não consegue persistir ou buscar links. Sem Redis, a versão atual falha ao iniciar porque o servidor conecta ao cache antes de começar a escutar requisições.

## Git e publicação

O Git serve para versionar o código; ele não substitui PostgreSQL ou Redis. Antes de publicar no GitHub, confirme que arquivos com segredos não serão enviados:

```gitignore
node_modules/
dist/
.env
```

Depois, os comandos básicos são:

```bash
git add .
git commit -m "Implementa API de encurtamento em TypeScript"
git push
```

## Status da validação

A compilação TypeScript foi validada com:

```bash
npm run build
```

O build gera os arquivos JavaScript correspondentes dentro de `dist/`. Ainda é necessário testar a execução contra instâncias reais ou hospedadas de PostgreSQL e Redis.
