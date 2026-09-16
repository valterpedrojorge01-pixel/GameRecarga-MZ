# Backend seguro — GameRecarga MZ

Arquitetura:

`GitHub Pages (frontend) -> Cloudflare Worker -> NetShop`

O histórico de pedidos e pagamentos será persistido em **Cloudflare D1**. O KV não é necessário para esta arquitetura.

## D1

O esquema está em `api/schema.sql` e cria as tabelas `orders` e `payments`, com índices para estado, data, referência e ID do pagamento.

Depois de criar a base D1 no Cloudflare, aplicar:

```bash
npx wrangler d1 execute gamerecarga-mz-db --remote --file=api/schema.sql
```

E adicionar ao `api/wrangler.toml` uma binding com o ID real da base:

```toml
[[d1_databases]]
binding = "DB"
database_name = "gamerecarga-mz-db"
database_id = "COLOCA_AQUI_O_D1_DATABASE_ID"
```

## Secrets

Configurar no Worker:

- `NETSHOP_API_KEY` — chave privada da NetShop.
- `NETSHOP_WEBHOOK_SECRET` — segredo usado para validar os webhooks da NetShop.
- `ADMIN_KEY` — chave privada para proteger o painel administrativo.

Nunca colocar esses valores no HTML, JavaScript público ou GitHub.

## Fluxo

1. O cliente cria o pedido.
2. O Worker cria a cobrança na NetShop.
3. O pedido é gravado no D1 como `Pagamento pendente`.
4. A NetShop envia o webhook.
5. O Worker valida a assinatura e atualiza `payment_status`, `status` e `delivery_status`.
6. O painel administrativo consulta o D1 e apresenta pedidos, pagamentos, falhas e receita.
