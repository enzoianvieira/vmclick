# Integração Olist ERP (API v3)

Sync unidirecional: **Olist ERP → `data/produtos.js`**. Site continua estático (roda em `file://`), catálogo regenerado sob demanda por script Node.

Escopo atual: **apenas listar produtos** via `GET /public-api/v3/produtos`. Sem enriquecimento por endpoint de detalhe.

---

## 1. Auth — obter access token (automatizado)

Setup único:

1. Criar aplicativo no painel Olist: `Configurações → Aplicativos API v3`.
   - **Permissão marcada:** apenas **Produtos** (leitura). Não marcar mais nada.
   - **URL de redirecionamento:** `http://localhost:3000/callback`
   - Copiar `client_id` e `client_secret`.

2. Preencher `.env`:
   ```
   TINY_CLIENT_ID=xxx
   TINY_CLIENT_SECRET=yyy
   TINY_REDIRECT_URI=http://localhost:3000/callback
   ```

3. Rodar:
   ```bash
   npm run get-token
   ```
   → sobe servidor local :3000, abre browser no login Olist, captura o `code`, troca por tokens, grava `TINY_ACCESS_TOKEN` + `TINY_REFRESH_TOKEN` no `.env` automaticamente.

4. Access token dura 4h. Refresh dura 1 dia. Pra renovar sem browser:
   ```bash
   npm run get-token:refresh
   ```

---

## 2. Configurar `.env`

```bash
cp .env.example .env
```

Preencher:

```
TINY_ACCESS_TOKEN=eyJhbGciOi...
TINY_PAGE_SIZE=100
TINY_SITUACAO=A
```

`.env` está no `.gitignore`.

---

## 3. Rodar sync

Dry run (não grava arquivo):

```bash
npm run sync-tiny:dry
```

Sync real:

```bash
npm run sync-tiny
```

Backup do arquivo anterior fica em `data/produtos.js.bak`.

---

## 4. Endpoint usado

```
GET https://api.tiny.com.br/public-api/v3/produtos?situacao=A&limit=100&offset=N
Authorization: Bearer {access_token}
```

Response:

```json
{
  "itens": [{
    "id": 12345, "sku": "41-1877", "descricao": "Disjuntor...",
    "tipo": "S", "situacao": "A", "unidade": "un", "gtin": "789...",
    "precos": { "preco": 16.40, "precoPromocional": null, ... },
    "estoque": { "localizacao": "..." }
  }],
  "paginacao": { "limit": 100, "offset": 0, "total": 247 }
}
```

---

## 5. Mapeamento

| Local | API v3 (`/produtos`) |
|---|---|
| `sku` | `sku` |
| `nome` | `descricao` |
| `preco` | `precos.preco` (ou `precoPromocional` se menor) |
| `precoDe` | `precos.preco` (quando promo ativa) |
| `unidade` | `unidade` |
| `specs.GTIN` | `gtin` |
| `slug` | slugify(`descricao`) |
| `cat` | **fallback `utilidades`** — endpoint não retorna categoria |
| `marca`, `desc`, `estoque` | **vazios** — não retornados pela listagem |
| `nota`, `avaliacoes`, `novo`, `destaque` | defaults (curadoria manual) |

---

## 6. Rate limit

Headers em toda resposta:
- `X-RateLimit-Limit` — total/minuto
- `X-RateLimit-Remaining` — restantes no minuto atual
- `X-RateLimit-Reset` — segundos até reset

Script:
- Pausa proativa quando `remaining <= 3`
- Em `HTTP 429`, aguarda `reset` e retenta
- Em `HTTP 401`, aborta (token expirado — renove pelo refresh)

---

## 7. Limitações e próximos passos

**Não implementado (por decisão de escopo):**
- Detalhe do produto (`GET /produtos/{id}`) → traria marca, descrição, categoria, atributos
- Estoque (endpoint separado)
- Imagens/anexos
- Categorias (mapping Olist → slug local)
- Refresh automático de token

Se quiser algum destes depois, é extensão direta do script.

---

## 8. Fase 2 (WordPress)

Na migração pra WooCommerce, o plugin oficial faz sync bidirecional e este script sai de cena.
