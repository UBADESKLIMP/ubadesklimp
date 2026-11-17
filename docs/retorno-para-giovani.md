Bom dia, Giovani!

Obrigado pelas respostas, ajudaram bastante. Antes de tudo, preciso explicar como nós usamos o sistema de vocês, porque isso muda a parte de infraestrutura, e acho que vocês não sabiam desse formato. Depois seguem os pontos que ainda precisamos fechar para você montar a proposta.

**1. Como o nosso ambiente funciona (importante)**
Nós usamos o JRS por meio da **Leantech**, que revende o sistema. Ele era instalado em servidor local, mas a nosso pedido a Leantech **transformou o nosso servidor em um servidor na nuvem**. Hoje a equipe acessa o ERP pelo navegador, em https://jrsweb2.leantechautomacao.com.br/.

Ou seja: o servidor **não fica na nossa loja e não é de vocês**. Quem administra a máquina, a rede, o domínio e o certificado é a Leantech. Por isso temos algumas perguntas:
- A API de vocês funciona nesse formato, com o servidor administrado por um terceiro (a Leantech)?
- O que vocês precisam da Leantech para instalar, atualizar e dar suporte à API (acesso remoto à máquina, liberar porta, domínio e certificado HTTPS)?
- Como seria o trabalho? Vocês instalam com o acesso que a Leantech liberar, ou nós intermediamos? Se for melhor, podemos marcar uma conversa entre vocês e a Leantech.
- Como a API ficaria acessível pela internet, com HTTPS (endereço e certificado)?
- A máquina é usada o dia todo pela equipe no ERP. Como evitar que as consultas da API deixem o sistema lento?

**2. Proposta separada em etapas**
Preferimos fechar por etapas, começando só pelo que é consulta. Pode nos passar **valor e prazo de cada uma**?
- **Etapa 1 (somente consulta):** produtos, estoque, entregas (pedidos marcados para entrega, com número, cliente, telefone, endereço, bairro e itens) e vendas.
- **Etapa 2 (somente consulta):** clientes, fornecedores e compras.
- **Etapa 3 (escrita):** pedido feito no nosso site virando pedido no ERP, e baixa da entrega concluída.

Se a Etapa 1 puder ser entregue antes das outras, melhor.

**3. Aviso automático (webhook)**
Entendido: vamos usar **consulta de tempos em tempos (polling)**. Não precisamos de webhook nem de RabbitMQ, então podemos tirar isso da proposta para não aumentar custo e prazo.

**4. Consultar só o que mudou**
Para o polling ficar leve para o ERP, os endpoints de consulta podem aceitar um filtro do tipo **"alterado desde tal data e hora"** (produtos, estoque, vendas e entregas), além de paginação? Assim a gente não puxa os 9.800 produtos toda vez.

**5. Código do produto**
Você disse que existe um ID único por tabela. O que usamos para ligar os dois sistemas é o **"Código" do produto que aparece no cadastro e nos relatórios do ERP**. Pode confirmar:
- qual é esse campo na base;
- que ele é **único e nunca muda**, nem é reaproveitado depois que o item é desativado;
- que a API devolve esse código, o código de barras e o ID interno.

**6. Chave de acesso**
Tudo bem ter uma chave só. Na Etapa 1 só vamos chamar endpoints de consulta, e a chamada é feita por um servidor nosso: a chave não fica visível no site. Pode confirmar:
- se a chave pode ter **validade ou ser trocada** quando quisermos;
- se os registros (logs) identificam quem fez cada chamada;
- se dá para **limitar o acesso por endereço de IP**.

**7. Limites e intervalo**
Qual intervalo de consulta vocês recomendam para o estoque (nossa ideia é a cada 10 minutos)? Existe algum horário de pico em que seja melhor evitar?

**8. Ambiente de testes**
Onde ficaria o ambiente de homologação com o Swagger? Como o nosso ERP é na nuvem da Leantech, a base de teste ficaria na mesma máquina, em outra máquina da Leantech, ou em um ambiente de vocês?

**9. Nada na loja**
Confirmando: a API **não exige instalar nada nos computadores da loja**, certo?

**10. Dados pessoais**
A API vai transportar nome, telefone e endereço de clientes (dados pessoais). Pode nos informar como fica o tratamento desses dados do lado de vocês (acesso restrito, registro de quem consultou)? Entendemos que a parte do servidor e do HTTPS depende também da Leantech, e vamos alinhar com eles.

**Do nosso lado, já está combinado:**
- As chamadas são feitas por um servidor nosso, e nenhuma chave aparece no site.
- Se o ERP ficar fora do ar, o nosso sistema continua funcionando com o último dado recebido.

Assim que tivermos o valor e o prazo de cada etapa, avaliamos e respondemos.

Obrigado!

João
joaovftoledo1@gmail.com
