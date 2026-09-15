# Configuração do painel administrativo

## Cloudflare Worker

O worker `api/cloudflare-worker.js` agora usa Cloudflare KV para guardar pedidos e expõe:

- `GET /admin/dashboard`
- `GET /admin/orders`
- `POST /webhook`
- `POST /create-order`

### 1. Criar o KV

No Cloudflare Dashboard, crie um KV namespace e copie o **Namespace ID**.

Depois substitua `REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID` em `api/wrangler.toml` pelo ID real.

### 2. Configurar secrets

Configure no Worker:

```bash
wrangler secret put NETSHOP_API_KEY
wrangler secret put NETSHOP_WEBHOOK_SECRET
wrangler secret put ADMIN_KEY
```

`ADMIN_KEY` deve ser uma senha longa e aleatória usada exclusivamente pelo painel administrativo.

### 3. Segurança do painel

A API rejeita `/admin/*` sem o header `X-Admin-Key`.

O ficheiro `docs/admin.html` é a interface visual do painel, mas a versão atual precisa de uma camada de autenticação antes de ser colocada em produção pública. Não coloque `ADMIN_KEY` no JavaScript do navegador.

### 4. Webhook NetShop

Configure no NetShop o endpoint:

`POST https://gamerecarga-mz-api.<subdominio>.workers.dev/webhook`

Use o mesmo valor de `NETSHOP_WEBHOOK_SECRET` fornecido pelo NetShop.

O webhook valida HMAC-SHA256 e atualiza o pedido correspondente pelo `reference` ou `charge_id`.
