// =====================================================================
// IMPORTAÇÃO DO HISTÓRICO DE COMPRAS (compras já feitas no ano)
// Uma linha por item comprado. Linhas com o mesmo nº de pedido (ou NF)
// viram uma compra só. Entram como "Recebidas" e NÃO mexem no saldo.
// =====================================================================
var importCompras = [];

formHandlers['importar-compras'] = function(){
  if(!can('comprar')) return;
  openModal('<div class="modal-title">Importar compras já realizadas</div>' +
    '<div class="modal-sub">Uma linha por item comprado. Linhas com o mesmo nº de pedido (ou de nota fiscal) viram uma compra só. As compras entram como <b>recebidas</b> e <b>não alteram o saldo do estoque</b> (o saldo atual vem da importação de produtos).</div>' +
    '<table class="items-table"><thead><tr><th>Coluna</th><th>Obrigatória</th><th>Exemplo</th></tr></thead><tbody>' +
    [['Data','Sim','15/03/2026'],['Item','Sim','LUVA NITRÍLICA'],['Quantidade','Sim','50'],['Valor unitário ou Valor total','Sim','10,50 / 525,00'],['Fornecedor','Sim','DISTRIBUIDORA X'],
     ['Grupo','Não','EPI, Uniforme, Material de limpeza...'],['Pedido','Não','OC-123 (agrupa os itens da mesma compra)'],['NF','Não','5521'],['Centro / unidade','Não','LINS (cliente ou empresa)'],
     ['Prazo de pagamento','Não','28 dias'],['Data de entrega','Não','20/03/2026'],['Cotação 2 / Valor cotação 2','Não','FORNECEDOR Y / 610,00 (total)'],['Cotação 3 / Valor cotação 3','Não','FORNECEDOR Z / 580,00 (total)'],['Unidade','Não','UN, PAR, CX...']]
    .map(function(r){ return '<tr><td><b>'+r[0]+'</b></td><td>'+r[1]+'</td><td style="color:var(--text-dim)">'+esc(r[2])+'</td></tr>'; }).join('') + '</tbody></table>' +
    '<div class="modal-sub" style="margin-top:10px">Com as colunas de cotação 2 e 3 o painel calcula a economia de cada compra. Importar a mesma planilha de novo não duplica: compras já importadas são ignoradas.</div>' +
    '<div class="modal-actions"><button class="btn" data-act="modelo-compras" style="margin-right:auto">Baixar planilha modelo</button><button class="btn btn-ghost" data-act="fechar">Cancelar</button><button class="btn btn-primary" data-act="escolher-planilha-compras">Escolher planilha</button></div>', 'wide');
};
formHandlers['escolher-planilha-compras'] = function(){ importMode = 'compras'; $('#file-import').value = ''; $('#file-import').click(); };
formHandlers['modelo-compras'] = function(){
  exportXlsx('modelo-compras', [
    {'Data':'15/03/2026', 'Pedido':'OC-101', 'NF':'5521', 'Grupo':'EPI', 'Item':'LUVA NITRILICA SEM FORRO', 'Quantidade':50, 'Unidade':'PAR', 'Valor unitário':'10,50', 'Valor total':'', 'Fornecedor':'DISTRIBUIDORA X', 'Centro / unidade':'LINS', 'Prazo de pagamento':'28 dias', 'Data de entrega':'20/03/2026', 'Cotação 2':'FORNECEDOR Y', 'Valor cotação 2':'610,00', 'Cotação 3':'FORNECEDOR Z', 'Valor cotação 3':'580,00'},
    {'Data':'15/03/2026', 'Pedido':'OC-101', 'NF':'5521', 'Grupo':'EPI', 'Item':'MASCARA PROTECAO PFF2', 'Quantidade':20, 'Unidade':'UN', 'Valor unitário':'', 'Valor total':'50,00', 'Fornecedor':'DISTRIBUIDORA X', 'Centro / unidade':'LINS', 'Prazo de pagamento':'28 dias', 'Data de entrega':'20/03/2026', 'Cotação 2':'', 'Valor cotação 2':'', 'Cotação 3':'', 'Valor cotação 3':''},
    {'Data':'02/04/2026', 'Pedido':'OC-118', 'NF':'', 'Grupo':'Uniforme', 'Item':'CALCA OPERACIONAL PRETA', 'Quantidade':40, 'Unidade':'UN', 'Valor unitário':'45,00', 'Valor total':'', 'Fornecedor':'CONFECCOES W', 'Centro / unidade':'FEMSA MARILIA', 'Prazo de pagamento':'30/60', 'Data de entrega':'', 'Cotação 2':'', 'Valor cotação 2':'', 'Cotação 3':'', 'Valor cotação 3':''}
  ]);
};

function previewImportCompras(rows){
  var grupos = {}, ordem = [], linhas = 0, erros = [];
  rows.forEach(function(r, n){
    var item = String(pick(r, ['item','produto','descricao','descricao do item','material'])).trim();
    if(!item) return;
    linhas++;
    var data = toIso(pick(r, ['data','data compra','data da compra','data pedido','data do pedido','emissao','data emissao']));
    var forn = String(pick(r, ['fornecedor','fornecedor escolhido','razao social fornecedor'])).trim();
    var qtd = num(pick(r, ['quantidade','qtd','qtde','quant']));
    var unit = num(pick(r, ['valor unitario','preco unitario','vl unitario','vlr unitario','unitario','valor unit','preco']));
    var tot = num(pick(r, ['valor total','total','vl total','vlr total','valor']));
    if(!unit && tot && qtd) unit = Math.round(tot / qtd * 10000) / 10000;
    if(!data || !forn || !(qtd > 0) || !(unit > 0)){ if(erros.length < 8) erros.push('Linha ' + (n + 2) + ' (' + item + '): falta ' + [!data && 'data', !forn && 'fornecedor', !(qtd > 0) && 'quantidade', !(unit > 0) && 'valor'].filter(Boolean).join(', ')); return; }
    var pedido = String(pick(r, ['pedido','n pedido','nº pedido','numero pedido','numero do pedido','oc','ordem de compra','solicitacao','n solicitacao'])).trim();
    var nf = String(pick(r, ['nf','nota fiscal','n nf','nº nf','numero nf','nota'])).trim();
    var grupo = String(pick(r, ['grupo','categoria','tipo','grupo de compra'])).trim();
    var chave = norm(pedido ? 'p:' + pedido : nf ? 'n:' + nf + '|' + forn : 'd:' + data + '|' + forn + '|' + grupo);
    var g = grupos[chave];
    if(!g){ g = grupos[chave] = {chave:chave, data:data, pedido:pedido, nf:nf, fornecedor:forn, grupo:grupo, itens:[], precos:[], cot2:{}, cot3:{}}; ordem.push(chave); }
    function setIf(o, k, v){ if(!o[k] && v) o[k] = v; }
    setIf(g, 'grupo', grupo); setIf(g, 'nf', nf);
    setIf(g, 'centro', String(pick(r, ['centro / unidade','centro/unidade','centro','centro de custo','cliente','posto','local'])).trim());
    setIf(g, 'prazoPgto', String(pick(r, ['prazo de pagamento','prazo pagamento','condicao de pagamento','cond pagamento','pagamento'])).trim());
    setIf(g, 'entrega', toIso(pick(r, ['data de entrega','data entrega','recebido em','data recebimento','data de recebimento','entrega'])));
    setIf(g, 'solicitante', String(pick(r, ['solicitante','solicitado por'])).trim());
    setIf(g, 'aprovadoPor', String(pick(r, ['aprovado por','aprovador'])).trim());
    setIf(g.cot2, 'fornecedor', String(pick(r, ['cotacao 2','fornecedor 2','cotacao 2 fornecedor','fornecedor cotacao 2'])).trim());
    setIf(g.cot2, 'total', num(pick(r, ['valor cotacao 2','cotacao 2 valor','valor 2','total cotacao 2'])));
    setIf(g.cot3, 'fornecedor', String(pick(r, ['cotacao 3','fornecedor 3','cotacao 3 fornecedor','fornecedor cotacao 3'])).trim());
    setIf(g.cot3, 'total', num(pick(r, ['valor cotacao 3','cotacao 3 valor','valor 3','total cotacao 3'])));
    var pid = findProdByLabel(item) || '';
    g.itens.push({item: pid ? DB.produtos[pid].nome : item, pid: pid, qtd: qtd, unidade: String(pick(r, ['unidade','un','und','unid','unidade de medida'])).trim().toUpperCase() || (pid ? DB.produtos[pid].unidade || 'UN' : 'UN'), tk: String(pick(r, ['tamanho','tam'])).trim().toUpperCase()});
    g.precos.push(unit);
    if(!g.grupo && pid) g.grupo = DB.produtos[pid].grupo || DB.produtos[pid].categoria || '';
  });
  var jaTem = {}; vals(DB.compras).forEach(function(c){ if(c.importChave) jaTem[c.importChave] = 1; });
  importCompras = ordem.map(function(k){ var g = grupos[k]; g.total = g.itens.reduce(function(s, it, j){ return s + it.qtd * g.precos[j]; }, 0); g.duplicada = !!jaTem[k]; return g; })
    .sort(function(a, b){ return a.data < b.data ? -1 : 1; });
  var novas = importCompras.filter(function(g){ return !g.duplicada; });
  if(!importCompras.length){ toast(erros.length ? erros[0] : 'Nenhuma linha com Item encontrada.', 'err'); return; }
  var porGrupo = {}; novas.forEach(function(g){ var n = g.grupo || 'Sem grupo'; porGrupo[n] = (porGrupo[n] || 0) + g.total; });
  var totalNovas = novas.reduce(function(s, g){ return s + g.total; }, 0);
  openModal('<div class="modal-title">Importar compras já realizadas</div><div class="modal-sub">'+linhas+' linhas · '+importCompras.length+' compras · '+novas.length+' novas'+(importCompras.length - novas.length ? ' · ' + (importCompras.length - novas.length) + ' já importadas (serão ignoradas)' : '')+' · total '+fmtR(totalNovas)+'</div>' +
    (erros.length ? '<div class="perm-note" style="display:block">Linhas ignoradas por falta de dados:<br>'+erros.map(esc).join('<br>')+'</div>' : '') +
    '<div class="chips" style="margin-bottom:10px">'+Object.keys(porGrupo).sort().map(function(n){ return '<span class="chip">'+esc(n)+' <b>'+fmtR(porGrupo[n])+'</b></span>'; }).join('')+'</div>' +
    '<div class="table-wrap" style="max-height:330px;overflow:auto"><table class="items-table"><thead><tr><th>Data</th><th>Pedido / NF</th><th>Grupo</th><th>Itens</th><th>Fornecedor</th><th class="num">Total</th><th>Outras cotações</th></tr></thead><tbody>' +
    importCompras.slice(0, 300).map(function(g){
      return '<tr'+(g.duplicada ? ' style="opacity:.45"' : '')+'><td class="mono">'+fmtD(g.data)+'</td><td class="mono">'+esc(g.pedido || g.nf || '—')+'</td><td>'+esc(g.grupo || '—')+'</td>' +
        '<td style="font-size:12px">'+g.itens.slice(0, 3).map(function(it){ return esc(fmtN(it.qtd) + '× ' + it.item); }).join('<br>')+(g.itens.length > 3 ? '<br>+ ' + (g.itens.length - 3) : '')+'</td>' +
        '<td>'+esc(g.fornecedor)+'</td><td class="num">'+fmtR(g.total)+'</td><td style="font-size:12px">'+[g.cot2, g.cot3].filter(function(q){ return q.fornecedor && q.total; }).map(function(q){ return esc(q.fornecedor) + ' ' + fmtR(q.total); }).join('<br>')+(g.duplicada ? ' <span class="pill gray" style="padding:0 6px;font-size:10px">já importada</span>' : '')+'</td></tr>';
    }).join('') + '</tbody></table></div>' +
    modalActions('Importar ' + novas.length + ' compra(s)', 'confirmar-import-compras'), 'xwide');
}

function centroPorNome(nome, p){
  var k = norm(nome); if(!k) return '';
  var c = vals(DB.clientes).find(function(x){ return norm(x.nome) === k; }); if(c) return c._id;
  var e = vals(DB.empresas).find(function(x){ return norm(x.nome) === k; }); if(e) return e._id;
  var id = cliKey(nome); p['clientes/' + id + '/nome'] = nome; return id;
}
formHandlers['confirmar-import-compras'] = function(btn){
  var novas = importCompras.filter(function(g){ return !g.duplicada; });
  if(!novas.length){ closeModal(); toast('Nada novo para importar.'); return; }
  busy(btn, true);
  var n0 = 0;
  store.txn('config/seqCompra', function(cur){ n0 = +cur || 0; return n0 + novas.length; }).then(function(r){
    var inicio = (+r.value || novas.length) - novas.length, p = {};
    novas.forEach(function(g, i){
      var id = store.key(), ts = new Date(g.data + 'T12:00:00').getTime();
      var cot = [{fornecedor:g.fornecedor, precos:g.precos, prazoPgto:g.prazoPgto || '', prazoEntrega:'', obs:''}];
      [g.cot2, g.cot3].forEach(function(q){ if(q.fornecedor && q.total > 0) cot.push({fornecedor:q.fornecedor, precos:[], totalInformado:q.total, prazoPgto:'', prazoEntrega:'', obs:''}); });
      p['compras/' + id] = {numero: inicio + i + 1, importada: true, importChave: g.chave, grupo: g.grupo || '', itens: g.itens, unidadeId: centroPorNome(g.centro, p),
        criadoEm: ts, solicitante: g.solicitante || 'Histórico', enviadoEm: ts, aprovadoEm: ts, aprovadoPor: g.aprovadoPor || '',
        cotacoes: cot, recomendada: 0, escolhida: 0, aprovacao: 'aprovada', compra: 'recebida', pedidoNumero: g.pedido || '', pedidoData: g.data,
        entregaPrevista: g.entrega || g.data, recebidoEm: g.entrega || g.data, nf: g.nf || '', entradaEstoque: false,
        historico: {h0: {ts: nowTs(), usuario: currentUser.name, acao: 'Importada do histórico de compras (' + fmtD(g.data) + ')'}}};
    });
    return save(p, 'Importação de compras', novas.length + ' compra(s)');
  }).then(function(){ closeModal(); cmpFiltro = 'todas'; toast(novas.length + ' compra(s) importada(s).'); renderCompras(); })
    .catch(function(e){ busy(btn, false); formError(e.message); });
};
