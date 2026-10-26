// =====================================================================
// COMPRAS — cotação POR GRUPO com MAPA DE COTAÇÃO
// Uma solicitação reúne os itens de um grupo (ex.: Uniformes). Até 3
// fornecedores cotam os itens. No mapa de cotação escolhe-se, ITEM A ITEM,
// de qual fornecedor comprar (pode misturar). O comprador recomenda a
// seleção e o aprovador aprova (podendo ajustar). Cada fornecedor escolhido
// gera o seu pedido e o seu recebimento.
// Fluxo: Em cotação → Aguardando aprovação → Aprovada → Pedido emitido → Recebida
// =====================================================================
var CMP_ETAPAS = [
  {id:'andamento', label:'Em andamento'},
  {id:'cotacao', label:'Em cotação'},
  {id:'aguardando', label:'Aguardando aprovação'},
  {id:'aprovada', label:'Aprovadas — emitir pedido'},
  {id:'pedido', label:'Pedido emitido'},
  {id:'recebida', label:'Recebidas'},
  {id:'encerradas', label:'Reprovadas / canceladas'},
  {id:'todas', label:'Todas'}
];
var cmpFiltro = 'andamento';
var PRAZOS_PGTO = ['À vista', '7 dias', '14 dias', '21 dias', '28 dias', '30 dias', '30/60', '30/60/90', '45 dias', '60 dias'];
var GRUPOS_PADRAO = ['EPI', 'Uniforme', 'Calçados', 'Material de limpeza', 'Descartáveis', 'Material de escritório', 'Ferramentas', 'Manutenção', 'Outros'];

function cmpEtapa(c){
  if(c.compra === 'cancelada') return 'cancelada';
  if(c.aprovacao === 'reprovada') return 'reprovada';
  if(c.compra === 'recebida') return 'recebida';
  if(c.compra === 'pedido') return 'pedido';
  if(c.aprovacao === 'aprovada') return 'aprovada';
  if(c.aprovacao === 'aguardando') return 'aguardando';
  return 'cotacao';
}
function cmpNumero(c){ return 'SC-' + String(c.numero || 0).padStart(4, '0'); }
function cmpGrupo(c){ return (c.grupo || '').trim() || 'Sem grupo'; }
function cmpItens(c){
  if(c.itens && c.itens.length) return c.itens.filter(Boolean);
  return c.item ? [{item:c.item, pid:c.pid || '', qtd:+c.qtd || 1, unidade:c.unidade || 'UN', tk:c.tk || ''}] : [];
}
function cmpQtdTotal(c){ return cmpItens(c).reduce(function(s, i){ return s + (+i.qtd || 0); }, 0); }
function cmpFoiAprovada(c){ return c.aprovacao === 'aprovada' || ['pedido','recebida'].indexOf(cmpEtapa(c)) !== -1; }

// Cotações válidas (fornecedor + pelo menos um preço, ou total informado nas importadas)
function cmpCotacoes(c){
  var itens = cmpItens(c);
  return [0, 1, 2].map(function(i){
    var q = (c.cotacoes || [])[i]; if(!q || !q.fornecedor) return null;
    var precos = (q.precos || (q.preco != null ? [q.preco] : [])).map(num);
    var cotados = itens.filter(function(it, j){ return precos[j] > 0; }).length;
    var completo = itens.length > 0 && cotados === itens.length;
    var soma = itens.reduce(function(s, it, j){ return s + (precos[j] > 0 ? precos[j] * (+it.qtd || 0) : 0); }, 0);
    var total = completo ? soma + num(q.frete) : (num(q.totalInformado) || 0);
    if(!cotados && !(total > 0)) return null;
    return {i:i, fornecedor:q.fornecedor, precos:precos, frete:num(q.frete), cotados:cotados, completo:completo, soma:soma, total:total,
            prazoPgto:q.prazoPgto || '', prazoEntrega:q.prazoEntrega === 0 ? 0 : (q.prazoEntrega || ''), obs:q.obs || ''};
  }).filter(Boolean);
}
// Seleção por item: índice da cotação escolhida para cada item (ou null)
function cmpSelecao(c){
  var n = cmpItens(c).length, fill = function(q){ return q == null ? null : Array.apply(null, Array(n)).map(function(){ return q; }); };
  if(cmpFoiAprovada(c)) return c.selecao ? c.selecao.slice() : fill(c.escolhida);
  if(c.recomendacao) return c.recomendacao.slice();
  if(c.recomendada != null) return fill(c.recomendada);
  if(c.aprovacao === 'aguardando' && c.escolhida != null) return fill(c.escolhida);
  return null;
}
function cmpMenorPorItem(c){
  var qs = cmpCotacoes(c);
  return cmpItens(c).map(function(it, j){
    var best = null; qs.forEach(function(q){ var p = q.precos[j]; if(p > 0 && (best == null || p < qs.find(function(x){ return x.i === best; }).precos[j])) best = q.i; });
    return best;
  });
}
function cmpCalc(c, selOverride){
  var itens = cmpItens(c), qs = cmpCotacoes(c), qById = {}; qs.forEach(function(q){ qById[q.i] = q; });
  var sel = selOverride || cmpSelecao(c);
  var minI = [], maxI = [];
  itens.forEach(function(it, j){ var ps = qs.map(function(q){ return q.precos[j]; }).filter(function(p){ return p > 0; }); minI[j] = ps.length ? Math.min.apply(null, ps) : 0; maxI[j] = ps.length ? Math.max.apply(null, ps) : 0; });
  var grupos = {}, faltando = [], naoMenor = false, econItem = 0;
  if(sel) itens.forEach(function(it, j){
    var q = qById[sel[j]], p = q ? q.precos[j] : 0;
    if(!(p > 0)){ if(q && q.total > 0 && !q.cotados){ (grupos[q.i] = grupos[q.i] || {i:q.i, q:q, itens:[], subtotal:0}).itens.push(j); } else faltando.push(j); return; }
    var g = grupos[q.i] = grupos[q.i] || {i:q.i, q:q, itens:[], subtotal:0};
    g.itens.push(j); g.subtotal += p * (+it.qtd || 0);
    if(p > minI[j] + 0.004) naoMenor = true;
    econItem += (maxI[j] - p) * (+it.qtd || 0);
  });
  var forn = Object.keys(grupos).map(function(k){ var g = grupos[k]; var semPreco = !g.q.cotados && g.q.total > 0; return {i:g.i, fornecedor:g.q.fornecedor, itens:g.itens, subtotal: semPreco ? g.q.total : g.subtotal + g.q.frete, frete:g.q.frete, prazoPgto:g.q.prazoPgto, prazoEntrega:g.q.prazoEntrega, precos:g.q.precos}; })
    .sort(function(a, b){ return b.itens.length - a.itens.length || a.i - b.i; });
  var total = forn.reduce(function(s, f){ return s + f.subtotal; }, 0);
  var tots = qs.filter(function(q){ return q.completo || (!q.cotados && q.total > 0); }).map(function(q){ return q.total; });
  var unico = forn.length === 1 && forn[0].itens.length === itens.length;
  var economia = 0;
  if(forn.length && !faltando.length){
    if(unico && tots.length >= 2) economia = Math.max.apply(null, tots) - total;   // tudo de um fornecedor: compara com a maior cotação
    else economia = econItem;                                                        // misto: soma por item (maior preço − escolhido)
  }
  economia = Math.max(0, Math.round(economia * 100) / 100);
  var completas = qs.filter(function(q){ return q.completo; });
  var menorI = completas.length ? completas.reduce(function(a, b){ return b.total < a.total ? b : a; }).i : null;
  return {itens:itens, qs:qs, sel:sel, fornecedores:forn, principal:forn[0] || null, total:total, economia:economia,
          economiaPct: total + economia > 0 ? economia / (total + economia) * 100 : 0, naoMenor:naoMenor, faltando:faltando,
          minPorItem:minI, maxPorItem:maxI, aprovada:cmpFoiAprovada(c), unico:unico, menorI:menorI,
          maior: tots.length ? Math.max.apply(null, tots) : 0, menor: tots.length ? Math.min.apply(null, tots) : 0};
}
function cmpPedidoDe(c, qi){
  if(c.pedidos && c.pedidos[qi]) return c.pedidos[qi];
  return {numero:c.pedidoNumero || '', data:c.pedidoData || '', entregaPrevista:c.entregaPrevista || '', recebidoEm: c.compra === 'recebida' ? c.recebidoEm : '', nf: c.compra === 'recebida' ? c.nf : ''};
}
function cmpAprovPill(c){
  var e = cmpEtapa(c), a = c.aprovacao || 'cotacao';
  if(e === 'cancelada' && a !== 'aprovada') return '<span class="pill gray">—</span>';
  return {cotacao:'<span class="pill gray">Em cotação</span>', aguardando:'<span class="pill amber">Aguardando</span>', aprovada:'<span class="pill teal">Aprovada</span>', reprovada:'<span class="pill red">Reprovada</span>'}[a] || '';
}
function cmpCompraPill(c){
  var e = cmpEtapa(c);
  if(e === 'cancelada') return '<span class="pill red">Cancelada</span>';
  if(e === 'recebida') return '<span class="pill teal">Recebida</span>';
  if(e === 'pedido'){
    var k = cmpCalc(c), rec = k.fornecedores.filter(function(f){ return cmpPedidoDe(c, f.i).recebidoEm; }).length;
    var d = daysUntil(c.entregaPrevista);
    if(rec && rec < k.fornecedores.length) return '<span class="pill blue">Recebida '+rec+'/'+k.fornecedores.length+'</span>';
    return d != null && d < 0 ? '<span class="pill red">Pedido atrasado</span>' : '<span class="pill blue">Pedido emitido</span>';
  }
  if(e === 'aprovada') return '<span class="pill amber">A comprar</span>';
  return '<span class="pill gray">Não iniciada</span>';
}
function cmpPodeEditarSolic(c){
  var e = c ? cmpEtapa(c) : 'cotacao';
  if(e !== 'cotacao' && e !== 'reprovada') return false;
  return can('comprar') || (can('solicitar') && (!c || c.solicitante === (currentUser || {}).name));
}
function comprasPendentesUsuario(){
  var n = 0;
  vals(DB.compras).forEach(function(c){ var e = cmpEtapa(c); if((e === 'aguardando' && can('aprovar')) || (e === 'aprovada' && can('comprar'))) n++; });
  return n;
}
function cmpGruposLista(){
  var s = {}; GRUPOS_PADRAO.forEach(function(g){ s[norm(g)] = g; });
  vals(DB.compras).forEach(function(c){ if(c.grupo) s[norm(c.grupo)] = s[norm(c.grupo)] || c.grupo; });
  vals(DB.produtos).forEach(function(p){ if(p.grupo) s[norm(p.grupo)] = s[norm(p.grupo)] || p.grupo; });
  return Object.keys(s).map(function(k){ return s[k]; }).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
}
function cmpFiltrar(){
  var q = norm(($('#cmp-busca') || {}).value), un = ($('#cmp-unidade') || {}).value, gr = ($('#cmp-grupo') || {}).value;
  return vals(DB.compras).filter(function(c){
    var e = cmpEtapa(c);
    if(cmpFiltro === 'andamento' && ['recebida','reprovada','cancelada'].indexOf(e) !== -1) return false;
    if(cmpFiltro === 'encerradas' && e !== 'reprovada' && e !== 'cancelada') return false;
    if(['cotacao','aguardando','aprovada','pedido','recebida'].indexOf(cmpFiltro) !== -1 && e !== cmpFiltro) return false;
    if(un && c.unidadeId !== un) return false;
    if(gr && norm(cmpGrupo(c)) !== norm(gr)) return false;
    if(q){ if(norm([cmpNumero(c), cmpGrupo(c), cmpItens(c).map(function(i){ return i.item; }).join(' '), c.solicitante, nomeCentro(c.unidadeId), (c.cotacoes || []).map(function(x){ return x && x.fornecedor; }).join(' '), c.pedidoNumero, c.nf].join(' ')).indexOf(q) === -1) return false; }
    return true;
  }).sort(function(a, b){ return (b.numero || 0) - (a.numero || 0); });
}

// =====================================================================
// TELA (agrupada por grupo de compra)
// =====================================================================
function renderCompras(){
  var all = vals(DB.compras), ini = today().slice(0, 8) + '01', iniAno = today().slice(0, 4) + '-01-01';
  var cont = {}; all.forEach(function(c){ var e = cmpEtapa(c); cont[e] = (cont[e] || 0) + 1; });
  var andamento = all.length - (cont.recebida || 0) - (cont.reprovada || 0) - (cont.cancelada || 0);
  var atrasados = all.filter(function(c){ return cmpEtapa(c) === 'pedido' && daysUntil(c.entregaPrevista) < 0; }).length;
  var econMes = 0, valorAno = 0, econAno = 0;
  all.forEach(function(c){
    if(!c.aprovadoEm || ['aprovada','pedido','recebida'].indexOf(cmpEtapa(c)) === -1) return;
    var k = cmpCalc(c), d = fmtISO(c.aprovadoEm);
    if(d >= ini) econMes += k.economia;
    if(d >= iniAno){ valorAno += k.total; econAno += k.economia; }
  });
  $('#cmp-stats').innerHTML =
    statCard('Em cotação', fmtN(cont.cotacao || 0), '', (cont.reprovada || 0) + ' reprovada(s)') +
    statCard('Aguardando aprovação', fmtN(cont.aguardando || 0), cont.aguardando ? 'amber' : '', can('aprovar') && cont.aguardando ? 'sua aprovação' : '') +
    statCard('Pedidos em aberto', fmtN((cont.aprovada || 0) + (cont.pedido || 0)), atrasados ? 'red' : '', atrasados ? atrasados + ' atrasado(s)' : (cont.aprovada || 0) + ' a emitir') +
    statCard('Comprado no ano', fmtR(valorAno), '', 'economia de ' + fmtR(econAno)) +
    statCard('Economia no mês', fmtR(econMes), econMes ? 'teal' : '', 'vs. maior preço cotado');
  var cnt = {andamento:andamento, encerradas:(cont.reprovada || 0) + (cont.cancelada || 0), todas:all.length};
  $('#cmp-etapas').innerHTML = CMP_ETAPAS.map(function(e){
    var n = cnt[e.id] != null ? cnt[e.id] : (cont[e.id] || 0);
    return '<span class="stage'+(cmpFiltro === e.id ? ' active' : '')+'" data-act="cmp-filtro" data-id="'+e.id+'">'+e.label+' <span class="n">'+n+'</span></span>';
  }).join('');
  var sg = $('#cmp-grupo'); if(sg){ var v = sg.value; sg.innerHTML = '<option value="">Todos os grupos</option>' + cmpGruposLista().filter(function(g){ return all.some(function(c){ return norm(cmpGrupo(c)) === norm(g); }); }).map(function(g){ return '<option>'+esc(g)+'</option>'; }).join(''); sg.value = v; }
  $$('.need-solicitar').forEach(function(b){ b.disabled = !can('solicitar'); });
  $$('.need-comprar').forEach(function(b){ b.disabled = !can('comprar'); });
  var list = cmpFiltrar();
  if(!list.length){ $('#cmp-table').innerHTML = emptyState(all.length ? 'Nenhuma solicitação nesta etapa.' : 'Nenhuma solicitação de compra ainda. Clique em "+ Nova solicitação" para começar, ou importe as compras já feitas.'); return; }
  var grupos = {}, ordem = [];
  list.forEach(function(c){ var g = cmpGrupo(c), k = norm(g); if(!grupos[k]){ grupos[k] = {nome:g, itens:[], total:0, econ:0}; ordem.push(k); } var kc = cmpCalc(c); grupos[k].itens.push(c); grupos[k].total += kc.total; grupos[k].econ += kc.economia; });
  ordem.sort(function(a, b){ return grupos[a].nome.localeCompare(grupos[b].nome, 'pt-BR'); });
  var head = '<tr><th>Solicitação</th><th>Itens</th><th class="num">Qtd</th><th>Centro / unidade</th><th>Necessidade</th><th>3 cotações</th><th>Fornecedor escolhido</th><th class="num">Preço</th><th>Prazo pgto</th><th class="num">Economia</th><th>Aprovação</th><th>Compra</th><th>Entrega prevista</th></tr>';
  $('#cmp-table').innerHTML = '<table><thead>'+head+'</thead><tbody>' + ordem.map(function(k){
    var g = grupos[k];
    return '<tr class="grp-row"><td colspan="13"><span>'+esc(g.nome)+'</span> <span class="grp-meta">'+g.itens.length+' solicitação(ões) · '+fmtR(g.total)+(g.econ > 0 ? ' · economia ' + fmtR(g.econ) : '')+'</span></td></tr>' +
      g.itens.map(cmpLinha).join('');
  }).join('') + '</tbody></table><div class="tbl-foot">'+list.length+' solicitação(ões) em '+ordem.length+' grupo(s) · clique numa linha para cotar, aprovar ou registrar o pedido</div>';
}
function cmpLinha(c){
  var k = cmpCalc(c), e = cmpEtapa(c), dn = daysUntil(c.necessidade), de = daysUntil(c.entregaPrevista), itens = k.itens;
  var usados = {}; k.fornecedores.forEach(function(f){ usados[f.i] = 1; });
  var chips = [0, 1, 2].map(function(i){
    var q = k.qs.find(function(x){ return x.i === i; });
    if(!q) return '<span class="q-chip empty">—</span>';
    var txt = q.completo || (!q.cotados && q.total) ? fmtR(q.total) : q.cotados + '/' + itens.length + ' itens';
    return '<span class="q-chip'+(usados[i] ? ' win' : '')+'" title="'+esc(q.fornecedor)+'">'+txt+'</span>';
  }).join('');
  var necCls = c.necessidade && dn < 0 && ['recebida','cancelada','reprovada'].indexOf(e) === -1 ? 'qty-out' : '';
  var itTxt = itens.slice(0, 3).map(function(i){ return esc(fmtN(i.qtd) + '× ' + i.item + (i.tk ? ' (' + i.tk + ')' : '')); }).join('<br>') + (itens.length > 3 ? '<br><span style="color:var(--text-faint)">+ ' + (itens.length - 3) + ' item(ns)</span>' : '');
  var fornTxt = k.fornecedores.length ? k.fornecedores.map(function(f){ return esc(f.fornecedor) + (k.fornecedores.length > 1 ? ' <span style="color:var(--text-faint)">(' + f.itens.length + ')</span>' : ''); }).join('<br>') + (k.aprovada ? '' : '<span class="sub">recomendado</span>') : '<span style="color:var(--text-faint)">—</span>';
  var pgto = k.fornecedores.map(function(f){ return f.prazoPgto; }).filter(function(x, i, a){ return x && a.indexOf(x) === i; }).join(' / ');
  return '<tr class="row-clickable" data-act="abrir-compra" data-id="'+c._id+'">' +
    '<td><span class="mono" style="color:var(--text)">'+cmpNumero(c)+'</span><span class="sub">'+fmtD(fmtISO(c.criadoEm))+' · '+esc(c.solicitante || '')+'</span></td>' +
    '<td class="wrap" style="font-size:12px">'+itTxt+(c.urgente ? ' <span class="pill red" style="padding:1px 7px;font-size:10.5px">Urgente</span>' : '')+'</td>' +
    '<td class="num">'+fmtN(cmpQtdTotal(c))+'<span class="sub">'+itens.length+' item(ns)</span></td>' +
    '<td>'+esc(nomeCentro(c.unidadeId))+'</td>' +
    '<td class="mono '+necCls+'">'+fmtD(c.necessidade)+'</td>' +
    '<td>'+chips+'</td><td>'+fornTxt+'</td>' +
    '<td class="num">'+(k.fornecedores.length ? fmtR(k.total) : '—')+'</td>' +
    '<td>'+esc(pgto || '—')+'</td>' +
    '<td class="num '+(k.economia > 0 ? 'qty-in' : '')+'">'+(k.economia > 0 ? fmtR(k.economia)+'<span class="sub">'+k.economiaPct.toFixed(1).replace('.', ',')+'%</span>' : '—')+'</td>' +
    '<td>'+cmpAprovPill(c)+'</td><td>'+cmpCompraPill(c)+'</td>' +
    '<td class="mono '+(e === 'pedido' && de < 0 ? 'qty-out' : '')+'">'+(e === 'recebida' ? '<span class="qty-in">'+fmtD(c.recebidoEm)+'</span><span class="sub">recebida</span>' : fmtD(c.entregaPrevista))+'</td></tr>';
}
function fmtISO(ts){ if(!ts) return ''; var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
formHandlers['cmp-filtro'] = function(el){ cmpFiltro = el.dataset.id; renderCompras(); };

// =====================================================================
// MODAL DA SOLICITAÇÃO
// =====================================================================
formHandlers['nova-compra'] = function(el){ formCompra(null, el && el.dataset.id); };
formHandlers['abrir-compra'] = function(el){ formCompra(el.dataset.id); };
var cmpRowSeq = 0;

function formCompra(id, pidPrefill){
  if(!id && !can('solicitar')) return;
  var c = id ? DB.compras[id] : null;
  if(id && !c) return;
  var novo = !c;
  if(novo){
    var pp = pidPrefill ? DB.produtos[pidPrefill] : null;
    c = {grupo: pp ? (pp.grupo || pp.categoria || '') : '', itens: pp ? [{item:pp.nome, pid:pidPrefill, qtd: +pp.estoqueMinimo ? Math.max(1, (+pp.estoqueMinimo) - saldoProduto(pidPrefill)) : 1, unidade:pp.unidade || 'UN', tk:''}] : [], cotacoes:[]};
  }
  var e = novo ? 'cotacao' : cmpEtapa(c);
  var edSol = novo || cmpPodeEditarSolic(c), edCot = !novo && (e === 'cotacao' || e === 'reprovada') && can('comprar');
  var podeAprovar = !novo && e === 'aguardando' && can('aprovar');
  var dis = function(b){ return b ? '' : ' disabled'; };

  var passos = ['Solicitação','Cotação','Aprovação','Pedido','Recebimento'];
  var at = {cotacao:1, aguardando:2, reprovada:2, aprovada:3, pedido:4, recebida:5, cancelada:-1}[e];
  var flow = '<div class="flow">' + passos.map(function(p, i){
    var cls = e === 'cancelada' ? '' : (i < at ? 'done' : (i === at ? (e === 'reprovada' ? 'bad' : 'now') : ''));
    if(e === 'recebida') cls = 'done';
    return '<div class="flow-step '+cls+'">'+(i === 2 && e === 'reprovada' ? 'Reprovada' : p)+'</div>';
  }).join('') + '</div>';

  var h = '<div class="modal-title">'+(novo ? 'Nova solicitação de compra' : cmpNumero(c) + ' — ' + esc(cmpGrupo(c)))+'</div>' +
    (novo ? '<div class="modal-sub">Junte numa solicitação os itens do mesmo grupo. Depois, no mapa de cotação, dá para escolher de qual fornecedor comprar cada item.</div>' : '<div class="modal-sub">Solicitada por '+esc(c.solicitante || '—')+' em '+fmtDT(c.criadoEm)+(c.importada ? ' · importada do histórico' : '')+(e === 'cancelada' ? ' · <b style="color:var(--red)">Cancelada</b>' : '')+'</div>' + flow) +
    '<div class="section-label" style="margin-top:0">Solicitação</div><div class="modal-grid three">' +
      field('Grupo', '<input id="c-grupo" list="dl-grupos" value="'+esc(c.grupo || '')+'" placeholder="Ex.: Uniforme, Material de limpeza"'+dis(edSol)+'>') +
      field('Centro / unidade', '<select id="c-unid"'+dis(edSol)+'>'+centrosOptsHtml(c.unidadeId)+'</select>') +
      field('Necessário até', '<input type="date" id="c-nec" value="'+esc(c.necessidade || '')+'"'+dis(edSol)+'>') +
      field('Prioridade', '<select id="c-urg"'+dis(edSol)+'>'+optList([['0','Normal'],['1','Urgente']], c.urgente ? '1' : '0')+'</select>') +
      field('Justificativa / necessidade', '<input id="c-just" value="'+esc(c.justificativa || '')+'" placeholder="Para que e por que precisa"'+dis(edSol)+'>', 'full') +
    '</div><datalist id="dl-grupos">'+cmpGruposLista().map(function(g){ return '<option value="'+esc(g)+'">'; }).join('')+'</datalist>' +
    '<div class="section-label">Itens do grupo</div>' +
    '<table class="items-table"><thead><tr><th style="width:48%">Item</th><th>Tamanho</th><th style="width:90px">Qtd</th><th style="width:110px">Unidade</th><th style="width:36px"></th></tr></thead><tbody id="c-itens"></tbody></table>' +
    (edSol ? '<button class="btn btn-sm" style="margin-top:8px" data-act="cmp-add-item">+ Adicionar item</button><div class="hint" style="margin-top:4px">Escolha da lista os produtos do estoque: no recebimento eles entram no saldo sozinhos. Itens fora do estoque podem ser digitados livremente.</div>' : '');

  if(!novo){
    h += '<div class="section-label">Cotações '+(edCot ? '<span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-faint)">— lance o preço de cada item; o fornecedor pode deixar em branco o que não tiver</span>' : '')+'</div>' +
      '<div class="quote-grid" id="c-quotes"></div><datalist id="dl-prazos">'+PRAZOS_PGTO.map(function(p){ return '<option value="'+p+'">'; }).join('')+'</datalist>' +
      '<div class="section-label" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">Mapa de cotação — de qual fornecedor comprar cada item' +
        ((edCot || podeAprovar) ? '<span style="display:flex;gap:6px;flex-wrap:wrap;text-transform:none;letter-spacing:0;font-weight:400"><button class="btn btn-sm" data-act="cmp-sel-menor">Menor preço por item</button><button class="btn btn-sm" data-act="cmp-sel-q" data-q="0">Tudo da 1</button><button class="btn btn-sm" data-act="cmp-sel-q" data-q="1">Tudo da 2</button><button class="btn btn-sm" data-act="cmp-sel-q" data-q="2">Tudo da 3</button></span>' : '') + '</div>' +
      '<div class="table-wrap" id="c-mapa"></div>' +
      '<div class="summary-bar" id="c-resumo"></div>' +
      '<div class="modal-field" id="c-motivo-box" style="display:none;margin-top:10px"><label>Motivo de não escolher o menor preço em algum item</label><input id="c-motivo" value="'+esc(c.motivoEscolha || '')+'" placeholder="Ex.: prazo de entrega, qualidade, juntar num fornecedor só"'+dis(edCot)+'></div>' +
      '<div class="modal-field" id="c-menos3-box" style="display:none;margin-top:10px"><label>Por que algum item tem menos de 3 cotações?</label><input id="c-menos3" value="'+esc(c.motivoMenos3 || '')+'" placeholder="Ex.: fornecedor exclusivo, item emergencial"'+dis(edCot)+'></div>';

    if(podeAprovar){
      h += '<div class="action-box"><h4>Sua aprovação</h4><div style="font-size:12.5px;color:var(--text-dim);margin-bottom:10px">O mapa acima já vem com a seleção recomendada pelo comprador. Se quiser, troque o fornecedor de algum item e aprove. Só a seleção aprovada vira pedido.</div>' +
        '<div class="modal-field"><label>Comentário (obrigatório para reprovar ou se mudar a seleção recomendada)</label><input id="c-coment"></div>' +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-danger" data-act="cmp-reprovar" data-id="'+id+'">Reprovar</button><button class="btn btn-primary" data-act="cmp-aprovar" data-id="'+id+'">Aprovar seleção</button></div></div>';
    } else if(e === 'aguardando'){
      h += '<div class="action-box"><h4>Aguardando aprovação</h4><div style="font-size:12.5px;color:var(--text-dim)">Enviada por '+esc(c.enviadoPor || '—')+' em '+fmtDT(c.enviadoEm)+'. Um aprovador precisa aprovar a seleção ou reprovar.</div>' +
        (can('comprar') ? '<div class="modal-actions" style="margin-top:10px"><button class="btn" data-act="cmp-voltar-cotacao" data-id="'+id+'">Voltar para cotação</button></div>' : '') + '</div>';
    } else if(e === 'aprovada' && can('comprar')){
      var k0 = cmpCalc(c);
      h += '<div class="action-box"><h4>Emitir '+(k0.fornecedores.length > 1 ? k0.fornecedores.length + ' pedidos (um por fornecedor)' : 'pedido')+'</h4>' +
        '<table class="items-table"><thead><tr><th>Fornecedor</th><th>Itens</th><th class="num">Valor</th><th>Nº do pedido / OC</th><th>Entrega prevista</th></tr></thead><tbody>' +
        k0.fornecedores.map(function(f){
          var prev = f.prazoEntrega !== '' ? addDays(today(), +f.prazoEntrega) : '';
          return '<tr><td><b>'+esc(f.fornecedor)+'</b><span class="sub">'+esc(f.prazoPgto || '')+'</span></td><td style="font-size:12px">'+f.itens.map(function(j){ return esc(k0.itens[j].item); }).join('<br>')+'</td><td class="num">'+fmtR(f.subtotal)+'</td>' +
            '<td><input class="ped-num" data-q="'+f.i+'" placeholder="Opcional"></td><td><input type="date" class="ped-prev" data-q="'+f.i+'" value="'+prev+'"></td></tr>';
        }).join('') + '</tbody></table>' +
        '<div class="modal-grid" style="margin-top:10px">' + field('Data do pedido', '<input type="date" id="c-ped-data" value="'+today()+'">') + '</div>' +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-primary" data-act="cmp-pedido" data-id="'+id+'">Registrar '+(k0.fornecedores.length > 1 ? 'pedidos' : 'pedido')+'</button></div></div>';
    } else if(e === 'pedido' && (can('comprar') || can('movimentar'))){
      var k1 = cmpCalc(c);
      h += '<div class="action-box"><h4>Recebimento'+(k1.fornecedores.length > 1 ? ' — cada fornecedor é recebido separadamente' : '')+'</h4>' + k1.fornecedores.map(function(f){
        var pd = cmpPedidoDe(c, f.i);
        if(pd.recebidoEm) return '<div class="rec-forn done"><b>'+esc(f.fornecedor)+'</b> — recebido em '+fmtD(pd.recebidoEm)+(pd.nf ? ' · NF ' + esc(pd.nf) : '')+'</div>';
        var doEstoque = f.itens.filter(function(j){ var it = k1.itens[j]; return it.pid && DB.produtos[it.pid]; });
        return '<div class="rec-forn" data-q="'+f.i+'"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b>'+esc(f.fornecedor)+'</b><span style="font-size:12px;color:var(--text-dim)">Pedido '+esc(pd.numero || '—')+' · previsto '+fmtD(pd.entregaPrevista)+' · '+fmtR(f.subtotal)+'</span></div>' +
          '<div class="modal-grid three">' + field('Recebido em', '<input type="date" class="rec-data" value="'+today()+'">') + field('Nota fiscal', '<input class="rec-nf" placeholder="Nº da NF">') +
          field('Nova previsão', '<input type="date" class="rec-prev" value="'+esc(pd.entregaPrevista || '')+'">', '', '<a href="#" data-act="cmp-prev" data-id="'+id+'" data-q="'+f.i+'" style="color:var(--teal)">Salvar só a previsão</a>') + '</div>' +
          (doEstoque.length ? '<label class="modal-check"><input type="checkbox" class="rec-entrada" checked> Dar entrada no estoque de: '+doEstoque.map(function(j){ var it = k1.itens[j], tams = tamanhosProduto(it.pid).filter(function(t){ return t !== 'UN'; });
              return '<span style="white-space:nowrap">'+esc(fmtN(it.qtd) + '× ' + it.item)+(tams.length ? ' <select class="rec-tam" data-j="'+j+'">'+tamOptions(it.pid, tamKey(it.tk), null, false)+'</select>' : '')+'</span>'; }).join(' · ')+'</label>' : '') +
          '<div class="modal-actions" style="margin-top:10px">'+(doEstoque.length ? '<select class="tb-select rec-loc">'+optList(locaisOpts(), defaultLocal())+'</select>' : '')+'<button class="btn btn-primary btn-sm" data-act="cmp-receber" data-id="'+id+'" data-q="'+f.i+'">Registrar recebimento</button></div></div>';
      }).join('') + '</div>';
    } else if(e === 'reprovada'){
      h += '<div class="action-box" style="border-color:var(--red-soft)"><h4 style="color:var(--red)">Reprovada por '+esc(c.aprovadoPor || '—')+'</h4><div style="font-size:12.5px;color:var(--text-dim)">'+esc(c.comentarioAprov || 'Sem comentário')+'</div>' +
        (can('comprar') ? '<div class="hint" style="margin-top:6px">Ajuste as cotações e envie de novo para aprovação.</div>' : '') + '</div>';
    }
    if(['aprovada','pedido','recebida'].indexOf(e) !== -1){
      var k2 = cmpCalc(c);
      h += '<div class="section-label">Pedidos</div><table class="items-table"><thead><tr><th>Fornecedor</th><th class="num">Valor</th><th>Pedido</th><th>Entrega prevista</th><th>Recebido</th></tr></thead><tbody>' + k2.fornecedores.map(function(f){
        var pd = cmpPedidoDe(c, f.i);
        return '<tr><td>'+esc(f.fornecedor)+'<span class="sub">'+f.itens.length+' item(ns) · '+esc(f.prazoPgto || '')+'</span></td><td class="num">'+fmtR(f.subtotal)+'</td><td class="mono">'+esc(pd.numero || '—')+'</td><td class="mono">'+fmtD(pd.entregaPrevista)+'</td><td>'+(pd.recebidoEm ? '<span class="qty-in">'+fmtD(pd.recebidoEm)+'</span>'+(pd.nf ? ' · NF ' + esc(pd.nf) : '') : '—')+'</td></tr>';
      }).join('') + '</tbody></table><div class="hint">Aprovada por '+esc(c.aprovadoPor || '—')+' em '+fmtDT(c.aprovadoEm)+(c.comentarioAprov ? ' — ' + esc(c.comentarioAprov) : '')+'</div>';
    }
    var hist = vals(c.historico).sort(function(a, b){ return a.ts - b.ts; });
    if(hist.length) h += '<div class="section-label">Histórico</div><div class="timeline">' + hist.map(function(x){ return '<div><span class="mono">'+fmtDT(x.ts)+'</span> · <b style="color:var(--text)">'+esc(x.usuario)+'</b> — '+esc(x.acao)+'</div>'; }).join('') + '</div>';
  }

  var left = '', right = '';
  if(!novo && ['cotacao','reprovada','aguardando','aprovada'].indexOf(e) !== -1 && (can('comprar') || (c.solicitante === currentUser.name && e === 'cotacao')))
    left = '<button class="btn btn-danger" data-act="cmp-cancelar" data-id="'+id+'" style="margin-right:auto">Cancelar solicitação</button>';
  if(novo) right = '<button class="btn btn-primary" data-act="cmp-salvar">Criar solicitação</button>';
  else if(edSol || edCot){
    right = '<button class="btn" data-act="cmp-salvar" data-id="'+id+'">Salvar</button>';
    if(can('comprar')) right += '<button class="btn btn-primary" data-act="cmp-enviar" data-id="'+id+'">Enviar para aprovação</button>';
  }
  h += '<div id="form-error" class="form-error"></div><div class="modal-actions">'+left+'<button class="btn btn-ghost" data-act="fechar">Fechar</button>'+right+'</div>';
  if(id) h += '<input type="hidden" id="c-id" value="'+id+'">';
  openModal(h, 'xwide');

  var box = $('#modal-box');
  box._cmp = {c:c, edSol:edSol, edCot:edCot, podeAprovar:podeAprovar, id:id, sel:{}, manual:{}};
  var itens = cmpItens(c), selIni = cmpSelecao(c);
  (itens.length ? itens : [{}]).forEach(function(it, j){
    var key = cmpAddItemRow(it);
    if(selIni && selIni[j] != null){ box._cmp.sel[key] = selIni[j]; box._cmp.manual[key] = true; }
  });
  if(!novo){
    cmpRenderQuotes((c.cotacoes || []).map(function(q){ return !q ? {} : (!q.precos && q.preco != null ? Object.assign({}, q, {precos:[q.preco]}) : q); }));
  }
}

// ----- linhas de itens -----
function cmpAddItemRow(it){
  var st = $('#modal-box')._cmp, ed = st.edSol, dis = ed ? '' : ' disabled';
  it = it || {};
  var key = 'r' + (++cmpRowSeq), tr = document.createElement('tr');
  tr.dataset.k = key;
  tr.innerHTML = '<td><input class="ci-item" list="dl-produtos" value="'+esc(it.item || '')+'" placeholder="Produto ou descrição"'+dis+'></td>' +
    '<td><input class="ci-tam" value="'+esc(it.tk || '')+'" placeholder="—"'+dis+'></td>' +
    '<td><input class="ci-qtd" type="number" min="1" step="1" value="'+esc(it.qtd || 1)+'"'+dis+'></td>' +
    '<td><select class="ci-un"'+dis+'>'+optList(unidadesOpts(it.unidade), (it.unidade || 'UN').toUpperCase())+'</select></td>' +
    '<td>'+(ed ? '<button class="icon-btn" data-act="cmp-rm-item" title="Remover">×</button>' : '')+'</td>';
  $('#c-itens').appendChild(tr);
  var inp = $('.ci-item', tr);
  if(ed) onPick(inp, function(){
    var pid = findProdByLabel(inp.value);
    if(pid){ var p = DB.produtos[pid]; inp.value = p.nome; $('.ci-un', tr).innerHTML = optList(unidadesOpts(p.unidade), (p.unidade || 'UN').toUpperCase()); if(!$('#c-grupo').value.trim() && (p.grupo || p.categoria)) $('#c-grupo').value = p.grupo || p.categoria; }
    cmpItensMudaram();
  });
  ['.ci-qtd', '.ci-tam'].forEach(function(s){ $(s, tr).addEventListener('input', cmpItensMudaram); });
  return key;
}
formHandlers['cmp-add-item'] = function(){ cmpAddItemRow({}); cmpItensMudaram(); };
formHandlers['cmp-rm-item'] = function(el){ var tb = el.closest('tbody'); if(tb.children.length > 1){ el.closest('tr').remove(); cmpItensMudaram(); } };
function cmpLerItens(){
  return $$('#c-itens tr').map(function(tr){
    var nome = $('.ci-item', tr).value.trim(), pid = findProdByLabel(nome) || '';
    return {k: tr.dataset.k, item: pid ? DB.produtos[pid].nome : nome, pid: pid, tk: $('.ci-tam', tr).value.trim().toUpperCase(), qtd: Math.floor(num($('.ci-qtd', tr).value)) || 0, unidade: $('.ci-un', tr).value};
  });
}
var cmpItensTimer = null;
function cmpItensMudaram(){
  if(!$('#c-quotes')) return;
  clearTimeout(cmpItensTimer);
  cmpItensTimer = setTimeout(function(){ cmpRenderQuotes(cmpLerCotacoesForm(true)); }, 120);
}

// ----- cartões das 3 cotações (preço por item) -----
function cmpRenderQuotes(cots){
  var st = $('#modal-box')._cmp, ed = st.edCot, dis = ed ? '' : ' disabled';
  var itens = cmpLerItens();
  $('#c-quotes').innerHTML = [0, 1, 2].map(function(i){
    var q = cots[i] || {};
    var precoDe = function(it, j){ if(q.precosPorK && q.precosPorK[it.k] != null) return q.precosPorK[it.k]; return (q.precos || [])[j]; };
    return '<div class="quote-card" data-q="'+i+'"><div class="quote-head"><span>Cotação '+(i + 1)+'</span><span class="q-badge"></span></div>' +
      '<div><label>Fornecedor</label><input class="q-forn" value="'+esc(q.fornecedor || '')+'"'+dis+'></div>' +
      '<div class="q-itens">' + itens.map(function(it, j){
        var pr = precoDe(it, j);
        return '<div class="q-item" data-k="'+it.k+'"><span title="'+esc(it.item)+'">'+esc((it.item || 'Item ' + (j + 1)).slice(0, 38))+(it.tk ? ' ('+esc(it.tk)+')' : '')+' <span style="color:var(--text-faint)">× '+fmtN(it.qtd)+'</span></span>' +
          '<input class="q-preco" data-k="'+it.k+'" inputmode="decimal" placeholder="R$ unit." value="'+(num(pr) > 0 ? String(num(pr)).replace('.', ',') : '')+'"'+dis+'></div>';
      }).join('') + (q.totalInformado && !itens.some(function(it, j){ return num(precoDe(it, j)) > 0; }) ? '<div class="hint">Total informado na importação: '+fmtR(q.totalInformado)+'</div>' : '') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Frete (R$)</label><input class="q-frete" inputmode="decimal" value="'+(q.frete ? String(q.frete).replace('.', ',') : '')+'"'+dis+'></div>' +
      '<div><label>Entrega (dias)</label><input class="q-ent" type="number" min="0" value="'+esc(q.prazoEntrega === 0 ? 0 : (q.prazoEntrega || ''))+'"'+dis+'></div></div>' +
      '<div><label>Prazo de pagamento</label><input class="q-pgto" list="dl-prazos" value="'+esc(q.prazoPgto || '')+'"'+dis+'></div>' +
      '<div><label>Observação</label><input class="q-obs" value="'+esc(q.obs || '')+'"'+dis+'></div>' +
      '<div class="quote-total">Total: <span class="q-tot">—</span></div></div>';
  }).join('');
  $$('#c-quotes input').forEach(function(inp){ inp.addEventListener('input', cmpResumo); });
  cmpResumo();
}
function cmpLerCotacoesForm(porK){
  var itens = cmpLerItens();
  return $$('#c-quotes .quote-card').map(function(card){
    var pk = {}; $$('.q-preco', card).forEach(function(i){ pk[i.dataset.k] = num(i.value); });
    var ent = $('.q-ent', card).value;
    var o = {fornecedor: $('.q-forn', card).value.trim(), precos: itens.map(function(it){ return pk[it.k] || 0; }), frete: num($('.q-frete', card).value),
             prazoEntrega: ent !== '' ? Math.max(0, Math.floor(num(ent))) : '', prazoPgto: $('.q-pgto', card).value.trim(), obs: $('.q-obs', card).value.trim()};
    var orig = ($('#modal-box')._cmp.c.cotacoes || [])[+card.dataset.q]; if(orig && orig.totalInformado) o.totalInformado = orig.totalInformado;
    if(porK) o.precosPorK = pk;
    return o;
  });
}
// Seleção atual do formulário (array por item, alinhado à ordem dos itens)
function cmpSelForm(){ var st = $('#modal-box')._cmp; return cmpLerItens().map(function(it){ return st.sel[it.k] != null ? st.sel[it.k] : null; }); }

// ----- mapa de cotação + resumo -----
function cmpResumo(){
  var st = $('#modal-box')._cmp, itens = cmpLerItens(), cot = cmpLerCotacoesForm();
  var tmp = {itens:itens, cotacoes:cot, aprovacao:'cotacao'};
  var qs = cmpCotacoes(tmp), qById = {}; qs.forEach(function(q){ qById[q.i] = q; });
  var podeMexer = st.edCot || st.podeAprovar, aprovadaJa = cmpFoiAprovada(st.c);
  // itens sem escolha manual acompanham o menor preço; escolha que ficou sem preço volta para o menor
  var menor = cmpMenorPorItem(tmp);
  itens.forEach(function(it, j){
    var atual = st.sel[it.k], semPreco = atual != null && !(qById[atual] && (qById[atual].precos[j] > 0 || (!qById[atual].cotados && qById[atual].total > 0)));
    if((podeMexer && !st.manual[it.k]) || semPreco){ st.sel[it.k] = menor[j]; if(semPreco) st.manual[it.k] = false; }
  });
  var sel = cmpSelForm(), k = cmpCalc(tmp, sel);
  var usados = {}; k.fornecedores.forEach(function(f){ usados[f.i] = f; });
  // cartões: total e destaque
  $$('#c-quotes .quote-card').forEach(function(card, i){
    var q = qById[i];
    card.classList.toggle('win', !!usados[i]);
    $('.q-tot', card).textContent = q ? (q.completo ? fmtR(q.total) : (q.cotados ? fmtR(q.soma + q.frete) + ' (' + q.cotados + ' de ' + itens.length + ' itens)' : (q.total ? fmtR(q.total) : '—'))) : '—';
    $('.q-badge', card).innerHTML = usados[i] ? '<span class="pill '+(aprovadaJa ? 'teal' : 'gray')+'" style="padding:1px 8px">'+(aprovadaJa ? 'Aprovada' : 'Escolhida')+' · '+usados[i].itens.length+' item(ns)</span>' : '';
  });
  itens.forEach(function(it, j){
    var inps = $$('#c-quotes .q-preco[data-k="'+it.k+'"]'), vs = inps.map(function(i){ return num(i.value); }).filter(function(v){ return v > 0; });
    var mn = vs.length > 1 ? Math.min.apply(null, vs) : null;
    inps.forEach(function(i){ i.classList.toggle('best', mn != null && num(i.value) === mn); });
  });
  // mapa
  var nomes = [0, 1, 2].map(function(i){ return qById[i] ? qById[i].fornecedor : 'Cotação ' + (i + 1); });
  $('#c-mapa').innerHTML = '<table class="map-table"><thead><tr><th>Item</th><th class="num">Qtd</th>' + [0, 1, 2].map(function(i){ return '<th>'+esc(nomes[i])+'</th>'; }).join('') + '<th>Escolhido</th></tr></thead><tbody>' +
    itens.map(function(it, j){
      var cel = [0, 1, 2].map(function(i){
        var q = qById[i], p = q ? q.precos[j] : 0, ativo = sel[j] === i;
        if(!(p > 0)) return '<td class="map-cell vazio">—</td>';
        return '<td class="map-cell'+(ativo ? ' on' : '')+(p === k.minPorItem[j] && qs.filter(function(x){ return x.precos[j] > 0; }).length > 1 ? ' best' : '')+'">' +
          '<label><input type="radio" name="sel-'+it.k+'" value="'+i+'"'+(ativo ? ' checked' : '')+(podeMexer ? '' : ' disabled')+'> '+fmtR(p)+'</label><span class="sub">'+fmtR(p * it.qtd)+'</span></td>';
      }).join('');
      var esc_ = sel[j] != null && qById[sel[j]] ? qById[sel[j]].fornecedor : '';
      return '<tr><td>'+esc(it.item || '—')+(it.tk ? ' <span style="color:var(--text-faint)">('+esc(it.tk)+')</span>' : '')+'</td><td class="num">'+fmtN(it.qtd)+'</td>'+cel+'<td>'+(esc_ ? '<b>'+esc(esc_)+'</b>' : '<span style="color:var(--red)">sem preço</span>')+'</td></tr>';
    }).join('') +
    '</tbody><tfoot><tr><td colspan="2">Total por fornecedor (com frete)</td>' + [0, 1, 2].map(function(i){ return '<td class="num">'+(usados[i] ? '<b>'+fmtR(usados[i].subtotal)+'</b>' : '—')+'</td>'; }).join('') + '<td class="num"><b>'+fmtR(k.total)+'</b></td></tr></tfoot></table>';
  $$('#c-mapa input[type=radio]').forEach(function(r){ r.addEventListener('change', function(){ var key = r.name.slice(4); st.sel[key] = +r.value; st.manual[key] = true; cmpResumo(); }); });
  $('#c-resumo').innerHTML =
    '<div><span class="lbl">'+(aprovadaJa ? 'Fornecedores aprovados' : 'Seleção')+'</span>'+(k.fornecedores.length ? k.fornecedores.map(function(f){ return esc(f.fornecedor) + ' (' + f.itens.length + ')'; }).join(' · ') : '—')+'</div>' +
    '<div><span class="lbl">Total da compra</span><b>'+(k.fornecedores.length ? fmtR(k.total) : '—')+'</b></div>' +
    '<div><span class="lbl">Prazo de pagamento</span>'+(k.fornecedores.map(function(f){ return f.prazoPgto; }).filter(function(x, i, a){ return x && a.indexOf(x) === i; }).join(' / ') || '—')+'</div>' +
    '<div><span class="lbl">Economia vs. maior preço</span><b class="'+(k.economia > 0 ? 'qty-in' : '')+'">'+(k.fornecedores.length ? fmtR(k.economia) + ' (' + k.economiaPct.toFixed(1).replace('.', ',') + '%)' : '—')+'</b></div>' +
    '<div><span class="lbl">Cotações</span>'+qs.length+' de 3</div>' + (k.faltando.length ? '<div><span class="lbl">Atenção</span><span style="color:var(--red)">'+k.faltando.length+' item(ns) sem preço</span></div>' : '');
  var menos3 = itens.some(function(it, j){ return qs.filter(function(q){ return q.precos[j] > 0; }).length < 3; }) && qs.some(function(q){ return q.cotados; });
  if($('#c-motivo-box')) $('#c-motivo-box').style.display = (st.edCot && k.naoMenor) || st.c.motivoEscolha ? '' : 'none';
  if($('#c-menos3-box')) $('#c-menos3-box').style.display = (st.edCot && menos3) || st.c.motivoMenos3 ? '' : 'none';
  st._menos3 = menos3; st._calc = k;
}
formHandlers['cmp-sel-menor'] = function(){ var st = $('#modal-box')._cmp; cmpLerItens().forEach(function(it){ st.manual[it.k] = false; }); cmpResumo(); };
formHandlers['cmp-sel-q'] = function(el){
  var st = $('#modal-box')._cmp, qi = +el.dataset.q, cot = cmpLerCotacoesForm()[qi];
  if(!cot || !cot.fornecedor) return formError('A cotação ' + (qi + 1) + ' não tem fornecedor.');
  var faltam = 0;
  cmpLerItens().forEach(function(it, j){ if(cot.precos[j] > 0){ st.sel[it.k] = qi; st.manual[it.k] = true; } else { st.manual[it.k] = false; faltam++; } });
  formError(faltam ? cot.fornecedor + ' não cotou ' + faltam + ' item(ns): eles ficaram com o menor preço dos outros.' : '');
  cmpResumo();
};

function cmpHist(paths, id, acao){ paths['compras/' + id + '/historico/' + store.key()] = {ts: nowTs(), usuario: currentUser.name, acao: acao}; return paths; }
function cmpDescSel(k){ return k.fornecedores.map(function(f){ return f.fornecedor + ' (' + f.itens.length + ' item(ns) ' + fmtR(f.subtotal) + ')'; }).join(' + '); }

function cmpLerSolicitacao(){
  var grupo = $('#c-grupo').value.trim(); if(!grupo){ formError('Informe o grupo da compra (ex.: Uniforme, Material de limpeza).'); return null; }
  var itens = cmpLerItens().filter(function(i){ return i.item; });
  if(!itens.length){ formError('Adicione pelo menos um item.'); return null; }
  var bad = itens.find(function(i){ return i.qtd <= 0; }); if(bad){ formError('Quantidade inválida em ' + bad.item + '.'); return null; }
  return {grupo: grupo, itens: itens.map(function(i){ return {item:i.item, pid:i.pid, tk:i.tk, qtd:i.qtd, unidade:i.unidade}; }), unidadeId: $('#c-unid').value, necessidade: $('#c-nec').value, urgente: $('#c-urg').value === '1', justificativa: $('#c-just').value.trim()};
}

formHandlers['cmp-salvar'] = function(btn, enviar){
  var id = btn.dataset.id, c = id ? DB.compras[id] : null, st = $('#modal-box')._cmp;
  var sol = st.edSol ? cmpLerSolicitacao() : null;
  if(st.edSol && !sol) return;
  if(!id){
    busy(btn, true);
    return store.txn('config/seqCompra', function(cur){ return (+cur || 0) + 1; }).then(function(r){
      var nid = store.key(), p = {};
      p['compras/' + nid] = Object.assign(sol, {numero: r.value, criadoEm: nowTs(), solicitante: currentUser.name, aprovacao:'cotacao', compra:'pendente', cotacoes:[]});
      cmpHist(p, nid, 'Solicitação criada — ' + sol.grupo + ', ' + sol.itens.length + ' item(ns)');
      return save(p, 'Solicitação de compra', 'SC-' + String(r.value).padStart(4, '0') + ' ' + sol.grupo).then(function(){ return nid; });
    }).then(function(nid){ toast(can('comprar') ? 'Solicitação criada. Agora lance as cotações.' : 'Solicitação criada.'); formCompra(nid); })
      .catch(function(e){ busy(btn, false); formError(e.message); });
  }
  var p = {};
  if(sol){ Object.keys(sol).forEach(function(k){ p['compras/' + id + '/' + k] = sol[k]; }); ['item','pid','qtd','unidade','tk'].forEach(function(k){ if(c[k] !== undefined) p['compras/' + id + '/' + k] = null; }); }
  var k = null;
  if(st.edCot){
    cmpResumo();
    var cots = cmpLerCotacoesForm(), sel = cmpSelForm();
    k = cmpCalc({itens: sol ? sol.itens : cmpItens(c), cotacoes: cots, aprovacao:'cotacao'}, sel);
    p['compras/' + id + '/cotacoes'] = cots;
    p['compras/' + id + '/recomendacao'] = sel.map(function(x){ return x == null ? -1 : x; });
    p['compras/' + id + '/recomendada'] = null; p['compras/' + id + '/escolhida'] = null;
    p['compras/' + id + '/motivoEscolha'] = $('#c-motivo').value.trim();
    p['compras/' + id + '/motivoMenos3'] = $('#c-menos3').value.trim();
  }
  if(enviar){
    if(!k || !k.qs.length) return formError('Lance pelo menos uma cotação com fornecedor e preços.');
    if(k.faltando.length) return formError('Há ' + k.faltando.length + ' item(ns) sem preço em nenhuma cotação. Cote ou remova esses itens.');
    if(st._menos3 && !$('#c-menos3').value.trim()) return formError('Cada item precisa de 3 cotações. Se não for possível, explique o motivo no campo indicado.');
    if(k.naoMenor && !$('#c-motivo').value.trim()) return formError('Algum item não está com o menor preço: informe o motivo.');
    p['compras/' + id + '/aprovacao'] = 'aguardando';
    p['compras/' + id + '/enviadoPor'] = currentUser.name;
    p['compras/' + id + '/enviadoEm'] = nowTs();
    cmpHist(p, id, 'Enviada para aprovação — recomendado: ' + cmpDescSel(k) + ' = ' + fmtR(k.total));
  } else cmpHist(p, id, 'Dados atualizados');
  busy(btn, true);
  save(p, enviar ? 'Compra enviada para aprovação' : 'Compra atualizada', cmpNumero(c)).then(function(){
    toast(enviar ? 'Enviada para aprovação.' : 'Salvo.'); if(enviar) closeModal(); else formCompra(id);
  }).catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['cmp-enviar'] = function(btn){ formHandlers['cmp-salvar'](btn, true); };

// O aprovador aprova a seleção do mapa (pode mesclar fornecedores)
formHandlers['cmp-aprovar'] = function(btn){
  if(!can('aprovar')) return;
  var id = btn.dataset.id, c = DB.compras[id], com = $('#c-coment').value.trim();
  cmpResumo();
  var sel = cmpSelForm(), k = cmpCalc(Object.assign({}, c, {aprovacao:'cotacao'}), sel);
  if(!k.fornecedores.length || k.faltando.length) return formError('Escolha um fornecedor com preço para todos os itens.');
  var rec = cmpSelecao(Object.assign({}, c, {aprovacao:'aguardando'})) || [];
  var mudou = sel.some(function(x, j){ return x !== (rec[j] === -1 ? null : rec[j]); });
  if(mudou && !com) return formError('Você mudou a seleção recomendada: escreva o motivo no comentário.');
  var p = {};
  p['compras/' + id + '/aprovacao'] = 'aprovada'; p['compras/' + id + '/selecao'] = sel; p['compras/' + id + '/escolhida'] = null;
  p['compras/' + id + '/aprovadoPor'] = currentUser.name; p['compras/' + id + '/aprovadoEm'] = nowTs(); p['compras/' + id + '/comentarioAprov'] = com;
  cmpHist(p, id, 'Aprovada: ' + cmpDescSel(k) + ' = ' + fmtR(k.total) + (mudou ? ' (seleção alterada)' : '') + (com ? ' — ' + com : ''));
  busy(btn, true);
  save(p, 'Compra aprovada', cmpNumero(c) + ' ' + fmtR(k.total)).then(function(){ closeModal(); toast(cmpNumero(c) + ' aprovada' + (k.fornecedores.length > 1 ? ' com ' + k.fornecedores.length + ' fornecedores.' : '.')); });
};
formHandlers['cmp-reprovar'] = function(btn){
  if(!can('aprovar')) return;
  var id = btn.dataset.id, c = DB.compras[id], com = $('#c-coment').value.trim();
  if(!com) return formError('Escreva o motivo da reprovação.');
  var p = {}; p['compras/' + id + '/aprovacao'] = 'reprovada'; p['compras/' + id + '/selecao'] = null; p['compras/' + id + '/escolhida'] = null; p['compras/' + id + '/aprovadoPor'] = currentUser.name; p['compras/' + id + '/aprovadoEm'] = nowTs(); p['compras/' + id + '/comentarioAprov'] = com;
  cmpHist(p, id, 'Reprovada — ' + com);
  busy(btn, true);
  save(p, 'Compra reprovada', cmpNumero(c) + ' — ' + com).then(function(){ closeModal(); toast(cmpNumero(c) + ' reprovada.'); });
};
formHandlers['cmp-voltar-cotacao'] = function(btn){
  var id = btn.dataset.id, p = {}; p['compras/' + id + '/aprovacao'] = 'cotacao'; cmpHist(p, id, 'Voltou para cotação');
  save(p, 'Compra voltou para cotação', cmpNumero(DB.compras[id])).then(function(){ formCompra(id); });
};
// Um pedido por fornecedor escolhido
formHandlers['cmp-pedido'] = function(btn){
  if(!can('comprar')) return;
  var id = btn.dataset.id, c = DB.compras[id], k = cmpCalc(c), data = $('#c-ped-data').value || today(), pedidos = {}, falta = null;
  k.fornecedores.forEach(function(f){
    var prev = $('#modal-box .ped-prev[data-q="'+f.i+'"]').value, nn = $('#modal-box .ped-num[data-q="'+f.i+'"]').value.trim();
    if(!prev) falta = f.fornecedor;
    pedidos[f.i] = {fornecedor:f.fornecedor, numero:nn, data:data, entregaPrevista:prev};
  });
  if(falta) return formError('Informe a entrega prevista de ' + falta + '.');
  var prevs = Object.keys(pedidos).map(function(q){ return pedidos[q].entregaPrevista; }).sort();
  var p = {}; p['compras/' + id + '/compra'] = 'pedido'; p['compras/' + id + '/pedidos'] = pedidos; p['compras/' + id + '/pedidoData'] = data;
  p['compras/' + id + '/pedidoNumero'] = Object.keys(pedidos).map(function(q){ return pedidos[q].numero; }).filter(Boolean).join(' / ');
  p['compras/' + id + '/entregaPrevista'] = prevs[prevs.length - 1];
  cmpHist(p, id, (k.fornecedores.length > 1 ? k.fornecedores.length + ' pedidos emitidos: ' : 'Pedido emitido: ') + k.fornecedores.map(function(f){ return f.fornecedor + (pedidos[f.i].numero ? ' nº ' + pedidos[f.i].numero : '') + ' (entrega ' + fmtD(pedidos[f.i].entregaPrevista) + ')'; }).join('; '));
  busy(btn, true);
  save(p, 'Pedido de compra emitido', cmpNumero(c)).then(function(){ closeModal(); toast(k.fornecedores.length > 1 ? 'Pedidos registrados.' : 'Pedido registrado.'); });
};
formHandlers['cmp-prev'] = function(el){
  var id = el.dataset.id, qi = el.dataset.q, c = DB.compras[id], box = el.closest('.rec-forn'), v = $('.rec-prev', box).value; if(!v) return formError('Informe a nova data.');
  var p = {}, peds = Object.assign({}, c.pedidos || {});
  peds[qi] = Object.assign({}, cmpPedidoDe(c, qi), {entregaPrevista:v}); p['compras/' + id + '/pedidos'] = peds;
  var prevs = Object.keys(peds).map(function(q){ return peds[q].recebidoEm ? '' : peds[q].entregaPrevista; }).filter(Boolean).sort();
  p['compras/' + id + '/entregaPrevista'] = prevs[prevs.length - 1] || v;
  cmpHist(p, id, 'Previsão de entrega de ' + (peds[qi].fornecedor || '') + ' alterada para ' + fmtD(v));
  save(p, 'Previsão de entrega alterada', cmpNumero(c)).then(function(){ toast('Previsão atualizada.'); formCompra(id); });
};
// Recebimento de UM fornecedor (os itens dele entram no estoque)
formHandlers['cmp-receber'] = function(btn){
  var id = btn.dataset.id, qi = +btn.dataset.q, c = DB.compras[id], k = cmpCalc(c), f = k.fornecedores.find(function(x){ return x.i === qi; });
  var box = btn.closest('.rec-forn'), data = $('.rec-data', box).value || today(), nf = $('.rec-nf', box).value.trim();
  var entrar = $('.rec-entrada', box) && $('.rec-entrada', box).checked, loc = entrar ? $('.rec-loc', box).value : '';
  if(entrar && !loc) return formError('Cadastre um local de estoque.');
  var tams = {}; $$('.rec-tam', box).forEach(function(s){ tams[s.dataset.j] = s.value; });
  var ops = [], linhas = [];
  if(entrar) f.itens.forEach(function(j){ var it = k.itens[j]; if(it.pid && DB.produtos[it.pid]){ var tk = tams[j] || tamKey(it.tk); ops.push({pid:it.pid, tk:tk, loc:loc, delta:+it.qtd}); linhas.push({it:it, j:j, tk:tk}); } });
  busy(btn, true);
  var antes = {}; linhas.forEach(function(l){ if(antes[l.it.pid] == null) antes[l.it.pid] = saldoProduto(l.it.pid); });
  (ops.length ? applyStock(ops) : Promise.resolve()).then(function(){
    var p = {}, peds = {};
    k.fornecedores.forEach(function(x){ peds[x.i] = Object.assign({fornecedor:x.fornecedor}, cmpPedidoDe(c, x.i)); });
    peds[qi] = Object.assign(peds[qi], {recebidoEm:data, nf:nf, entradaEstoque: ops.length > 0});
    p['compras/' + id + '/pedidos'] = peds;
    var todos = k.fornecedores.every(function(x){ return peds[x.i].recebidoEm; });
    if(todos){
      var datas = Object.keys(peds).map(function(q){ return peds[q].recebidoEm; }).sort();
      p['compras/' + id + '/compra'] = 'recebida'; p['compras/' + id + '/recebidoEm'] = datas[datas.length - 1];
      p['compras/' + id + '/nf'] = Object.keys(peds).map(function(q){ return peds[q].nf; }).filter(Boolean).join(' / ');
    }
    p['compras/' + id + '/entradaEstoque'] = !!(c.entradaEstoque || ops.length);
    var custos = {};
    linhas.forEach(function(l){
      var preco = num(f.precos[l.j]);
      p['movimentos/' + store.key()] = movRecord({data:data, tipo:'entrada', pid:l.it.pid, tk:l.tk, loc:loc, qtd:+l.it.qtd, custoUnit:preco || undefined, doc:nf, fornecedor:f.fornecedor, obs:'Compra ' + cmpNumero(c)});
      if(preco){ var cu = custos[l.it.pid] || (custos[l.it.pid] = {s: antes[l.it.pid], v: antes[l.it.pid] * (+DB.produtos[l.it.pid].custo || 0)}); cu.s += +l.it.qtd; cu.v += (+l.it.qtd) * preco; }
    });
    Object.keys(custos).forEach(function(pid){ var cu = custos[pid]; if(cu.s > 0) p['produtos/' + pid + '/custo'] = Math.round(cu.v / cu.s * 100) / 100; });
    cmpHist(p, id, 'Recebido de ' + f.fornecedor + (nf ? ' — NF ' + nf : '') + (ops.length ? ' · entrada de ' + ops.length + ' item(ns) no estoque' : '') + (todos ? ' · compra concluída' : ''));
    return save(p, 'Compra recebida', cmpNumero(c) + ' — ' + f.fornecedor).then(function(){ return todos; });
  }).then(function(todos){ toast('Recebimento de ' + f.fornecedor + ' registrado' + (ops.length ? ' e saldo atualizado' : '') + '.'); if(todos) closeModal(); else formCompra(id); })
    .catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['cmp-cancelar'] = function(btn){
  if(!confirmInline(btn, 'Confirmar cancelamento')) return;
  var id = btn.dataset.id, p = {}; p['compras/' + id + '/compra'] = 'cancelada'; cmpHist(p, id, 'Solicitação cancelada');
  save(p, 'Compra cancelada', cmpNumero(DB.compras[id])).then(function(){ closeModal(); toast('Solicitação cancelada.'); });
};

// Excel: uma linha por item, com os 3 preços e o fornecedor escolhido daquele item
formHandlers['export-compras'] = function(){
  var rows = [];
  cmpFiltrar().forEach(function(c){
    var k = cmpCalc(c), qn = function(i){ var x = k.qs.find(function(z){ return z.i === i; }); return x ? x.fornecedor : ''; };
    k.itens.forEach(function(it, j){
      var qi = k.sel ? k.sel[j] : null, q = k.qs.find(function(z){ return z.i === qi; }), pu = q ? q.precos[j] : 0, pd = q ? cmpPedidoDe(c, q.i) : {};
      var pc = function(i){ var x = k.qs.find(function(z){ return z.i === i; }); return x && x.precos[j] > 0 ? x.precos[j] : ''; };
      rows.push({'Solicitação':cmpNumero(c), 'Grupo':cmpGrupo(c), 'Data':fmtD(fmtISO(c.criadoEm)), 'Solicitante':c.solicitante || '', 'Item':it.item, 'Tamanho':it.tk || '', 'Quantidade':+it.qtd, 'Unidade':it.unidade || '',
        'Centro / unidade':c.unidadeId ? nomeCentro(c.unidadeId) : '', 'Necessidade':fmtD(c.necessidade),
        'Fornecedor 1':qn(0), 'Preço 1':pc(0), 'Fornecedor 2':qn(1), 'Preço 2':pc(1), 'Fornecedor 3':qn(2), 'Preço 3':pc(2),
        'Fornecedor escolhido':q ? q.fornecedor : '', 'Preço unitário':pu || '', 'Preço do item':pu ? Math.round(pu * it.qtd * 100) / 100 : '', 'Prazo de pagamento':q ? q.prazoPgto : '',
        'Economia do item (R$)':pu && k.maxPorItem[j] ? Math.round((k.maxPorItem[j] - pu) * it.qtd * 100) / 100 : '', 'Total da compra':k.fornecedores.length ? Math.round(k.total * 100) / 100 : '',
        'Status da aprovação':({cotacao:'Em cotação', aguardando:'Aguardando aprovação', aprovada:'Aprovada', reprovada:'Reprovada'})[c.aprovacao || 'cotacao'], 'Aprovado por':c.aprovadoPor || '',
        'Status da compra':({pendente:'Não iniciada', pedido:'Pedido emitido', recebida:'Recebida', cancelada:'Cancelada'})[c.compra || 'pendente'], 'Nº pedido':pd.numero || '', 'Entrega prevista':fmtD(pd.entregaPrevista), 'Recebida em':fmtD(pd.recebidoEm), 'NF':pd.nf || ''});
    });
  });
  exportXlsx('compras', rows);
};
