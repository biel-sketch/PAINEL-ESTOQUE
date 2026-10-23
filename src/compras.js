// =====================================================================
// COMPRAS — cotação POR GRUPO: uma solicitação reúne os itens de um grupo
// (ex.: Uniformes, Material de limpeza). Cada um dos 3 fornecedores cota
// todos os itens; o comprador recomenda uma e o aprovador aprova SÓ UMA.
// Fluxo: Em cotação → Aguardando aprovação → Aprovada → Pedido emitido → Recebida
//        (Reprovada volta para cotação; Cancelada encerra)
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
// Itens da solicitação (compatível com solicitações antigas de um item só)
function cmpItens(c){
  if(c.itens && c.itens.length) return c.itens.filter(Boolean);
  return c.item ? [{item:c.item, pid:c.pid || '', qtd:+c.qtd || 1, unidade:c.unidade || 'UN', tk:c.tk || ''}] : [];
}
function cmpQtdTotal(c){ return cmpItens(c).reduce(function(s, i){ return s + (+i.qtd || 0); }, 0); }
// Cotações válidas: fornecedor + preço de todos os itens (ou total informado, nas importadas)
function cmpCotacoes(c){
  var itens = cmpItens(c);
  return [0, 1, 2].map(function(i){
    var q = (c.cotacoes || [])[i]; if(!q || !q.fornecedor) return null;
    var precos = q.precos || (q.preco != null ? [num(q.preco)] : []);
    var completo = itens.length && itens.every(function(it, j){ return num(precos[j]) > 0; });
    var total = completo ? itens.reduce(function(s, it, j){ return s + num(precos[j]) * (+it.qtd || 0); }, 0) + num(q.frete) : num(q.totalInformado);
    if(!(total > 0)) return null;
    return {i:i, fornecedor:q.fornecedor, precos:precos.map(num), frete:num(q.frete), total:total, prazoPgto:q.prazoPgto || '', prazoEntrega:q.prazoEntrega === 0 ? 0 : (q.prazoEntrega || ''), obs:q.obs || ''};
  }).filter(Boolean);
}
function cmpCalc(c){
  var qs = cmpCotacoes(c);
  var aprovada = c.aprovacao === 'aprovada' || ['pedido','recebida'].indexOf(cmpEtapa(c)) !== -1 || (cmpEtapa(c) === 'cancelada' && c.aprovadoEm && c.aprovacao === 'aprovada');
  var recIdx = c.recomendada != null ? c.recomendada : (c.aprovacao === 'aguardando' ? c.escolhida : null);
  var sel = qs.find(function(q){ return q.i === (aprovada ? c.escolhida : recIdx); }) || null;
  var tot = qs.map(function(q){ return q.total; });
  var maior = tot.length ? Math.max.apply(null, tot) : 0, menor = tot.length ? Math.min.apply(null, tot) : 0;
  var menorI = qs.length ? qs.reduce(function(a, b){ return b.total < a.total ? b : a; }).i : null;
  var economia = sel && qs.length >= 2 ? maior - sel.total : 0;
  return {qs:qs, sel:sel, aprovada:aprovada, recomendada:recIdx, escolhida:sel, total: sel ? sel.total : 0, maior:maior, menor:menor, menorI:menorI,
          economia:economia, economiaPct: sel && maior ? (maior - sel.total) / maior * 100 : 0, naoMenor: sel && sel.total > menor + 0.004};
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
  if(e === 'pedido'){ var d = daysUntil(c.entregaPrevista); return d != null && d < 0 ? '<span class="pill red">Pedido atrasado</span>' : '<span class="pill blue">Pedido emitido</span>'; }
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
    if(q){ var k = cmpCalc(c); if(norm([cmpNumero(c), cmpGrupo(c), cmpItens(c).map(function(i){ return i.item; }).join(' '), c.solicitante, nomeCentro(c.unidadeId), (c.cotacoes || []).map(function(x){ return x && x.fornecedor; }).join(' '), c.pedidoNumero, c.nf].join(' ')).indexOf(q) === -1) return false; }
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
    statCard('Economia no mês', fmtR(econMes), econMes ? 'teal' : '', 'vs. maior cotação');
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
  // agrupa por grupo
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
  var k = cmpCalc(c), e = cmpEtapa(c), dn = daysUntil(c.necessidade), de = daysUntil(c.entregaPrevista), itens = cmpItens(c);
  var chips = [0, 1, 2].map(function(i){ var q = k.qs.find(function(x){ return x.i === i; }); return q ? '<span class="q-chip'+(k.sel && k.sel.i === i ? ' win' : '')+'" title="'+esc(q.fornecedor)+'">'+fmtR(q.total)+'</span>' : '<span class="q-chip empty">—</span>'; }).join('');
  var necCls = c.necessidade && dn < 0 && ['recebida','cancelada','reprovada'].indexOf(e) === -1 ? 'qty-out' : '';
  var itTxt = itens.slice(0, 3).map(function(i){ return esc(fmtN(i.qtd) + '× ' + i.item + (i.tk ? ' (' + i.tk + ')' : '')); }).join('<br>') + (itens.length > 3 ? '<br><span style="color:var(--text-faint)">+ ' + (itens.length - 3) + ' item(ns)</span>' : '');
  return '<tr class="row-clickable" data-act="abrir-compra" data-id="'+c._id+'">' +
    '<td><span class="mono" style="color:var(--text)">'+cmpNumero(c)+'</span><span class="sub">'+fmtD(fmtISO(c.criadoEm))+' · '+esc(c.solicitante || '')+'</span></td>' +
    '<td class="wrap" style="font-size:12px">'+itTxt+(c.urgente ? ' <span class="pill red" style="padding:1px 7px;font-size:10.5px">Urgente</span>' : '')+'</td>' +
    '<td class="num">'+fmtN(cmpQtdTotal(c))+'<span class="sub">'+itens.length+' item(ns)</span></td>' +
    '<td>'+esc(nomeCentro(c.unidadeId))+'</td>' +
    '<td class="mono '+necCls+'">'+fmtD(c.necessidade)+'</td>' +
    '<td>'+chips+'</td>' +
    '<td>'+(k.sel ? esc(k.sel.fornecedor) + (k.aprovada ? '' : '<span class="sub">recomendada</span>') : '<span style="color:var(--text-faint)">—</span>')+'</td>' +
    '<td class="num">'+(k.sel ? fmtR(k.total) : '—')+'</td>' +
    '<td>'+esc(k.sel ? k.sel.prazoPgto || '—' : '—')+'</td>' +
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
    (novo ? '<div class="modal-sub">Junte numa solicitação os itens do mesmo grupo: os 3 fornecedores cotam todos juntos e o aprovador escolhe uma cotação.</div>' : '<div class="modal-sub">Solicitada por '+esc(c.solicitante || '—')+' em '+fmtDT(c.criadoEm)+(c.importada ? ' · importada do histórico' : '')+(e === 'cancelada' ? ' · <b style="color:var(--red)">Cancelada</b>' : '')+'</div>' + flow) +
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
    h += '<div class="section-label">Cotações '+(edCot ? '<span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-faint)">— cada fornecedor cota todos os itens; marque a recomendada</span>' : (podeAprovar ? '<span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--amber)">— aprove apenas uma</span>' : ''))+'</div>' +
      '<div class="quote-grid" id="c-quotes"></div><datalist id="dl-prazos">'+PRAZOS_PGTO.map(function(p){ return '<option value="'+p+'">'; }).join('')+'</datalist>' +
      '<div class="summary-bar" id="c-resumo"></div>' +
      '<div class="modal-field" id="c-motivo-box" style="display:none;margin-top:10px"><label>Motivo de recomendar uma cotação que não é a menor</label><input id="c-motivo" value="'+esc(c.motivoEscolha || '')+'" placeholder="Ex.: prazo de entrega, qualidade, histórico do fornecedor"'+dis(edCot)+'></div>' +
      '<div class="modal-field" id="c-menos3-box" style="display:none;margin-top:10px"><label>Por que menos de 3 cotações?</label><input id="c-menos3" value="'+esc(c.motivoMenos3 || '')+'" placeholder="Ex.: fornecedor exclusivo, item emergencial"'+dis(edCot)+'></div>';

    if(podeAprovar){
      h += '<div class="action-box"><h4>Sua aprovação</h4><div style="font-size:12.5px;color:var(--text-dim);margin-bottom:10px">Clique em <b>"Aprovar esta"</b> na cotação escolhida — só uma pode ser aprovada. O comprador recomendou a cotação '+((c.recomendada != null ? c.recomendada : c.escolhida) + 1)+'.</div>' +
        '<div class="modal-field"><label>Comentário (obrigatório para reprovar ou para aprovar outra que não a recomendada)</label><input id="c-coment"></div>' +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-danger" data-act="cmp-reprovar" data-id="'+id+'">Reprovar todas</button></div></div>';
    } else if(e === 'aguardando'){
      h += '<div class="action-box"><h4>Aguardando aprovação</h4><div style="font-size:12.5px;color:var(--text-dim)">Enviada por '+esc(c.enviadoPor || '—')+' em '+fmtDT(c.enviadoEm)+'. Um aprovador precisa aprovar uma das cotações ou reprovar.</div>' +
        (can('comprar') ? '<div class="modal-actions" style="margin-top:10px"><button class="btn" data-act="cmp-voltar-cotacao" data-id="'+id+'">Voltar para cotação</button></div>' : '') + '</div>';
    } else if(e === 'aprovada' && can('comprar')){
      var k0 = cmpCalc(c), prev = k0.sel && k0.sel.prazoEntrega !== '' ? addDays(today(), +k0.sel.prazoEntrega) : '';
      h += '<div class="action-box"><h4>Emitir pedido para '+esc(k0.sel ? k0.sel.fornecedor : '')+'</h4><div class="modal-grid three">' +
        field('Nº do pedido / OC', '<input id="c-ped" placeholder="Opcional">') + field('Data do pedido', '<input type="date" id="c-ped-data" value="'+today()+'">') +
        field('Entrega prevista', '<input type="date" id="c-prev" value="'+prev+'">') + '</div>' +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-primary" data-act="cmp-pedido" data-id="'+id+'">Registrar pedido</button></div></div>';
    } else if(e === 'pedido' && (can('comprar') || can('movimentar'))){
      var doEstoque = cmpItens(c).map(function(it, j){ return {it:it, j:j}; }).filter(function(x){ return x.it.pid && DB.produtos[x.it.pid]; });
      h += '<div class="action-box"><h4>Recebimento</h4><div class="modal-grid three">' +
        field('Data do recebimento', '<input type="date" id="c-rec" value="'+today()+'">') + field('Nota fiscal', '<input id="c-nf" placeholder="Nº da NF">') +
        field('Entrega prevista', '<input type="date" id="c-prev2" value="'+esc(c.entregaPrevista || '')+'">', '', '<a href="#" data-act="cmp-prev" data-id="'+id+'" style="color:var(--teal)">Salvar só a nova previsão</a>') + '</div>' +
        (doEstoque.length ? '<label class="modal-check"><input type="checkbox" id="c-entrada" checked> Dar entrada no estoque dos '+doEstoque.length+' item(ns) cadastrados</label>' +
             '<div id="c-entrada-box" style="margin-top:8px"><div class="modal-grid">' + field('Local', '<select id="c-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') + '</div>' +
             '<table class="items-table"><thead><tr><th>Produto</th><th class="num">Qtd</th><th>Tamanho</th></tr></thead><tbody>' + doEstoque.map(function(x){
               var tams = tamanhosProduto(x.it.pid).filter(function(t){ return t !== 'UN'; });
               return '<tr><td>'+esc(DB.produtos[x.it.pid].nome)+'</td><td class="num">'+fmtN(x.it.qtd)+'</td><td>'+(tams.length ? '<select class="c-rec-tam" data-j="'+x.j+'">'+tamOptions(x.it.pid, tamKey(x.it.tk), null, false)+'</select>' : '—')+'</td></tr>';
             }).join('') + '</tbody></table></div>'
           : '<div class="hint" style="margin-top:8px">Nenhum item está vinculado a um produto do estoque: o recebimento só encerra a compra.</div>') +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-primary" data-act="cmp-receber" data-id="'+id+'">Registrar recebimento</button></div></div>';
    } else if(e === 'reprovada'){
      h += '<div class="action-box" style="border-color:var(--red-soft)"><h4 style="color:var(--red)">Reprovada por '+esc(c.aprovadoPor || '—')+'</h4><div style="font-size:12.5px;color:var(--text-dim)">'+esc(c.comentarioAprov || 'Sem comentário')+'</div>' +
        (can('comprar') ? '<div class="hint" style="margin-top:6px">Ajuste as cotações e envie de novo para aprovação.</div>' : '') + '</div>';
    } else if(e === 'recebida' || e === 'pedido' || e === 'aprovada'){
      h += '<div class="info-grid" style="margin-top:14px"><div><div class="lbl">Aprovada por</div>'+esc(c.aprovadoPor || '—')+'<br><span class="mono">'+fmtDT(c.aprovadoEm)+'</span></div>' +
        '<div><div class="lbl">Pedido</div>'+esc(c.pedidoNumero || '—')+'<br><span class="mono">'+fmtD(c.pedidoData)+'</span></div>' +
        '<div><div class="lbl">Entrega prevista</div>'+fmtD(c.entregaPrevista)+'</div>' +
        '<div><div class="lbl">Recebida</div>'+(c.recebidoEm ? fmtD(c.recebidoEm) + (c.nf ? ' · NF ' + esc(c.nf) : '') + (c.entradaEstoque ? '<br><span class="pill teal" style="padding:1px 7px;font-size:10.5px">Entrou no estoque</span>' : '') : '—')+'</div></div>';
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
  box._cmp = {c:c, edSol:edSol, edCot:edCot, podeAprovar:podeAprovar, id:id};
  var itens = cmpItens(c);
  (itens.length ? itens : [{}]).forEach(function(it, j){ cmpAddItemRow(it, (c.cotacoes || []).map(function(q){ return q && (q.precos || (q.preco != null ? [q.preco] : []))[j]; })); });
  if(!novo){
    cmpRenderQuotes((c.cotacoes || []).map(function(q){ return !q ? {} : (!q.precos && q.preco != null ? Object.assign({}, q, {precos:[q.preco]}) : q); }));
    var ent = $('#c-entrada'); if(ent) ent.addEventListener('change', function(){ $('#c-entrada-box').style.display = ent.checked ? '' : 'none'; });
  }
}

// ----- linhas de itens -----
function cmpAddItemRow(it, precosIniciais){
  var st = $('#modal-box')._cmp, ed = st.edSol, dis = ed ? '' : ' disabled';
  it = it || {};
  var key = 'r' + (++cmpRowSeq), tr = document.createElement('tr');
  tr.dataset.k = key; tr._precos = precosIniciais || [];
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

// ----- cartões das 3 cotações (um preço por item) -----
function cmpRenderQuotes(cots){
  var st = $('#modal-box')._cmp, ed = st.edCot, dis = ed ? '' : ' disabled';
  var itens = cmpLerItens(), c = st.c;
  var recIdx = c.recomendada != null ? c.recomendada : (c.aprovacao === 'aguardando' ? c.escolhida : null);
  if(st._rec !== undefined) recIdx = st._rec;
  var aprovadaIdx = c.aprovacao === 'aprovada' || ['pedido','recebida'].indexOf(cmpEtapa(c)) !== -1 ? c.escolhida : null;
  $('#c-quotes').innerHTML = [0, 1, 2].map(function(i){
    var q = cots[i] || {};
    var precoDe = function(it, j){ if(q.precosPorK && q.precosPorK[it.k] != null) return q.precosPorK[it.k]; return (q.precos || [])[j]; };
    var head = '<div class="quote-head"><span>Cotação '+(i + 1)+'</span>' +
      (aprovadaIdx === i ? '<span class="pill teal" style="padding:1px 8px">Aprovada</span>' :
       ed ? '<label class="pick"><input type="radio" name="c-rec" value="'+i+'"'+(recIdx === i ? ' checked' : '')+'> Recomendada</label>' :
       recIdx === i ? '<span class="pill gray" style="padding:1px 8px">Recomendada</span>' : '') + '</div>';
    return '<div class="quote-card" data-q="'+i+'">' + head +
      '<div><label>Fornecedor</label><input class="q-forn" value="'+esc(q.fornecedor || '')+'"'+dis+'></div>' +
      '<div class="q-itens">' + itens.map(function(it, j){
        var pr = precoDe(it, j);
        return '<div class="q-item" data-k="'+it.k+'"><span title="'+esc(it.item)+'">'+esc((it.item || 'Item ' + (j + 1)).slice(0, 38))+(it.tk ? ' ('+esc(it.tk)+')' : '')+' <span style="color:var(--text-faint)">× '+fmtN(it.qtd)+'</span></span>' +
          '<input class="q-preco" data-k="'+it.k+'" inputmode="decimal" placeholder="R$ unit." value="'+(pr ? String(pr).replace('.', ',') : '')+'"'+dis+'></div>';
      }).join('') + (q.totalInformado && !itens.some(function(it, j){ return num(precoDe(it, j)) > 0; }) ? '<div class="hint">Total informado na importação: '+fmtR(q.totalInformado)+'</div>' : '') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Frete (R$)</label><input class="q-frete" inputmode="decimal" value="'+(q.frete ? String(q.frete).replace('.', ',') : '')+'"'+dis+'></div>' +
      '<div><label>Entrega (dias)</label><input class="q-ent" type="number" min="0" value="'+esc(q.prazoEntrega === 0 ? 0 : (q.prazoEntrega || ''))+'"'+dis+'></div></div>' +
      '<div><label>Prazo de pagamento</label><input class="q-pgto" list="dl-prazos" value="'+esc(q.prazoPgto || '')+'"'+dis+'></div>' +
      '<div><label>Observação</label><input class="q-obs" value="'+esc(q.obs || '')+'"'+dis+'></div>' +
      '<div class="quote-total">Total: <span class="q-tot">—</span></div>' +
      (st.podeAprovar ? '<button class="btn btn-primary btn-sm q-aprovar" data-act="cmp-aprovar" data-id="'+st.id+'" data-q="'+i+'">Aprovar esta</button>' : '') +
      '</div>';
  }).join('');
  $$('#c-quotes input:not([type=radio])').forEach(function(inp){ inp.addEventListener('input', cmpResumo); });
  $$('#c-quotes input[name=c-rec]').forEach(function(r){ r.addEventListener('change', function(){ st._rec = +r.value; st._recManual = true; cmpResumo(); }); });
  if(c.recomendada != null || c.escolhida != null) st._recManual = true;
  cmpResumo();
}
// Lê as cotações do formulário. porK=true mantém os preços presos a cada linha de item (para re-desenhar)
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
function cmpResumo(){
  var st = $('#modal-box')._cmp, itens = cmpLerItens(), cot = cmpLerCotacoesForm();
  var tmp = {itens: itens, cotacoes: cot, aprovacao: st.c.aprovacao, compra: st.c.compra, escolhida: st.c.escolhida, recomendada: st._rec != null ? st._rec : st.c.recomendada};
  var k0 = cmpCalc(tmp);
  // sem escolha manual, a recomendação acompanha a menor cotação
  if(st.edCot && !st._recManual && k0.menorI != null){ st._rec = k0.menorI; tmp.recomendada = k0.menorI; var r = $('#c-quotes input[name=c-rec][value="'+k0.menorI+'"]'); if(r) r.checked = true; }
  var k = cmpCalc(tmp);
  // menor preço de cada item fica destacado
  itens.forEach(function(it){
    var inps = $$('#c-quotes .q-preco[data-k="'+it.k+'"]'), vs = inps.map(function(i){ return num(i.value); }).filter(function(v){ return v > 0; });
    var mn = vs.length > 1 ? Math.min.apply(null, vs) : null;
    inps.forEach(function(i){ i.classList.toggle('best', mn != null && num(i.value) === mn); });
  });
  $$('#c-quotes .quote-card').forEach(function(card, i){
    var q = k.qs.find(function(x){ return x.i === i; });
    card.classList.toggle('win', !!(k.sel && k.sel.i === i));
    $('.q-tot', card).textContent = q ? fmtR(q.total) : '—';
    var b = $('.q-aprovar', card); if(b) b.disabled = !q;
  });
  $('#c-resumo').innerHTML =
    '<div><span class="lbl">'+(k.aprovada ? 'Fornecedor aprovado' : 'Recomendada')+'</span>'+(k.sel ? esc(k.sel.fornecedor) : '—')+'</div>' +
    '<div><span class="lbl">Total</span><b>'+(k.sel ? fmtR(k.total) : '—')+'</b></div>' +
    '<div><span class="lbl">Prazo de pagamento</span>'+(k.sel ? esc(k.sel.prazoPgto || '—') : '—')+'</div>' +
    '<div><span class="lbl">Entrega</span>'+(k.sel && k.sel.prazoEntrega !== '' ? k.sel.prazoEntrega + ' dias' : '—')+'</div>' +
    '<div><span class="lbl">Menor / maior cotação</span>'+(k.qs.length ? fmtR(k.menor) + ' / ' + fmtR(k.maior) : '—')+'</div>' +
    '<div><span class="lbl">Economia vs. maior</span><b class="'+(k.economia > 0 ? 'qty-in' : '')+'">'+(k.qs.length >= 2 && k.sel ? fmtR(k.economia) + ' (' + k.economiaPct.toFixed(1).replace('.', ',') + '%)' : '—')+'</b></div>' +
    '<div><span class="lbl">Cotações completas</span>'+k.qs.length+' de 3</div>';
  if($('#c-motivo-box')) $('#c-motivo-box').style.display = st.edCot && k.naoMenor ? '' : (st.c.motivoEscolha ? '' : 'none');
  if($('#c-menos3-box')) $('#c-menos3-box').style.display = (st.edCot && k.qs.length < 3 && k.qs.length > 0) || st.c.motivoMenos3 ? '' : 'none';
}

function cmpHist(paths, id, acao){ paths['compras/' + id + '/historico/' + store.key()] = {ts: nowTs(), usuario: currentUser.name, acao: acao}; return paths; }

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
  busy(btn, true);
  if(!id){
    return store.txn('config/seqCompra', function(cur){ return (+cur || 0) + 1; }).then(function(r){
      var nid = store.key(), p = {};
      p['compras/' + nid] = Object.assign(sol, {numero: r.value, criadoEm: nowTs(), solicitante: currentUser.name, aprovacao:'cotacao', compra:'pendente', cotacoes:[]});
      cmpHist(p, nid, 'Solicitação criada — ' + sol.grupo + ', ' + sol.itens.length + ' item(ns)');
      return save(p, 'Solicitação de compra', 'SC-' + String(r.value).padStart(4, '0') + ' ' + sol.grupo).then(function(){ return nid; });
    }).then(function(nid){ toast(can('comprar') ? 'Solicitação criada. Agora lance as 3 cotações.' : 'Solicitação criada.'); formCompra(nid); })
      .catch(function(e){ busy(btn, false); formError(e.message); });
  }
  var p = {};
  if(sol){ Object.keys(sol).forEach(function(k){ p['compras/' + id + '/' + k] = sol[k]; }); ['item','pid','qtd','unidade','tk'].forEach(function(k){ if(c[k] !== undefined) p['compras/' + id + '/' + k] = null; }); }
  var cots = null;
  if(st.edCot){
    cots = cmpLerCotacoesForm();
    p['compras/' + id + '/cotacoes'] = cots;
    p['compras/' + id + '/recomendada'] = st._rec != null ? st._rec : null;
    p['compras/' + id + '/motivoEscolha'] = $('#c-motivo').value.trim();
    p['compras/' + id + '/motivoMenos3'] = $('#c-menos3').value.trim();
  }
  if(enviar){
    var k = cmpCalc({itens: sol ? sol.itens : cmpItens(c), cotacoes: cots || c.cotacoes, recomendada: st._rec, aprovacao:'cotacao'});
    if(!k.qs.length){ busy(btn, false); return formError('Lance pelo menos uma cotação completa: fornecedor e preço de todos os itens.'); }
    if(k.qs.length < 3 && !$('#c-menos3').value.trim()){ busy(btn, false); return formError('São necessárias 3 cotações completas. Se não for possível, explique o motivo no campo indicado.'); }
    if(!k.sel){ busy(btn, false); return formError('Marque qual cotação você recomenda.'); }
    if(k.naoMenor && !$('#c-motivo').value.trim()){ busy(btn, false); return formError('A recomendada não é a mais barata: informe o motivo.'); }
    p['compras/' + id + '/aprovacao'] = 'aguardando';
    p['compras/' + id + '/escolhida'] = null;
    p['compras/' + id + '/enviadoPor'] = currentUser.name;
    p['compras/' + id + '/enviadoEm'] = nowTs();
    cmpHist(p, id, 'Enviada para aprovação — ' + k.qs.length + ' cotação(ões), recomendada ' + k.sel.fornecedor + ' ' + fmtR(k.total));
  } else cmpHist(p, id, 'Dados atualizados');
  save(p, enviar ? 'Compra enviada para aprovação' : 'Compra atualizada', cmpNumero(c)).then(function(){
    toast(enviar ? 'Enviada para aprovação.' : 'Salvo.'); if(enviar) closeModal(); else formCompra(id);
  }).catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['cmp-enviar'] = function(btn){ formHandlers['cmp-salvar'](btn, true); };

// O aprovador aprova UMA das 3 cotações
formHandlers['cmp-aprovar'] = function(btn){
  if(!can('aprovar')) return;
  var id = btn.dataset.id, c = DB.compras[id], qi = +btn.dataset.q, com = $('#c-coment').value.trim();
  var k = cmpCalc(Object.assign({}, c, {aprovacao:'aprovada', escolhida:qi}));
  if(!k.sel) return formError('Essa cotação está incompleta.');
  var rec = c.recomendada != null ? c.recomendada : null;
  if(rec != null && rec !== qi && !com) return formError('Você está aprovando uma cotação diferente da recomendada: escreva o motivo no comentário.');
  var p = {};
  p['compras/' + id + '/aprovacao'] = 'aprovada'; p['compras/' + id + '/escolhida'] = qi;
  p['compras/' + id + '/aprovadoPor'] = currentUser.name; p['compras/' + id + '/aprovadoEm'] = nowTs(); p['compras/' + id + '/comentarioAprov'] = com;
  cmpHist(p, id, 'Aprovada a cotação ' + (qi + 1) + ' — ' + k.sel.fornecedor + ' ' + fmtR(k.total) + (com ? ' — ' + com : ''));
  busy(btn, true);
  save(p, 'Compra aprovada', cmpNumero(c) + ' ' + k.sel.fornecedor + ' ' + fmtR(k.total)).then(function(){ closeModal(); toast(cmpNumero(c) + ' aprovada: ' + k.sel.fornecedor + '.'); });
};
formHandlers['cmp-reprovar'] = function(btn){
  if(!can('aprovar')) return;
  var id = btn.dataset.id, c = DB.compras[id], com = $('#c-coment').value.trim();
  if(!com) return formError('Escreva o motivo da reprovação.');
  var p = {}; p['compras/' + id + '/aprovacao'] = 'reprovada'; p['compras/' + id + '/escolhida'] = null; p['compras/' + id + '/aprovadoPor'] = currentUser.name; p['compras/' + id + '/aprovadoEm'] = nowTs(); p['compras/' + id + '/comentarioAprov'] = com;
  cmpHist(p, id, 'Reprovada — ' + com);
  busy(btn, true);
  save(p, 'Compra reprovada', cmpNumero(c) + ' — ' + com).then(function(){ closeModal(); toast(cmpNumero(c) + ' reprovada.'); });
};
formHandlers['cmp-voltar-cotacao'] = function(btn){
  var id = btn.dataset.id, p = {}; p['compras/' + id + '/aprovacao'] = 'cotacao'; cmpHist(p, id, 'Voltou para cotação');
  save(p, 'Compra voltou para cotação', cmpNumero(DB.compras[id])).then(function(){ formCompra(id); });
};
formHandlers['cmp-pedido'] = function(btn){
  if(!can('comprar')) return;
  var id = btn.dataset.id, c = DB.compras[id], prev = $('#c-prev').value;
  if(!prev) return formError('Informe a data prevista de entrega.');
  var p = {}; p['compras/' + id + '/compra'] = 'pedido'; p['compras/' + id + '/pedidoNumero'] = $('#c-ped').value.trim(); p['compras/' + id + '/pedidoData'] = $('#c-ped-data').value || today(); p['compras/' + id + '/entregaPrevista'] = prev;
  cmpHist(p, id, 'Pedido emitido' + ($('#c-ped').value.trim() ? ' nº ' + $('#c-ped').value.trim() : '') + ' — entrega prevista ' + fmtD(prev));
  busy(btn, true);
  save(p, 'Pedido de compra emitido', cmpNumero(c)).then(function(){ closeModal(); toast('Pedido registrado.'); });
};
formHandlers['cmp-prev'] = function(el){
  var id = el.dataset.id, v = $('#c-prev2').value; if(!v) return formError('Informe a nova data.');
  var p = {}; p['compras/' + id + '/entregaPrevista'] = v; cmpHist(p, id, 'Previsão de entrega alterada para ' + fmtD(v));
  save(p, 'Previsão de entrega alterada', cmpNumero(DB.compras[id])).then(function(){ toast('Previsão atualizada.'); formCompra(id); });
};
formHandlers['cmp-receber'] = function(btn){
  var id = btn.dataset.id, c = DB.compras[id], k = cmpCalc(c), data = $('#c-rec').value || today(), nf = $('#c-nf').value.trim();
  var entrar = $('#c-entrada') && $('#c-entrada').checked, loc = entrar ? $('#c-loc').value : '';
  if(entrar && !loc) return formError('Cadastre um local de estoque.');
  var itens = cmpItens(c), tams = {}; $$('.c-rec-tam').forEach(function(s){ tams[s.dataset.j] = s.value; });
  var ops = [], linhas = [];
  if(entrar) itens.forEach(function(it, j){ if(it.pid && DB.produtos[it.pid]){ var tk = tams[j] || tamKey(it.tk); ops.push({pid:it.pid, tk:tk, loc:loc, delta:+it.qtd}); linhas.push({it:it, j:j, tk:tk}); } });
  busy(btn, true);
  var antes = {}; linhas.forEach(function(l){ if(antes[l.it.pid] == null) antes[l.it.pid] = saldoProduto(l.it.pid); });
  (ops.length ? applyStock(ops) : Promise.resolve()).then(function(){
    var p = {};
    p['compras/' + id + '/compra'] = 'recebida'; p['compras/' + id + '/recebidoEm'] = data; p['compras/' + id + '/nf'] = nf; p['compras/' + id + '/entradaEstoque'] = ops.length > 0;
    var custos = {};
    linhas.forEach(function(l){
      var preco = k.sel ? num(k.sel.precos[l.j]) : 0;
      p['movimentos/' + store.key()] = movRecord({data:data, tipo:'entrada', pid:l.it.pid, tk:l.tk, loc:loc, qtd:+l.it.qtd, custoUnit:preco || undefined, doc:nf, fornecedor:k.sel ? k.sel.fornecedor : '', obs:'Compra ' + cmpNumero(c)});
      if(preco){ var cu = custos[l.it.pid] || (custos[l.it.pid] = {s: antes[l.it.pid], v: antes[l.it.pid] * (+DB.produtos[l.it.pid].custo || 0)}); cu.s += +l.it.qtd; cu.v += (+l.it.qtd) * preco; }
    });
    Object.keys(custos).forEach(function(pid){ var cu = custos[pid]; if(cu.s > 0) p['produtos/' + pid + '/custo'] = Math.round(cu.v / cu.s * 100) / 100; });
    cmpHist(p, id, 'Recebida' + (nf ? ' — NF ' + nf : '') + (ops.length ? ' · entrada de ' + ops.length + ' item(ns) no estoque' : ''));
    return save(p, 'Compra recebida', cmpNumero(c) + (ops.length ? ' + entrada no estoque' : ''));
  }).then(function(){ closeModal(); toast('Recebimento registrado' + (ops.length ? ' e saldo atualizado.' : '.')); })
    .catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['cmp-cancelar'] = function(btn){
  if(!confirmInline(btn, 'Confirmar cancelamento')) return;
  var id = btn.dataset.id, p = {}; p['compras/' + id + '/compra'] = 'cancelada'; cmpHist(p, id, 'Solicitação cancelada');
  save(p, 'Compra cancelada', cmpNumero(DB.compras[id])).then(function(){ closeModal(); toast('Solicitação cancelada.'); });
};

// Excel: uma linha por item, com o grupo e as 3 cotações
formHandlers['export-compras'] = function(){
  var rows = [];
  cmpFiltrar().forEach(function(c){
    var k = cmpCalc(c), qn = function(i){ var x = k.qs.find(function(z){ return z.i === i; }); return x ? x.fornecedor + ' — ' + fmtR(x.total) : ''; };
    cmpItens(c).forEach(function(it, j){
      rows.push({'Solicitação':cmpNumero(c), 'Grupo':cmpGrupo(c), 'Data':fmtD(fmtISO(c.criadoEm)), 'Solicitante':c.solicitante || '', 'Item':it.item, 'Tamanho':it.tk || '', 'Quantidade':+it.qtd, 'Unidade':it.unidade || '',
        'Centro / unidade':c.unidadeId ? nomeCentro(c.unidadeId) : '', 'Necessidade':fmtD(c.necessidade), 'Urgente':c.urgente ? 'Sim' : 'Não',
        'Cotação 1 (total)':qn(0), 'Cotação 2 (total)':qn(1), 'Cotação 3 (total)':qn(2),
        'Fornecedor escolhido':k.sel ? k.sel.fornecedor : '', 'Preço unitário':k.sel && k.sel.precos[j] ? k.sel.precos[j] : '', 'Preço do item':k.sel && k.sel.precos[j] ? Math.round(k.sel.precos[j] * it.qtd * 100) / 100 : '',
        'Total da compra':k.sel ? Math.round(k.total * 100) / 100 : '', 'Prazo de pagamento':k.sel ? k.sel.prazoPgto : '',
        'Economia da compra (R$)':Math.round(k.economia * 100) / 100,
        'Status da aprovação':({cotacao:'Em cotação', aguardando:'Aguardando aprovação', aprovada:'Aprovada', reprovada:'Reprovada'})[c.aprovacao || 'cotacao'], 'Aprovado por':c.aprovadoPor || '',
        'Status da compra':({pendente:'Não iniciada', pedido:'Pedido emitido', recebida:'Recebida', cancelada:'Cancelada'})[c.compra || 'pendente'], 'Nº pedido':c.pedidoNumero || '', 'Entrega prevista':fmtD(c.entregaPrevista), 'Recebida em':fmtD(c.recebidoEm), 'NF':c.nf || ''});
    });
  });
  exportXlsx('compras', rows);
};
