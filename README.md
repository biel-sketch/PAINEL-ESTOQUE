# PAINEL-ESTOQUE

Painel de estoque de EPIs, uniformes e materiais do Grupo Login Serv, no mesmo padrão dos painéis RH e DP: um único `index.html` publicado no GitHub Pages, com login pelo Firebase Authentication e dados no Firebase Realtime Database (nó `painel-estoque`).

## Menu
São 6 módulos com subabas no topo: **Início** · **Estoque** (Saldo, Movimentações, Produtos, CA e estoque mínimo) · **Entregas de EPI** (Entregas, Empregados, Trocas pendentes) · **Compras** · **Relatórios** · **Cadastros** (Clientes, Empresas, Cargos e kits, Locais, Sistema).

## Funcionalidades
- **Posição de estoque** por produto, tamanho e local, com saldo mínimo e exportação para Excel.
- **Importação de produtos/EPIs** por planilha (com modelo): cria ou atualiza produtos, junta tamanhos, completa a validade do CA pela base oficial e, opcionalmente, lança as quantidades como saldo inicial.
- **Movimentações**: entrada (NF, fornecedor e custo, com custo médio automático), ajuste e inventário, transferência entre locais e baixa.
- **Entregas de EPI**: kit sugerido pelo cargo, tamanho de calçado/calça/camisa/luva guardado a cada entrega e sugerido na próxima, bloqueio de saldo insuficiente e termo de recebimento (NR-6) impresso para assinatura.
- **Devoluções**: o item volta ao estoque ou é descartado.
- **Empregados**: itens em posse, histórico e importação da planilha do RH.
- **Validade e CA**: trocas vencidas ou próximas (pela vida útil), CA vencido ou a vencer, com o **valor parado em CA vencido** (saldo × custo médio) e o valor geral do estoque.
- **Reposição do estoque mínimo**: lista o que falta para voltar ao mínimo, desconta o que já está em compra e estima o valor; exporta para Excel e cria de uma vez uma solicitação de compra por grupo (**Comprar todos os faltantes**).
- **Vários CAs por produto**: cada CA cobre alguns tamanhos (ou os que sobram). Os tamanhos com CA vencido ficam em vermelho no saldo, o produto deixa de aparecer como OK e a entrega grava o CA do tamanho entregue. Na importação, cada linha pode ter seu CA.
- **Consulta automática de CA**: ao digitar o nº do CA, o painel busca validade, situação, fabricante e "aprovado para" na base oficial CAEPI do Ministério do Trabalho. A base é baixada todo dia pelo workflow `.github/workflows/atualizar-caepi.yml` e publicada em `ca/`.
- **Compras — cotação por grupo com mapa de cotação**: cada solicitação reúne os itens de um grupo; até 3 fornecedores cotam (cada um pode deixar itens sem preço); no **mapa de cotação** escolhe-se, item a item, de qual fornecedor comprar (o menor preço vem marcado; atalhos "Tudo da 1/2/3"). O comprador recomenda a seleção e o aprovador aprova (podendo ajustar, com comentário). Cada fornecedor escolhido gera seu pedido, sua entrega prevista e seu recebimento (com entrada no estoque e custo médio). Economia vs. maior preço cotado. Tela dividida por grupo.
- **Histórico de compras**: importação por planilha (com modelo) das compras já feitas — itens do mesmo pedido/NF viram uma compra, com até 3 cotações; entram como recebidas e não alteram o saldo; reimportar não duplica.
- **Clientes**: cadastro montado sozinho a partir do campo Cliente dos colaboradores (com divisão por empresa); renomear um cliente atualiza os colaboradores.
- **Relatórios**: consumo por período, por cliente e por empresa, exportáveis para Excel.
- **Perfis**: Administrador, Almoxarife, Técnico de SST, Comprador, Aprovador e Consulta, além de log de auditoria e backup.

## Como ativar o Firebase
1. Crie o projeto no Firebase Console e ative o **Authentication** (e-mail e senha) e o **Realtime Database**.
2. Copie a configuração do app Web para a variável `firebaseConfig` no início do script do `index.html`.
3. Publique as regras de `database.rules.json` em Realtime Database > Regras.
4. Crie os usuários no Authentication e cadastre cada um em `USER_ROLES` com o perfil.

Sem a configuração, o painel roda em **modo demonstração** (senha `demo`, dados só no navegador).

## Desenvolvimento
O código-fonte fica em `src/`. Rode `python3 build.py` para gerar o `index.html`.
