// =====================================================================
// IMPORTAÇÃO DE PRODUTOS / EPIs POR PLANILHA
// Uma linha por produto ou por produto + tamanho. Se tiver quantidade,
// pode lançar como saldo inicial. CA sem validade é completado pela base CAEPI.
// =====================================================================
var importMode = 'empregados', importProds = [];

formHandlers['importar-produtos'] = function(){
  if(!can('produtos')) return;
  openModal('<div class="modal-title">Importar produtos / EPIs</div>' +
    '<div class="modal-sub">Use uma planilha do Excel (ou CSV) com uma linha por produto. Se o produto tiver tamanhos, pode usar uma linha por tamanho, com a quantidade de cada um.</div>' +
    '<table class="items-table"><thead><tr><th>Coluna</th><th>Obrigatória</th><th>Exemplo</th></tr></thead><tbody>' +
    [['Produto','Sim','BOTA BICO DE AÇO'],['CA','Não','28511'],['Validade CA','Não','25/11/2029 (se vazio, busca na base oficial pelo CA)'],['Categoria','Não','EPI, Uniforme ou Material (padrão: EPI)'],
     ['Grupo','Não','Luvas, Calçados, Uniforme (usado nas compras)'],['Fabricante','Não','MARLUVAS'],['Vida útil','Não','6 meses, 1 ano ou 180 (dias)'],['Tamanho','Não','40'],['Quantidade','Não','12 (vira saldo inicial, se você marcar)'],
     ['Unidade','Não','UN, PAR, CX...'],['Estoque mínimo','Não','10'],['Custo','Não','45,90']]
    .map(function(r){ return '<tr><td><b>'+r[0]+'</b></td><td>'+r[1]+'</td><td style="color:var(--text-dim)">'+esc(r[2])+'</td></tr>'; }).join('') + '</tbody></table>' +
    '<div class="modal-sub" style="margin-top:10px">Produtos que já existem (mesmo nome) são atualizados; os novos são criados. Nada é gravado antes da conferência.</div>' +
    '<div class="modal-actions"><button class="btn" data-act="modelo-produtos" style="margin-right:auto">Baixar planilha modelo</button><button class="btn btn-ghost" data-act="fechar">Cancelar</button><button class="btn btn-primary" data-act="escolher-planilha-produtos">Escolher planilha</button></div>', 'wide');
};
formHandlers['escolher-planilha-produtos'] = function(){ importMode = 'produtos'; $('#file-import').value = ''; $('#file-import').click(); };
formHandlers['modelo-produtos'] = function(){
  exportXlsx('modelo-produtos', [
    {'Produto':'BOTA BICO DE AÇO', 'CA':'28511', 'Validade CA':'', 'Categoria':'EPI', 'Grupo':'Calçados', 'Fabricante':'', 'Vida útil':'1 ano', 'Tamanho':'40', 'Quantidade':6, 'Unidade':'PAR', 'Estoque mínimo':10, 'Custo':''},
    {'Produto':'BOTA BICO DE AÇO', 'CA':'28511', 'Validade CA':'', 'Categoria':'EPI', 'Grupo':'Calçados', 'Fabricante':'', 'Vida útil':'1 ano', 'Tamanho':'42', 'Quantidade':4, 'Unidade':'PAR', 'Estoque mínimo':'', 'Custo':''},
    {'Produto':'MASCARA PROTECAO PFF2', 'CA':'46677', 'Validade CA':'', 'Categoria':'EPI', 'Grupo':'Proteção respiratória', 'Fabricante':'', 'Vida útil':'15 dias', 'Tamanho':'', 'Quantidade':124, 'Unidade':'UN', 'Estoque mínimo':50, 'Custo':'2,50'},
    {'Produto':'CALCA OPERACIONAL PRETA', 'CA':'', 'Validade CA':'', 'Categoria':'Uniforme', 'Grupo':'Uniforme', 'Fabricante':'', 'Vida útil':'6 meses', 'Tamanho':'M', 'Quantidade':35, 'Unidade':'UN', 'Estoque mínimo':'', 'Custo':''}
  ]);
};

function parseVidaUtil(v){
  var s = norm(String(v || '')); if(!s) return 0;
  var n = parseFloat(s.replace(',', '.')); if(isNaN(n)) return 0;
  if(/ano/.test(s)) return Math.round(n * 365);
  if(/mes/.test(s)) return Math.round(n * 30);
  if(/sem/.test(s)) return Math.round(n * 7);
  return Math.round(n);
}
function parseCategoria(v, temCA){
  var s = norm(v);
  if(/unif|farda|roupa/.test(s)) return 'Uniforme';
  if(/mater|consum|ferram/.test(s)) return 'Material';
  return 'EPI';
}

function previewImportProdutos(rows){
  var grupos = {}, ordem = [], linhas = 0;
  rows.forEach(function(r){
    var nome = String(pick(r, ['produto','nome','descricao','descricao do produto','nome do produto','item','epi','material'])).trim();
    if(!nome) return;
    linhas++;
    var k = norm(nome);
    var g = grupos[k];
    if(!g){ g = grupos[k] = {nome:nome, tamanhos:[], saldo:{}, qtdTotal:0, casMap:{}, casOrdem:[]}; ordem.push(k); }
    function setIf(campo, v){ if((g[campo] == null || g[campo] === '') && v !== '' && v != null) g[campo] = v; }
    var ca = String(pick(r, ['ca','n ca','no ca','n. ca','nº ca','n° ca','numero ca','numero do ca','certificado de aprovacao'])).replace(/\D/g, '');
    var valR = toIso(pick(r, ['validade ca','validade do ca','vencimento ca','vencimento do ca','validade']));
    var cat = pick(r, ['categoria','tipo']); if(cat !== '') setIf('categoria', parseCategoria(cat));
    var grp = String(pick(r, ['grupo','subgrupo','familia','linha'])).trim(); if(grp){ setIf('grupo', grp); if(cat === '') setIf('categoria', parseCategoria(grp)); }
    setIf('fabricante', String(pick(r, ['fabricante','marca'])).trim());
    var vu = parseVidaUtil(pick(r, ['vida util','vida util (dias)','vida util dias','periodicidade de troca','troca','periodicidade'])); if(vu) setIf('vidaUtilDias', vu);
    var un = String(pick(r, ['unidade','un','und','unid'])).trim().toUpperCase(); if(un) setIf('unidade', un);
    var mn = pick(r, ['estoque minimo','minimo','est minimo','estoque min']); if(mn !== '') setIf('estoqueMinimo', Math.floor(num(mn)));
    var cu = pick(r, ['custo','custo unitario','preco','preco unitario','valor unitario','valor']); if(cu !== '' && num(cu) > 0) setIf('custo', Math.round(num(cu) * 100) / 100);
    var tam = String(pick(r, ['tamanho','tam','grade','numeracao','numero'])).trim();
    var tk = tamKey(tam);
    if(tam && g.tamanhos.indexOf(tk) === -1) g.tamanhos.push(tk);
    // cada linha pode ter seu CA: o tamanho da linha fica ligado a ele
    if(ca){
      var cm = g.casMap[ca]; if(!cm){ cm = g.casMap[ca] = {ca:ca, validade:'', tamanhos:[], todos:false}; g.casOrdem.push(ca); }
      if(valR && !cm.validade) cm.validade = valR;
      if(tam){ if(cm.tamanhos.indexOf(tk) === -1) cm.tamanhos.push(tk); } else cm.todos = true;
    }
    var q = pick(r, ['quantidade','qtd','qtde','quant','saldo','estoque','saldo atual']);
    if(q !== '' && num(q) > 0){ var qi = Math.floor(num(q)); g.saldo[tk] = (g.saldo[tk] || 0) + qi; g.qtdTotal += qi; }
  });
  importProds = ordem.map(function(k){
    var g = grupos[k];
    g.cas = g.casOrdem.map(function(n){ var c = g.casMap[n]; return {ca:n, validade:c.validade, situacao:'', verificadoEm:'', tamanhos: g.casOrdem.length > 1 && !c.todos ? c.tamanhos : []}; });
    // tamanhos que aparecem em dois CAs: fica no primeiro
    var visto = {}; g.cas.forEach(function(c){ c.tamanhos = c.tamanhos.filter(function(t){ if(visto[t]) return false; visto[t] = 1; return true; }); });
    if(g.cas.length > 1 && !g.cas.some(function(c){ return !c.tamanhos.length; })){ var sobra = g.tamanhos.filter(function(t){ return !visto[t]; }); if(sobra.length) g.cas[0].tamanhos = g.cas[0].tamanhos.concat(sobra); }
    delete g.casMap; delete g.casOrdem;
    var ex = vals(DB.produtos).find(function(p){ return norm(p.nome) === k; });
    g.existenteId = ex ? ex._id : null;
    if(!g.categoria) g.categoria = ex ? ex.categoria : 'EPI';
    return g;
  });
  if(!importProds.length){ toast('Nenhuma linha com a coluna "Produto" (ou "Nome") encontrada.', 'err'); return; }

  // completa validade/fabricante pela base oficial de CAs
  var semValidade = [];
  importProds.forEach(function(g){ g.cas.forEach(function(c){ if(!c.validade) semValidade.push({g:g, c:c}); }); });
  openModal('<div class="modal-title">Importar produtos / EPIs</div><div class="modal-sub">Lendo a planilha'+(semValidade.length ? ' e consultando ' + semValidade.length + ' CA(s) na base oficial' : '')+'...</div>', 'wide');
  Promise.all(semValidade.map(function(x){
    var g = x.g, c = x.c;
    return consultaCA(c.ca).then(function(rec){ if(rec){ c.validade = rec.v || ''; c.situacao = rec.s || ''; c.verificadoEm = today(); if(!g.fabricante && rec.f) g.fabricante = rec.f; g.caAuto = (g.caAuto || 0) + 1; } }).catch(function(){});
  })).then(function(){ mostrarPreviewProdutos(linhas); });
}

function mostrarPreviewProdutos(linhas){
  var novos = importProds.filter(function(g){ return !g.existenteId; }).length, atual = importProds.length - novos;
  var unid = importProds.reduce(function(s, g){ return s + g.qtdTotal; }, 0), auto = importProds.reduce(function(s, g){ return s + (g.caAuto || 0); }, 0);
  var temSaldo = unid > 0;
  openModal('<div class="modal-title">Importar produtos / EPIs</div><div class="modal-sub">'+linhas+' linhas lidas · '+importProds.length+' produtos · '+novos+' novos · '+atual+' já cadastrados (serão atualizados)'+(auto ? ' · ' + auto + ' validade(s) de CA preenchida(s) pela base oficial' : '')+'</div>' +
    '<div class="table-wrap" style="max-height:340px;overflow:auto"><table class="items-table"><thead><tr><th>Produto</th><th>Categoria</th><th>CA</th><th>Validade CA</th><th>Vida útil</th><th>Tamanhos / quantidade</th></tr></thead><tbody>' +
    importProds.slice(0, 300).map(function(g){
      var tams = Object.keys(g.saldo).length ? Object.keys(g.saldo).map(function(t){ return '<span class="chip">'+esc(t === 'UN' ? 'UN' : t)+' <b>'+g.saldo[t]+'</b></span>'; }).join('') : g.tamanhos.map(function(t){ return '<span class="chip">'+esc(t)+'</span>'; }).join('');
      return '<tr><td>'+esc(g.nome)+(g.existenteId ? ' <span class="pill gray" style="padding:0 6px;font-size:10px">atualizar</span>' : ' <span class="pill teal" style="padding:0 6px;font-size:10px">novo</span>')+'</td><td>'+esc(g.categoria)+'</td>' +
        '<td class="mono">'+(g.cas.length ? g.cas.map(function(c){ return '<div>'+esc(c.ca)+(c.tamanhos.length ? ' <span style="color:var(--text-faint)">'+esc(c.tamanhos.join(', '))+'</span>' : '')+'</div>'; }).join('') : '—')+'</td><td class="mono">'+(g.cas.map(function(c){ return '<div>'+fmtD(c.validade)+'</div>'; }).join('') || '—')+(g.caAuto ? ' <span class="pill blue" style="padding:0 6px;font-size:10px">base oficial</span>' : '')+'</td><td>'+vidaUtilTxt(g.vidaUtilDias)+'</td><td><div class="chips">'+(tams || '—')+'</div></td></tr>';
    }).join('') + '</tbody></table></div>' +
    (temSaldo ? '<div class="action-box"><label class="modal-check" style="margin-top:0"><input type="checkbox" id="ip-saldo" checked> Lançar as quantidades da planilha como <b>saldo inicial</b> ('+fmtN(unid)+' unidades)</label>' +
      '<div class="modal-grid" style="margin-top:8px">' + field('No local de estoque', '<select id="ip-loc">'+optList(locaisOpts(), defaultLocal(), locaisAtivos().length ? null : 'Cadastre um local em Cadastros')+'</select>') + '</div>' +
      '<div class="hint" style="color:var(--amber);margin-top:6px">Use só na primeira carga: importar a mesma planilha de novo soma as quantidades outra vez.</div></div>' : '') +
    modalActions('Importar ' + importProds.length + ' produto(s)', 'confirmar-import-produtos'), 'wide');
}

formHandlers['confirmar-import-produtos'] = function(btn){
  var lancar = $('#ip-saldo') && $('#ip-saldo').checked, loc = lancar ? $('#ip-loc').value : '';
  if(lancar && !loc) return formError('Escolha o local de estoque (ou cadastre um em Cadastros → Locais).');
  var p = {}, ops = [], ids = {};
  importProds.forEach(function(g){
    var id = g.existenteId || store.key(); ids[g.nome] = id;
    var base = g.existenteId ? Object.assign({}, DB.produtos[id]) : {categoria:'EPI', unidade:'UN', ativo:true, estoqueMinimo:0, custo:0, vidaUtilDias:0, criadoEm:nowTs()};
    delete base._id;
    var rec = Object.assign(base, {nome: g.existenteId ? base.nome : g.nome, categoria: g.categoria || base.categoria, atualizadoEm: nowTs()});
    ['fabricante','grupo','vidaUtilDias','unidade','estoqueMinimo','custo'].forEach(function(f){ if(g[f] !== undefined && g[f] !== '') rec[f] = g[f]; });
    var tams = (base.tamanhos || []).map(tamKey);
    g.tamanhos.forEach(function(t){ if(t !== 'UN' && tams.indexOf(t) === -1) tams.push(t); });
    rec.tamanhos = tams;
    if(g.cas.length){ rec.cas = g.cas.map(function(c){ return {ca:c.ca, validade:c.validade || '', situacao:c.situacao || '', verificadoEm:c.verificadoEm || '', tamanhos:c.tamanhos}; }); espelharCAs(rec); }
    p['produtos/' + id] = rec;
    if(lancar) Object.keys(g.saldo).forEach(function(t){ ops.push({pid:id, tk:t, loc:loc, delta:g.saldo[t]}); });
  });
  busy(btn, true);
  save(p, 'Importação de produtos', importProds.length + ' produto(s)').then(function(){
    if(!ops.length) return;
    return applyStock(ops).then(function(){
      var m = {};
      ops.forEach(function(o){ m['movimentos/' + store.key()] = movRecord({tipo:'carga_inicial', pid:o.pid, tk:o.tk, loc:o.loc, qtd:o.delta, obs:'Saldo inicial importado de planilha'}); });
      return save(m, 'Saldo inicial importado', fmtN(ops.reduce(function(s, o){ return s + o.delta; }, 0)) + ' unidades');
    });
  }).then(function(){
    closeModal(); toast(importProds.length + ' produto(s) importado(s)' + (ops.length ? ' com saldo inicial.' : '.'));
  }).catch(function(e){ busy(btn, false); formError(e.message); });
};
