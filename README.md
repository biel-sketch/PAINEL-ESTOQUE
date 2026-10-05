# PAINEL-ESTOQUE

Painel de estoque de EPIs, uniformes e materiais do Grupo Login Serv, no mesmo padrão dos painéis RH e DP: um único `index.html` publicado no GitHub Pages, com login pelo Firebase Authentication e dados no Firebase Realtime Database (nó `painel-estoque`).

## Funcionalidades
- **Posição de estoque** por produto, tamanho e local, com saldo mínimo e exportação para Excel.
- **Movimentações**: entrada (NF, fornecedor e custo, com custo médio automático), ajuste e inventário, transferência entre locais e baixa.
- **Entregas de EPI**: kit sugerido pelo cargo, tamanho puxado do cadastro do empregado, bloqueio de saldo insuficiente, assinatura na tela e termo de recebimento (NR-6) para imprimir.
- **Devoluções**: o item volta ao estoque ou é descartado.
- **Empregados**: itens em posse, histórico e importação da planilha do RH.
- **Validade e CA**: trocas vencidas ou próximas (pela vida útil), CA vencido ou a vencer, estoque mínimo.
- **Relatórios**: consumo por período e por empresa, exportáveis para Excel.
- **Perfis**: Administrador, Almoxarife, Técnico de SST e Consulta, além de log de auditoria e backup.

## Como ativar o Firebase
1. Crie o projeto no Firebase Console e ative o **Authentication** (e-mail e senha) e o **Realtime Database**.
2. Copie a configuração do app Web para a variável `firebaseConfig` no início do script do `index.html`.
3. Publique as regras de `database.rules.json` em Realtime Database > Regras.
4. Crie os usuários no Authentication e cadastre cada um em `USER_ROLES` com o perfil.

Sem a configuração, o painel roda em **modo demonstração** (senha `demo`, dados só no navegador).

## Desenvolvimento
O código-fonte fica em `src/`. Rode `python3 build.py` para gerar o `index.html`.
