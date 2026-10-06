# Módulo Entregas — desenho

**Data:** 2026-10-06
**Estado:** aprovado no brainstorming; um ponto em aberto (colunas do Excel)

## O problema

O orçamento nasce do pedido no WhatsApp. A Marianna monta, o cliente confirma, ela
imprime. **Impresso quer dizer "é pra entregar"** — é essa a regra que a loja usa hoje,
sem ninguém ter escrito em lugar nenhum.

O Henrique pega os papéis, separa a mercadoria e sai. Volta, e aí o rastro acaba: às
vezes ele não diz o que entregou e o que não entregou. Uma entrega que voltou porque o
cliente estava fechado some — ninguém registra, e a rota do dia seguinte nasce sem saber
que aquela parada ficou pendente.

Duas perdas distintas:

1. **Organização.** O que voltou não vira dívida de ninguém.
2. **Verificação.** "Entreguei" dito na volta, na loja, não distingue entrega feita de
   mercadoria que ficou no carro pra sair outro dia.

E falta ajuda pra montar a rota, que hoje sai de cabeça.

## O que já existe e não vamos refazer

Levantado direto no ERP (Leantech "Sistema Integrado", via Guacamole) em 2026-10-06:

| Coisa | Onde está no ERP |
|---|---|
| Lista do que não saiu | `Contas Receber → Relatórios → Sobre Pedidos → Pedidos Pendentes`, com filtro de período e check "Somente Pendentes" |
| Saber se foi impresso | A pesquisa de lançamentos tem filtro "Somente Não Impressos" — o estado é gravado |
| Endereço do cliente | Cadastro: rua, nº, bairro, cidade, CEP, telefone |
| Endereço avulso | Campo `Entregar em`, na aba "Outras Informações" do pedido |
| Prazo | Campos `Prazo de Entrega` e `Validade Orçamento` |
| Entrega parcial | O pedido já separa "Itens a Enviar" de "Itens Enviados ou Baixados" |
| Saída de dados | O relatório exporta em **Excel** e em PDF |

O ERP **não tem API** e só é alcançável por desktop remoto. Então a ponte é o arquivo
exportado, não integração.

Do lado do Ubadesklimp, reaproveitamos do módulo Ponto: aparelho de celular aprovado
pelo gestor, PIN de 4 dígitos que identifica a pessoa, e PWA que funciona sem sinal.

## Decisões

### 1. A entrada é o Excel de Pedidos Pendentes

Uma vez por dia alguém exporta o relatório e sobe o arquivo no Ubadesklimp. O sistema
casa pelo número do documento: subir o mesmo arquivo duas vezes não duplica, e pedido já
entregue continua entregue.

Ninguém muda de rotina, fora o upload.

**Por que não integração automática:** não existe API, e o ERP roda dentro de um canvas
de desktop remoto. Qualquer automação seria robô clicando em tela — frágil e quebra na
primeira atualização do ERP.

### 2. Rota por ordem de bairro, não por mapa

Os bairros de Ubatuba ficam numa ordem geográfica fixa, do extremo norte (Picinguaba,
Camburi, Ubatumirim) pelo centro (Itaguá, Centro, Perequê-Açu) até o sul (Toninhas,
Praia Grande, Maranduba, Sapê). As entregas se agrupam por bairro e seguem essa ordem.

Um botão **"Começar pelo fim"** inverte a rota inteira. Qualquer parada pode ser
arrastada.

**Por que não Google Routes / Mapbox:**

- Numa cidade que é uma linha, a ordem geográfica já é quase a rota ótima.
- Inverter é a operação que o dono mais usa (temporada entope o sul, então convém bater
  no extremo primeiro e voltar fazendo). Num otimizador isso não existe como conceito —
  ele devolve a rota que achar melhor e não aceita "faz ao contrário".
- Metade dos endereços é texto livre (`LOCAL NA DESCRIÇÃO DA NOTA`) e não geocodifica.
  O mapa falharia exatamente onde é mais necessário.
- Custa por consulta, todo dia, pra reproduzir o que a geografia dá de graça.

O gancho fica aberto: se a rota ficar densa demais, liga-se a otimização sem refazer o
modelo.

### 3. A confirmação nasce na parada, não na volta

O Henrique tem celular com internet. Na porta do cliente ele abre a lista e marca.
O registro grava **hora e localização no momento do toque**.

**Por que não marcar na volta:** era a preferência inicial do dono, mas briga com o que
ele quer verificar. "Entregue" marcado às 18h no balcão não distingue entrega feita de
mercadoria escondida no carro. Pra o registro significar alguma coisa, ele precisa
nascer onde e quando o fato aconteceu — o mesmo raciocínio do Ponto, onde a batida vale
por estar presa a uma rede e um horário.

### 4. Localização é pontual e declarada

Grava-se o ponto **só no instante do toque**. Não há acompanhamento de trajeto: o sistema
não sabe por onde ele passou nem onde almoçou.

A tela dele diz isso, em texto. Além de ser o certo, é o que faz funcionar — controle que
a pessoa desconhece não muda comportamento, só serve pra pegá-la depois.

## Como fica

### Importar

Tela de upload. Lê o Excel, mostra o que vai criar e o que já existe, e confirma. Cada
linha de pedido vira uma **entrega** com: número do documento, cliente, telefone, itens,
valor, e o endereço — vindo do cadastro do cliente ou do campo `Entregar em` quando for
texto livre.

Entrega nasce em `na_fila`.

### Montar a rota do dia

Tela na loja. Os pendentes agrupados por bairro, na ordem geográfica. O que **não foi
entregue em dias anteriores aparece no topo**, com o motivo e a contagem de tentativas —
é dívida, e é justamente o que hoje se perde.

Botão "Começar pelo fim" inverte. Arrastar reordena. Confirmar fecha a rota do dia e ela
aparece no celular do Henrique.

### A tela do Henrique

Entra com PIN de 4 dígitos no aparelho aprovado. Vê as paradas na ordem. Cada parada traz
cliente, endereço, itens e botão de ligar/WhatsApp.

Dois botões grandes:

- **Entreguei** → campo opcional "quem recebeu" (nome digitado; assinatura em nota
  costuma ser ilegível) → confirma
- **Não entreguei** → motivo: fechado, ninguém atendeu, endereço errado, cliente recusou,
  não coube no carro, outro (com campo livre)

Funciona sem sinal: guarda no aparelho e sobe quando a rede volta. Picinguaba e Maranduba
não podem travar o trabalho.

### A tela da loja

A rota do dia com o estado de cada parada, atualizando sozinha (realtime do Supabase).
Entrega feita mostra hora e local. Não entregue fica destacado com o motivo, na hora.

### O que não foi entregue

Volta pra fila com motivo, data da tentativa e contador. Na montagem do dia seguinte sobe
pro topo. Da terceira tentativa em diante fica marcado — é sinal de endereço errado ou
cliente que sumiu, e alguém precisa ligar em vez de mandar o carro de novo.

## Fora de escopo agora

Mapa com otimização de rota; foto da entrega; assinatura digital na tela; integração
automática com o ERP; roteirização por capacidade do veículo. Todos cabem depois sem
refazer o modelo.

## Em aberto

**As colunas do Excel.** A exportação não foi concluída no levantamento (rodei sem filtro
de período e a consulta travou; depois a sessão caiu). Falta confirmar se o relatório
Analítico traz, por linha: número do documento, cliente, endereço do cadastro, campo
`Entregar em`, itens com quantidade, e alguma marca de impresso.

**Plano B por coluna que faltar:**

| Se faltar | O que fazer |
|---|---|
| Endereço do cadastro | Importar a lista de clientes do ERP uma vez e casar por código do cliente |
| `Entregar em` | A entrega entra sem endereço e a tela da loja pede antes de montar a rota |
| Marca de impresso | Usar "pendente" como sinal; na prática a Marianna exporta depois de imprimir |
| Itens | A entrega vale pelo documento, e o Henrique confere pela nota impressa que já leva |

Nenhuma dessas falhas derruba a arquitetura — todas são ajuste de importação.

## Riscos

- **Ordem dos bairros.** Se estiver errada, a rota sai errada todo dia. O dono revisa a
  lista antes de entrar em uso.
- **GPS em condomínio fechado.** O ponto pode cair na portaria em vez da unidade. Serve
  pra confirmar que ele esteve no lugar, não pra auditar metro a metro — e a tela deve
  deixar isso claro, sob pena de virar acusação injusta.
- **Adesão.** Se marcar cada parada for chato, ele deixa pra marcar tudo na volta e o
  valor se perde. A tela tem que ser dois toques, não cinco.
