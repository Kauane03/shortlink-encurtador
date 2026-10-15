# ShortLink

Projeto acadêmico de um encurtador de URLs com frontend web e API distribuída. O backend usa Node.js, Express, TypeScript, PostgreSQL, Drizzle ORM e Redis.

## Status atual

- Frontend responsivo em `frontend/index.html`.
- API `POST /links` para criar links curtos.
- API `GET /:code` para redirecionar com HTTP 302.
- Geração de códigos Base62.
- PostgreSQL para persistência.
- Drizzle para schema e migrations.
- Redis para cache distribuído com TTL.
- Tratamento de colisão PostgreSQL `23505` com novas tentativas.
- Frontend conectado ao backend local em `http://localhost:3000/links`.
- TypeScript compilando com sucesso por meio de `npm run build`.

## Tecnologias utilizadas

### Backend

- **Node.js**: executa a API no computador e também os comandos do projeto.
- **TypeScript**: adiciona tipagem ao código e é compilado para JavaScript em `dist/`.
- **Express**: cria o servidor HTTP e as rotas `POST /links` e `GET /:code`.
- **pg**: driver usado para conectar a API ao PostgreSQL.
- **Drizzle ORM e Drizzle Kit**: definem a tabela em `db/schema.ts` e geram/aplicam migrations.
- **Redis**: cache distribuído para acelerar os redirecionamentos.
- **dotenv**: carrega as configurações do arquivo `.env`.
- **cors**: permite requisições do frontend para a API durante o desenvolvimento.
- **crypto do Node.js**: gera bytes aleatórios usados na criação dos códigos Base62.

### Frontend

- **HTML, CSS e JavaScript**: interface web responsiva em um único arquivo, `frontend/index.html`.
- **Fetch API**: envia a URL para o endpoint `POST /links`.
- **`npx serve`**: servidor HTTP simples usado para abrir o frontend localmente.

## Alternativas utilizadas para conseguir rodar

O projeto foi executado localmente apenas com Node.js, enquanto os serviços pesados ficaram hospedados:

| Necessidade | Solução utilizada | Alternativa possível |
|---|---|---|
| PostgreSQL | **Neon** usando `DATABASE_URL` | PostgreSQL instalado localmente, Supabase ou Docker |
| Redis | **Upstash** usando `rediss://` com TLS | Redis local, Redis Cloud ou Docker |
| Servir o frontend | `npx serve frontend` | Extensão Live Server ou abrir o HTML diretamente |
| Criar a tabela | Drizzle Kit com `npm run db:migrate` | Executar o SQL manualmente no PostgreSQL |
| Ambiente isolado | Não foi usado Docker | Docker Compose com API, PostgreSQL e Redis |

Essa escolha reduz o consumo de memória do computador. O Node.js e o frontend continuam locais, mas o PostgreSQL e o Redis são acessados pela internet.

### Por que usar `rediss://` no Redis

O Upstash exige conexão TLS. Por isso, a variável precisa usar `rediss://` e incluir a porta na URL completa:

```env
REDIS_URL=rediss://default:senha@servidor.upstash.io:6379
```

Usar `redis://` em um servidor que exige TLS causa erros como `SocketClosedUnexpectedlyError`. A conexão correta foi confirmada com um teste `PING`, que retornou `PONG`.

### Por que não usar Docker

Docker seria útil para reproduzir toda a infraestrutura local, mas consome mais memória e CPU. Como o computador possui poucos recursos, Neon e Upstash foram usados como alternativas mais leves. O Docker continua sendo uma opção para desenvolvimento offline ou para padronizar o ambiente de uma equipe.

## Estrutura

```text
shortlink-encurtador/
├── frontend/
│   └── index.html               # Interface web e integração com a API
├── config/
│   └── db.ts                    # Pool PostgreSQL e instância Drizzle
├── db/
│   └── schema.ts                # Tabela links definida no Drizzle
├── controllers/
│   └── linkController.ts        # Criação e redirecionamento de links
├── utils/
│   └── base62.ts                # Geração do código curto
├── drizzle/
│   └── 0000_wakeful_darwin.sql # Migration gerada pelo Drizzle
├── server.ts                    # Entrada da API Express
├── drizzle.config.ts            # Configuração do Drizzle Kit
├── tsconfig.json                # Configuração TypeScript
├── package.json                 # Dependências e scripts
└── .env                         # Configuração local, não publicar
```

## Como a integração funciona

O frontend envia:

```http
POST http://localhost:3000/links
Content-Type: application/json
```

```json
{
  "url": "https://exemplo.com/pagina"
}
```

A API responde com:

```json
{
  "code": "aZ91kLm",
  "shortUrl": "http://localhost:3000/aZ91kLm"
}
```

O frontend mostra essa URL e o botão de cópia copia o endereço completo. Ao abrir a URL curta, o backend procura primeiro no Redis; se não encontrar, consulta o PostgreSQL, preenche o cache e redireciona para a URL original.

## Pré-requisitos

- Node.js 20 ou superior recomendado.
- npm.
- PostgreSQL local ou hospedado.
- Redis local ou hospedado.

Docker não é obrigatório. Para um computador mais fraco, PostgreSQL e Redis podem ser usados na nuvem, como Neon/Supabase e Upstash.

## Configuração

Crie ou atualize o arquivo `.env` na raiz:

```env
PORT=3000
DATABASE_URL=postgresql://usuario:senha@host:5432/encurtador
REDIS_URL=rediss://default:senha@servidor.upstash.io:6379
CACHE_TTL_SECONDS=3600
PG_POOL_MAX=10
```

Use `rediss://` quando o Redis exigir TLS, como no Upstash. Nunca publique o `.env`, pois ele contém credenciais.

## Deploy na Vercel

O `vercel.json` configura o frontend estático em `/frontend` (também disponível na raiz) e a API Serverless em `/api`. Configure `DATABASE_URL` com o PostgreSQL de produção na Vercel e execute `npm run db:migrate` uma vez nesse banco.

`REDIS_URL` é opcional: sem ela, a API usa diretamente o PostgreSQL. Para habilitar o cache em produção, configure `REDIS_URL` com a URL do Redis hospedado, como a URL `rediss://` do Upstash. Não use `localhost` na Vercel, pois isso aponta para a própria instância e não para um serviço Redis.

`BASE_URL` é opcional na Vercel: quando não definida, os links curtos usam automaticamente `https://${VERCEL_URL}/api`. Configure-a manualmente somente se quiser usar um domínio próprio.

## Banco de dados com Drizzle

O schema está em `db/schema.ts`. Para gerar uma migration após alterar esse schema:

```powershell
npm run db:generate
```

Para aplicar as migrations no PostgreSQL configurado em `DATABASE_URL`:

```powershell
npm run db:migrate
```

A tabela criada é equivalente a:

```sql
CREATE TABLE "links" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "short_code" varchar(32) NOT NULL,
  "original_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "links_short_code_unique" UNIQUE("short_code")
);
```

A restrição `UNIQUE` é obrigatória para resolver colisões concorrentes com segurança.

## Executar o projeto

Instale as dependências, compile, aplique o banco e inicie a API:

```powershell
npm install
npm run build
npm run db:migrate
npm start
```

Quando tudo estiver correto, aparecerá:

```text
API de encurtador ouvindo na porta 3000
```

Mantenha esse terminal aberto. Para abrir o frontend, em outro terminal execute um servidor estático:

```powershell
npx serve frontend
```

Abra o endereço mostrado pelo comando e use o formulário. Também é possível abrir `frontend/index.html` diretamente no navegador, mas um servidor local evita limitações do navegador relacionadas a arquivos locais.

### Execução em dois terminais

No primeiro terminal, dentro da pasta do projeto:

```powershell
npm run build
npm run db:migrate
npm start
```

No segundo terminal:

```powershell
npx serve frontend
```

Depois, abra o endereço fornecido pelo `serve`. O frontend chama `http://localhost:3000/links`; a API usa o Neon e o Upstash configurados no `.env`.

### Verificações que já funcionaram

```powershell
npm run build
npm run db:migrate
npx drizzle-kit studio
```

- `npm run build`: compilou o TypeScript sem erros.
- `npm run db:migrate`: aplicou a migration da tabela `links` no PostgreSQL.
- `npx drizzle-kit studio`: abriu o Drizzle Studio para visualizar o banco.
- Teste do Redis: `PING` retornou `PONG` após corrigir a URL para `rediss://`.

## Testar somente a API

Em outro terminal, crie um link:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/links `
  -ContentType "application/json" `
  -Body '{"url":"https://www.google.com"}'
```

Para testar o redirecionamento, abra a `shortUrl` retornada ou use:

```powershell
curl.exe -I http://localhost:3000/SEU_CODIGO
```

O esperado é uma resposta HTTP `302` com o cabeçalho `Location`.

## Scripts disponíveis

| Script | Função |
|---|---|
| `npm run build` | Compila TypeScript para `dist/` |
| `npm run db:generate` | Gera migration a partir do schema Drizzle |
| `npm run db:migrate` | Aplica migrations no PostgreSQL |
| `npm start` | Inicia a API compilada |
| `npm test` | Ainda não implementado |

## Limitações e próximos passos

- Ainda não existem testes automatizados.
- O Redis é obrigatório para iniciar a API nesta versão.
- O frontend usa `http://localhost:3000/links`; em produção, altere `API_ENDPOINT` em `frontend/index.html` para a URL pública da API.
- O controller ainda usa SQL parametrizado com `pg`; o Drizzle está integrado para schema, migrations e acesso futuro tipado.
- Não há autenticação, rate limiting, métricas ou tracing.
- O loop de colisão não possui limite máximo de tentativas.
- A validação confirma o formato da URL, mas não verifica se o destino existe ou é seguro.
- O diretório `dist/` é gerado automaticamente e não deve ser editado.

## Git e segurança

O Git versiona o código, mas não substitui PostgreSQL ou Redis. O `.gitignore` impede o envio de `.env`, `node_modules` e `dist`.

```powershell
git status
git add .
git commit -m "Conecta frontend à API de encurtamento"
git push
```

Se uma senha do PostgreSQL ou Redis for compartilhada publicamente, revogue-a no provedor e gere uma nova.
