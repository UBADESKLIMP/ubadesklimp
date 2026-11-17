# Pedido de integração — Ubadesklimp

## Quem somos e o que precisamos

A Ubadesklimp é uma loja de produtos de limpeza (cerca de 9.800 itens). Temos um sistema próprio (site + painel interno) e um sistema de gestão (ERP) onde ficam o estoque e as vendas.

Hoje os dois **não conversam**. Alguém copia os dados do ERP para o nosso sistema à mão. Queremos que os dados passem **sozinhos**.

**O que pedimos a vocês:** dizer se é possível, e como, fazer as integrações abaixo. Não precisam conhecer nosso sistema. Em cada item descrevemos o que sai e para onde vai.

Está em ordem de prioridade. Os itens 1 a 4 são os mais importantes.

---

## A. Dados que saem do ERP e chegam ao nosso sistema (só leitura)

| # | O que | Quais campos | Com que frequência |
|---|-------|--------------|--------------------|
| 1 | **Produtos** | código (SKU), nome, categoria, marca, preço, código de barras, ativo/inativo | uma carga inicial e depois quando mudar |
| 2 | **Estoque** | SKU e quantidade em estoque | a cada 5 a 15 minutos, ou assim que mudar |
| 3 | **Vendas** | número, data, cliente, itens (SKU, quantidade, preço), total, forma de pagamento | assim que a venda fechar |
| 4 | **Entregas** | número da nota ou pedido, cliente, telefone, endereço, bairro, itens | assim que o pedido for marcado para entrega |
| 5 | **Clientes** | nome, telefone, endereço | quando mudar |
| 6 | **Fornecedores e compras** | fornecedores, pedidos de compra, entrada de mercadoria | quando mudar |

## B. Dados que saem do nosso sistema e vão para o ERP (escrita)

| # | O que | Para quê |
|---|-------|----------|
| 7 | **Pedido feito no nosso site** | virar pedido no ERP, sem digitar duas vezes |
| 8 | **Entrega concluída** | o entregador marca "entregue" no celular e o ERP é atualizado |

## C. Outros serviços (se não vierem prontos no ERP)

- **Pagamento por Pix/cartão:** só se o site passar a vender direto.
- **Nota fiscal (NF-e/NFC-e):** normalmente o ERP já faz.
- **Cálculo de frete e rota de entrega:** opcional.

---

## O que precisamos saber de vocês

1. O ERP tem **API** (por exemplo REST/JSON)? Se não, ele consegue **exportar arquivos automaticamente** (CSV/XML) para uma pasta ou endereço?
2. Cada item acima (1 a 8): dá para fazer? Se sim, em que prazo
3. Existe aviso automático (**webhook**) quando o estoque ou uma venda muda, ou só dá para consultar de tempos em tempos?
4. Como é a **autenticação** (chave de API, usuário e senha, OAuth)? Dá para criar uma chave só de leitura para os itens da parte A?
5. Existe **ambiente de teste** e documentação?
6. Há **limite de consultas** por minuto ou por dia?
7. O **código do produto (SKU)** é único e estável? Isso é essencial, é por ele que ligamos os dois sistemas.

## Regras que precisam ser respeitadas

- Para a parte A, o acesso deve ser **somente leitura**.
- Nenhuma senha ou chave pode ficar visível no site; as chamadas serão feitas por um servidor nosso.
- Dados de clientes (telefone, endereço) são pessoais: transmissão criptografada (HTTPS) e acesso restrito.
- Se o ERP ficar fora do ar, nosso sistema deve continuar funcionando com o último dado recebido.

## Contato

João — joaovftoledo1@gmail.com
