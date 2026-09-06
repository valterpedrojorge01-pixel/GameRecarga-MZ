# Backend seguro — GameRecarga MZ

Este diretório prepara o backend público necessário para o checkout direto da loja.

## Arquitetura

`GitHub Pages (frontend) -> API segura -> NetShop -> M-Pesa/mKesh/cartões`

A chave `NETSHOP_API_KEY` **não deve ser colocada neste repositório nem no JavaScript do frontend**. O GitHub Pages publica HTML, CSS e JavaScript estáticos; o backend deve ser hospedado separadamente.

## Endpoints previstos

- `POST /create-order` — cria uma cobrança NetShop e devolve o estado inicial/página de pagamento quando disponível.
- `GET /orders/:id` — consulta o estado de uma encomenda.
- `POST /webhook` — recebe atualizações da NetShop.

## Variáveis secretas

- `NETSHOP_API_KEY`

## Próximo passo de implantação

Hospedar `api/cloudflare-worker.js` (ou equivalente) em um runtime serverless e configurar `NETSHOP_API_KEY` como segredo do provedor. Depois, definir a URL pública da API no frontend.

Nunca commitar a chave real da NetShop.
