// =====================================================================
// COMPRAS — solicitação, 3 cotações, aprovação, pedido e recebimento
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
function cmpCotacoes(c){
  return (c.cotacoes || []).map(function(q, i){ return q && q.fornecedor && num(q.preco) > 0 ? {i:i, fornecedor:q.fornecedor, preco:num(q.preco), prazoPgto:q.prazoPgto || '', prazoEntrega:q.prazoEntrega || '', obs:q.obs || ''} : null; }).filter(Boolean);
}
function cmpCalc(c){
  var qs = cmpCotacoes(c), qtd = num(c.qtd) || 0;
  var esc_ = qs.find(function(q){ return q.i === c.escolhida; }) || null;
  var precos = qs.map(function(q){ return q.preco; });
  var maior = precos.length ? Math.max.apply(null, precos) : 0, menor = precos.length ? Math.min.apply(null, precos) : 0;
  var economia = esc_ && qs.length >= 2 ? (maior - esc_.preco) * qtd : 0;
  return {qs:qs, escolhida:esc_, total: esc_ ? esc_.preco * qtd : 0, maior:maior, menor:menor, economia:economia,
          economiaPct: esc_ && maior ? (maior - esc_.preco) / maior * 100 : 0, naoMenor: esc_ && esc_.preco > menor};
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
function cmpFiltrar(){
  var q = norm(($('#cmp-busca') || {}).value), un = ($('#cmp-unidade') || {}).value;
  return vals(DB.compras).filter(function(c){
    var e = cmpEtapa(c);
    if(cmpFiltro === 'andamento' && ['recebida','reprovada','cancelada'].indexOf(e) !== -1) return false;
    if(cmpFiltro === 'encerradas' && e !== 'reprovada' && e !== 'cancelada') return false;
    if(['cotacao','aguardando','aprovada','pedido','recebida'].indexOf(cmpFiltro) !== -1 && e !== cmpFiltro) return false;
    if(un && c.unidadeId !== un) return false;
    if(q){ var k = cmpCalc(c); if(norm([cmpNumero(c), c.item, c.solicitante, nomeCentro(c.unidadeId), k.escolhida ? k.escolhida.fornecedor : '', (c.cotacoes || []).map(function(x){ return x && x.fornecedor; }).join(' '), c.pedidoNumero].join(' ')).indexOf(q) === -1) return false; }
    return true;
  }).sort(function(a, b){ return (b.numero || 0) - (a.numero || 0); });
}

// =====================================================================
// TELA
// =====================================================================
function renderCompras(){
  var all = vals(DB.compras), ini = today().slice(0, 8) + '01';
  var cont = {}; all.forEach(function(c){ var e = cmpEtapa(c); cont[e] = (cont[e] || 0) + 1; });
  var andamento = all.length - (cont.recebida || 0) - (cont.reprovada || 0) - (cont.cancelada || 0);
  var atrasados = all.filter(function(c){ return cmpEtapa(c) === 'pedido' && daysUntil(c.entregaPrevista) < 0; }).length;
  var econMes = 0, valorMes = 0;
  all.forEach(function(c){ if(c.aprovadoEm && fmtISO(c.aprovadoEm) >= ini && ['aprovada','pedido','recebida'].indexOf(cmpEtapa(c)) !== -1){ var k = cmpCalc(c); econMes += k.economia; valorMes += k.total; } });
  $('#cmp-stats').innerHTML =
    statCard('Em cotação', fmtN(cont.cotacao || 0), '', (cont.reprovada || 0) + ' reprovada(s)') +
    statCard('Aguardando aprovação', fmtN(cont.aguardando || 0), cont.aguardando ? 'amber' : '', can('aprovar') && cont.aguardando ? 'sua aprovação' : '') +
    statCard('Pedidos em aberto', fmtN((cont.aprovada || 0) + (cont.pedido || 0)), atrasados ? 'red' : '', atrasados ? atrasados + ' atrasado(s)' : (cont.aprovada || 0) + ' a emitir') +
    statCard('Aprovado no mês', fmtR(valorMes), '', 'valor das compras aprovadas') +
    statCard('Economia no mês', fmtR(econMes), econMes ? 'teal' : '', 'vs. maior cotação');
  var cnt = {andamento:andamento, encerradas:(cont.reprovada || 0) + (cont.cancelada || 0), todas:all.length};
  $('#cmp-etapas').innerHTML = CMP_ETAPAS.map(function(e){
    var n = cnt[e.id] != null ? cnt[e.id] : (cont[e.id] || 0);
    return '<span class="stage'+(cmpFiltro === e.id ? ' active' : '')+'" data-act="cmp-filtro" data-id="'+e.id+'">'+e.label+' <span class="n">'+n+'</span></span>';
  }).join('');
  $$('.need-solicitar').forEach(function(b){ b.disabled = !can('solicitar'); });
  var list = cmpFiltrar();
  if(!list.length){ $('#cmp-table').innerHTML = emptyState(all.length ? 'Nenhuma solicitação nesta etapa.' : 'Nenhuma solicitação de compra ainda. Clique em "+ Nova solicitação" para começar.'); return; }
  $('#cmp-table').innerHTML = '<table><thead><tr><th>Solicitação</th><th>Item</th><th class="num">Qtd</th><th>Centro / unidade</th><th>Necessidade</th><th>3 cotações</th><th>Fornecedor escolhido</th><th class="num">Preço</th><th>Prazo pgto</th><th class="num">Economia</th><th>Aprovação</th><th>Compra</th><th>Entrega prevista</th></tr></thead><tbody>' +
    list.map(function(c){
      var k = cmpCalc(c), e = cmpEtapa(c), dn = daysUntil(c.necessidade), de = daysUntil(c.entregaPrevista);
      var chips = [0, 1, 2].map(function(i){ var q = k.qs.find(function(x){ return x.i === i; }); return q ? '<span class="q-chip'+(c.escolhida === i ? ' win' : '')+'" title="'+esc(q.fornecedor)+'">'+fmtR(q.preco)+'</span>' : '<span class="q-chip empty">—</span>'; }).join('');
      var necCls = c.necessidade && dn < 0 && ['recebida','cancelada','reprovada'].indexOf(e) === -1 ? 'qty-out' : '';
      return '<tr class="row-clickable" data-act="abrir-compra" data-id="'+c._id+'">' +
        '<td><span class="mono" style="color:var(--text)">'+cmpNumero(c)+'</span><span class="sub">'+fmtD(fmtISO(c.criadoEm))+' · '+esc(c.solicitante || '')+'</span></td>' +
        '<td class="wrap">'+esc(c.item)+(c.urgente ? ' <span class="pill red" style="padding:1px 7px;font-size:10.5px">Urgente</span>' : '')+'</td>' +
        '<td class="num">'+fmtN(c.qtd)+' <span style="color:var(--text-faint)">'+esc(c.unidade || '')+'</span></td>' +
        '<td>'+esc(nomeCentro(c.unidadeId))+'</td>' +
        '<td class="mono '+necCls+'">'+fmtD(c.necessidade)+'</td>' +
        '<td>'+chips+'</td>' +
        '<td>'+(k.escolhida ? esc(k.escolhida.fornecedor) : '<span style="color:var(--text-faint)">—</span>')+'</td>' +
        '<td class="num">'+(k.escolhida ? fmtR(k.total)+'<span class="sub">'+fmtR(k.escolhida.preco)+' / '+esc(c.unidade || 'un')+'</span>' : '—')+'</td>' +
        '<td>'+esc(k.escolhida ? k.escolhida.prazoPgto || '—' : '—')+'</td>' +
        '<td class="num '+(k.economia > 0 ? 'qty-in' : '')+'">'+(k.economia > 0 ? fmtR(k.economia)+'<span class="sub">'+k.economiaPct.toFixed(1).replace('.', ',')+'%</span>' : '—')+'</td>' +
        '<td>'+cmpAprovPill(c)+'</td><td>'+cmpCompraPill(c)+'</td>' +
        '<td class="mono '+(e === 'pedido' && de < 0 ? 'qty-out' : '')+'">'+(e === 'recebida' ? '<span class="qty-in">'+fmtD(c.recebidoEm)+'</span><span class="sub">recebida</span>' : fmtD(c.entregaPrevista))+'</td></tr>';
    }).join('') + '</tbody></table><div class="tbl-foot">'+list.length+' solicitação(ões) · clique numa linha para ver, cotar, aprovar ou registrar o pedido</div>';
}
function fmtISO(ts){ if(!ts) return ''; var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
formHandlers['cmp-filtro'] = function(el){ cmpFiltro = el.dataset.id; renderCompras(); };

// =====================================================================
// MODAL DA SOLICITAÇÃO (um formulário só, que muda conforme a etapa)
// =====================================================================
formHandlers['nova-compra'] = function(el){ formCompra(null, el && el.dataset.id); };
formHandlers['abrir-compra'] = function(el){ formCompra(el.dataset.id); };

function formCompra(id, pidPrefill){
  if(!id && !can('solicitar')) return;
  var c = id ? DB.compras[id] : null;
  if(id && !c) return;
  var novo = !c;
  if(novo){
    var pp = pidPrefill ? DB.produtos[pidPrefill] : null;
    c = {item: pp ? pp.nome : '', pid: pp ? pidPrefill : '', qtd: pp && +pp.estoqueMinimo ? Math.max(1, (+pp.estoqueMinimo) - saldoProduto(pidPrefill)) : 1, unidade: pp ? (pp.unidade || 'UN') : 'UN', cotacoes:[]};
  }
  var e = novo ? 'cotacao' : cmpEtapa(c);
  var edSol = novo || cmpPodeEditarSolic(c), edCot = !novo && (e === 'cotacao' || e === 'reprovada') && can('comprar');
  var dis = function(b){ return b ? '' : ' disabled'; };

  // Linha do tempo do processo
  var passos = ['Solicitação','Cotação','Aprovação','Pedido','Recebimento'];
  var at = {cotacao:1, aguardando:2, reprovada:2, aprovada:3, pedido:4, recebida:5, cancelada:-1}[e];
  var flow = '<div class="flow">' + passos.map(function(p, i){
    var cls = e === 'cancelada' ? '' : (i < at ? 'done' : (i === at ? (e === 'reprovada' ? 'bad' : 'now') : ''));
    if(e === 'recebida') cls = 'done';
    return '<div class="flow-step '+cls+'">'+(i === 2 && e === 'reprovada' ? 'Reprovada' : p)+'</div>';
  }).join('') + '</div>';

  var h = '<div class="modal-title">'+(novo ? 'Nova solicitação de compra' : cmpNumero(c) + ' — ' + esc(c.item))+'</div>' +
    (novo ? '' : '<div class="modal-sub">Solicitada por '+esc(c.solicitante || '—')+' em '+fmtDT(c.criadoEm)+(e === 'cancelada' ? ' · <b style="color:var(--red)">Cancelada</b>' : '')+'</div>' + flow) +
    '<div class="section-label" style="margin-top:0">Solicitação</div><div class="modal-grid three">' +
      field('Item', '<input id="c-item" list="dl-produtos" value="'+esc(c.item || '')+'" placeholder="Produto do estoque ou descrição livre"'+dis(edSol)+'>', 'full', 'Se for um produto do estoque, escolha da lista: no recebimento ele entra no saldo automaticamente.') +
      field('Quantidade', '<input type="number" id="c-qtd" min="1" step="1" value="'+esc(c.qtd || 1)+'"'+dis(edSol)+'>') +
      field('Unidade', '<select id="c-un"'+dis(edSol)+'>'+optList(unidadesOpts(c.unidade), (c.unidade || 'UN').toUpperCase())+'</select>') +
      field('Centro / unidade', '<select id="c-unid"'+dis(edSol)+'>'+centrosOptsHtml(c.unidadeId)+'</select>', '', 'Cliente ou empresa que vai usar o item') +
      field('Necessário até', '<input type="date" id="c-nec" value="'+esc(c.necessidade || '')+'"'+dis(edSol)+'>') +
      field('Prioridade', '<select id="c-urg"'+dis(edSol)+'>'+optList([['0','Normal'],['1','Urgente']], c.urgente ? '1' : '0')+'</select>') +
      field('Justificativa / necessidade', '<input id="c-just" value="'+esc(c.justificativa || '')+'" placeholder="Para que e por que precisa"'+dis(edSol)+'>') +
    '</div>';

  if(!novo){
    h += '<div class="section-label">Cotações '+(edCot ? '<span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-faint)">— preencha as 3 e marque a escolhida</span>' : '')+'</div><div class="quote-grid">' +
      [0, 1, 2].map(function(i){
        var q = (c.cotacoes || [])[i] || {};
        return '<div class="quote-card" data-q="'+i+'"><div class="quote-head"><span>Cotação '+(i + 1)+'</span><label class="pick"><input type="radio" name="c-win" value="'+i+'"'+(c.escolhida === i ? ' checked' : '')+dis(edCot)+'> Escolhida</label></div>' +
          '<div><label>Fornecedor</label><input class="q-forn" value="'+esc(q.fornecedor || '')+'"'+dis(edCot)+'></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Preço unitário (R$)</label><input class="q-preco" inputmode="decimal" value="'+(q.preco ? String(q.preco).replace('.', ',') : '')+'"'+dis(edCot)+'></div>' +
          '<div><label>Entrega (dias)</label><input class="q-ent" type="number" min="0" value="'+esc(q.prazoEntrega || '')+'"'+dis(edCot)+'></div></div>' +
          '<div><label>Prazo de pagamento</label><input class="q-pgto" list="dl-prazos" value="'+esc(q.prazoPgto || '')+'"'+dis(edCot)+'></div>' +
          '<div><label>Observação</label><input class="q-obs" value="'+esc(q.obs || '')+'"'+dis(edCot)+'></div>' +
          '<div class="quote-total">Total: <span class="q-tot">—</span></div></div>';
      }).join('') + '</div><datalist id="dl-prazos">'+PRAZOS_PGTO.map(function(p){ return '<option value="'+p+'">'; }).join('')+'</datalist>' +
      '<div class="summary-bar" id="c-resumo"></div>' +
      '<div class="modal-field" id="c-motivo-box" style="display:none;margin-top:10px"><label>Motivo de não escolher a menor cotação</label><input id="c-motivo" value="'+esc(c.motivoEscolha || '')+'" placeholder="Ex.: prazo de entrega, qualidade, histórico do fornecedor"'+dis(edCot)+'></div>' +
      '<div class="modal-field" id="c-menos3-box" style="display:none;margin-top:10px"><label>Por que menos de 3 cotações?</label><input id="c-menos3" value="'+esc(c.motivoMenos3 || '')+'" placeholder="Ex.: fornecedor exclusivo, item emergencial"'+dis(edCot)+'></div>';

    // Caixa de ação conforme a etapa
    if(e === 'aguardando' && can('aprovar')){
      h += '<div class="action-box"><h4>Sua aprovação</h4><div class="modal-field"><label>Comentário (obrigatório para reprovar)</label><input id="c-coment" placeholder="Opcional para aprovar"></div>' +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-danger" data-act="cmp-reprovar" data-id="'+id+'">Reprovar</button><button class="btn btn-primary" data-act="cmp-aprovar" data-id="'+id+'">Aprovar compra</button></div></div>';
    } else if(e === 'aguardando'){
      h += '<div class="action-box"><h4>Aguardando aprovação</h4><div style="font-size:12.5px;color:var(--text-dim)">Enviada por '+esc(c.enviadoPor || '—')+' em '+fmtDT(c.enviadoEm)+'. Um aprovador precisa aprovar ou reprovar.</div>' +
        (can('comprar') ? '<div class="modal-actions" style="margin-top:10px"><button class="btn" data-act="cmp-voltar-cotacao" data-id="'+id+'">Voltar para cotação</button></div>' : '') + '</div>';
    } else if(e === 'aprovada' && can('comprar')){
      var k0 = cmpCalc(c), prev = k0.escolhida && k0.escolhida.prazoEntrega ? addDays(today(), +k0.escolhida.prazoEntrega) : '';
      h += '<div class="action-box"><h4>Emitir pedido</h4><div class="modal-grid three">' +
        field('Nº do pedido / OC', '<input id="c-ped" placeholder="Opcional">') + field('Data do pedido', '<input type="date" id="c-ped-data" value="'+today()+'">') +
        field('Entrega prevista', '<input type="date" id="c-prev" value="'+prev+'">') + '</div>' +
        '<div class="modal-actions" style="margin-top:12px"><button class="btn btn-primary" data-act="cmp-pedido" data-id="'+id+'">Registrar pedido</button></div></div>';
    } else if(e === 'pedido' && (can('comprar') || can('movimentar'))){
      var p = c.pid ? DB.produtos[c.pid] : null;
      h += '<div class="action-box"><h4>Recebimento</h4><div class="modal-grid three">' +
        field('Data do recebimento', '<input type="date" id="c-rec" value="'+today()+'">') + field('Nota fiscal', '<input id="c-nf" placeholder="Nº da NF">') +
        field('Entrega prevista', '<input type="date" id="c-prev2" value="'+esc(c.entregaPrevista || '')+'">', '', '<a href="#" data-act="cmp-prev" data-id="'+id+'" style="color:var(--teal)">Salvar só a nova previsão</a>') + '</div>' +
        (p ? '<label class="modal-check"><input type="checkbox" id="c-entrada" checked> Dar entrada de '+fmtN(c.qtd)+' '+esc(c.unidade || '')+' de <b>'+esc(p.nome)+'</b> no estoque</label>' +
             '<div class="modal-grid" id="c-entrada-box" style="margin-top:8px">' + field('Local', '<select id="c-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') +
             (tamanhosProduto(c.pid).filter(function(t){ return t !== 'UN'; }).length ? field('Tamanho', '<select id="c-tam">'+tamOptions(c.pid, '', null, false)+'</select>', '', 'Para vários tamanhos, use Estoque → Entrada.') : '') + '</div>'
           : '<div class="hint" style="margin-top:8px">Item não vinculado a um produto do estoque: o recebimento só encerra a compra.</div>') +
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

  // Botões do rodapé
  var left = '', right = '';
  if(!novo && ['cotacao','reprovada','aguardando','aprovada'].indexOf(e) !== -1 && (can('comprar') || (c.solicitante === currentUser.name && e === 'cotacao')))
    left = '<button class="btn btn-danger" data-act="cmp-cancelar" data-id="'+id+'" style="margin-right:auto">Cancelar solicitação</button>';
  if(novo) right = '<button class="btn btn-primary" data-act="cmp-salvar">Criar solicitação</button>';
  else if(edSol || edCot){
    right = '<button class="btn" data-act="cmp-salvar" data-id="'+id+'">Salvar</button>';
    if(can('comprar')) right += '<button class="btn btn-primary" data-act="cmp-enviar" data-id="'+id+'">Enviar para aprovação</button>';
  }
  h += '<div id="form-error" class="form-error"></div><div class="modal-actions">'+left+'<button class="btn btn-ghost" data-act="fechar">'+(right ? 'Fechar' : 'Fechar')+'</button>'+right+'</div>';
  if(id) h += '<input type="hidden" id="c-id" value="'+id+'">';
  openModal(h, 'xwide');

  if(!novo){
    var upd = function(){ cmpResumo(c); };
    $$('#modal-box .quote-card input:not([type=radio])').forEach(function(i){ i.addEventListener('input', upd); i.addEventListener('change', upd); });
    $$('#modal-box input[name=c-win]').forEach(function(r){
      if(c.escolhida != null) r.dataset.manual = '1';
      r.addEventListener('change', function(){ $$('#modal-box input[name=c-win]').forEach(function(x){ x.dataset.manual = '1'; }); upd(); });
    });
    $('#c-qtd').addEventListener('input', upd);
    upd();
    var ent = $('#c-entrada'); if(ent) ent.addEventListener('change', function(){ $('#c-entrada-box').style.display = ent.checked ? '' : 'none'; });
  }
  var it = $('#c-item');
  if(it && edSol) it.addEventListener('change', function(){ var pid = findProdByLabel(it.value); if(pid){ it.value = DB.produtos[pid].nome; $('#c-un').innerHTML = optList(unidadesOpts(DB.produtos[pid].unidade), (DB.produtos[pid].unidade || 'UN').toUpperCase()); } });
}

// Lê as 3 cotações do formulário
function cmpLerCotacoes(){
  return $$('#modal-box .quote-card').map(function(card){
    return {fornecedor: $('.q-forn', card).value.trim(), preco: num($('.q-preco', card).value), prazoEntrega: $('.q-ent', card).value ? Math.max(0, Math.floor(num($('.q-ent', card).value))) : '', prazoPgto: $('.q-pgto', card).value.trim(), obs: $('.q-obs', card).value.trim()};
  });
}
function cmpEscolhidaForm(){ var r = $('#modal-box input[name=c-win]:checked'); return r ? +r.value : null; }

// Atualiza totais, economia e destaque enquanto digita
function cmpResumo(c){
  var cot = cmpLerCotacoes(), qtd = Math.floor(num($('#c-qtd').value)) || 0;
  var esc_ = cmpEscolhidaForm();
  var validas = cot.map(function(q, i){ return q.fornecedor && q.preco > 0 ? i : -1; }).filter(function(i){ return i >= 0; });
  // enquanto a pessoa não escolher na mão, a sugestão acompanha a menor cotação
  var radios = $$('#modal-box input[name=c-win]'), manual = radios.some(function(r){ return r.dataset.manual; });
  if(!manual && validas.length && !radios[0].disabled){
    var menorI = validas.reduce(function(a, b){ return cot[b].preco < cot[a].preco ? b : a; });
    var r = $('#modal-box input[name=c-win][value="'+menorI+'"]'); if(r){ r.checked = true; esc_ = menorI; }
  }
  $$('#modal-box .quote-card').forEach(function(card, i){
    card.classList.toggle('win', esc_ === i);
    $('.q-tot', card).textContent = cot[i].preco > 0 ? fmtR(cot[i].preco * qtd) : '—';
  });
  var k = cmpCalc({cotacoes:cot, escolhida:esc_, qtd:qtd});
  $('#c-resumo').innerHTML =
    '<div><span class="lbl">Fornecedor escolhido</span>'+(k.escolhida ? esc(k.escolhida.fornecedor) : '—')+'</div>' +
    '<div><span class="lbl">Preço total</span><b>'+(k.escolhida ? fmtR(k.total) : '—')+'</b></div>' +
    '<div><span class="lbl">Prazo de pagamento</span>'+(k.escolhida ? esc(k.escolhida.prazoPgto || '—') : '—')+'</div>' +
    '<div><span class="lbl">Entrega</span>'+(k.escolhida && k.escolhida.prazoEntrega !== '' ? k.escolhida.prazoEntrega + ' dias' : '—')+'</div>' +
    '<div><span class="lbl">Economia vs. maior cotação</span><b class="'+(k.economia > 0 ? 'qty-in' : '')+'">'+(k.qs.length >= 2 && k.escolhida ? fmtR(k.economia) + ' (' + k.economiaPct.toFixed(1).replace('.', ',') + '%)' : '—')+'</b></div>' +
    '<div><span class="lbl">Cotações válidas</span>'+k.qs.length+' de 3</div>';
  $('#c-motivo-box').style.display = k.naoMenor ? '' : 'none';
  $('#c-menos3-box').style.display = k.qs.length < 3 && k.qs.length > 0 ? '' : 'none';
}

function cmpHist(paths, id, acao){ paths['compras/' + id + '/historico/' + store.key()] = {ts: nowTs(), usuario: currentUser.name, acao: acao}; return paths; }

// Coleta os campos da solicitação (valida)
function cmpLerSolicitacao(){
  var item = $('#c-item').value.trim(); if(!item){ formError('Informe o item.'); return null; }
  var qtd = Math.floor(num($('#c-qtd').value)); if(qtd <= 0){ formError('Quantidade inválida.'); return null; }
  var pid = findProdByLabel(item) || '';
  return {item: pid ? DB.produtos[pid].nome : item, pid: pid, qtd: qtd, unidade: $('#c-un').value, unidadeId: $('#c-unid').value, necessidade: $('#c-nec').value, urgente: $('#c-urg').value === '1', justificativa: $('#c-just').value.trim()};
}

formHandlers['cmp-salvar'] = function(btn, enviar){
  var id = btn.dataset.id, c = id ? DB.compras[id] : null;
  var sol = $('#c-item').disabled ? null : cmpLerSolicitacao();
  if(!$('#c-item').disabled && !sol) return;
  busy(btn, true);
  if(!id){
    return store.txn('config/seqCompra', function(cur){ return (+cur || 0) + 1; }).then(function(r){
      var nid = store.key(), p = {};
      p['compras/' + nid] = Object.assign(sol, {numero: r.value, criadoEm: nowTs(), solicitante: currentUser.name, aprovacao:'cotacao', compra:'pendente', cotacoes:[]});
      cmpHist(p, nid, 'Solicitação criada');
      return save(p, 'Solicitação de compra', 'SC-' + String(r.value).padStart(4, '0') + ' ' + sol.item).then(function(){ return nid; });
    }).then(function(nid){ toast('Solicitação criada. Agora é só lançar as cotações.'); formCompra(nid); })
      .catch(function(e){ busy(btn, false); formError(e.message); });
  }
  var p = {};
  if(sol) Object.keys(sol).forEach(function(k){ p['compras/' + id + '/' + k] = sol[k]; });
  var temCot = $('#modal-box .q-forn') && !$('#modal-box .q-forn').disabled;
  if(temCot){
    p['compras/' + id + '/cotacoes'] = cmpLerCotacoes();
    var w = cmpEscolhidaForm(); p['compras/' + id + '/escolhida'] = w == null ? null : w;
    p['compras/' + id + '/motivoEscolha'] = $('#c-motivo').value.trim();
    p['compras/' + id + '/motivoMenos3'] = $('#c-menos3').value.trim();
  }
  if(enviar){
    var k = cmpCalc({cotacoes: p['compras/' + id + '/cotacoes'] || c.cotacoes, escolhida: temCot ? p['compras/' + id + '/escolhida'] : c.escolhida, qtd: sol ? sol.qtd : c.qtd});
    if(!k.qs.length){ busy(btn, false); return formError('Lance pelo menos uma cotação com fornecedor e preço.'); }
    if(k.qs.length < 3 && !$('#c-menos3').value.trim()){ busy(btn, false); return formError('São necessárias 3 cotações. Se não for possível, explique o motivo no campo indicado.'); }
    if(!k.escolhida){ busy(btn, false); return formError('Marque qual cotação foi escolhida.'); }
    if(k.naoMenor && !$('#c-motivo').value.trim()){ busy(btn, false); return formError('A escolhida não é a mais barata: informe o motivo.'); }
    p['compras/' + id + '/aprovacao'] = 'aguardando';
    p['compras/' + id + '/enviadoPor'] = currentUser.name;
    p['compras/' + id + '/enviadoEm'] = nowTs();
    cmpHist(p, id, 'Enviada para aprovação — ' + k.escolhida.fornecedor + ' ' + fmtR(k.total));
  } else cmpHist(p, id, 'Dados atualizados');
  save(p, enviar ? 'Compra enviada para aprovação' : 'Compra atualizada', cmpNumero(c)).then(function(){
    toast(enviar ? 'Enviada para aprovação.' : 'Salvo.'); if(enviar) closeModal(); else formCompra(id);
  }).catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['cmp-enviar'] = function(btn){ formHandlers['cmp-salvar'](btn, true); };

formHandlers['cmp-aprovar'] = function(btn){
  if(!can('aprovar')) return;
  var id = btn.dataset.id, c = DB.compras[id], k = cmpCalc(c), com = $('#c-coment').value.trim(), p = {};
  p['compras/' + id + '/aprovacao'] = 'aprovada'; p['compras/' + id + '/aprovadoPor'] = currentUser.name; p['compras/' + id + '/aprovadoEm'] = nowTs(); p['compras/' + id + '/comentarioAprov'] = com;
  cmpHist(p, id, 'Aprovada' + (com ? ' — ' + com : ''));
  busy(btn, true);
  save(p, 'Compra aprovada', cmpNumero(c) + ' ' + fmtR(k.total)).then(function(){ closeModal(); toast(cmpNumero(c) + ' aprovada.'); });
};
formHandlers['cmp-reprovar'] = function(btn){
  if(!can('aprovar')) return;
  var id = btn.dataset.id, c = DB.compras[id], com = $('#c-coment').value.trim();
  if(!com) return formError('Escreva o motivo da reprovação.');
  var p = {}; p['compras/' + id + '/aprovacao'] = 'reprovada'; p['compras/' + id + '/aprovadoPor'] = currentUser.name; p['compras/' + id + '/aprovadoEm'] = nowTs(); p['compras/' + id + '/comentarioAprov'] = com;
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
  var entrar = $('#c-entrada') && $('#c-entrada').checked && c.pid && DB.produtos[c.pid];
  var loc = entrar ? $('#c-loc').value : '', tk = entrar && $('#c-tam') ? $('#c-tam').value : 'UN';
  if(entrar && !loc) return formError('Cadastre um local de estoque.');
  busy(btn, true);
  var pr = entrar ? DB.produtos[c.pid] : null, saldoAntes = entrar ? saldoProduto(c.pid) : 0;
  (entrar ? applyStock([{pid:c.pid, tk:tk, loc:loc, delta:+c.qtd}]) : Promise.resolve()).then(function(){
    var p = {};
    p['compras/' + id + '/compra'] = 'recebida'; p['compras/' + id + '/recebidoEm'] = data; p['compras/' + id + '/nf'] = nf; p['compras/' + id + '/entradaEstoque'] = !!entrar;
    if(entrar){
      var preco = k.escolhida ? k.escolhida.preco : 0;
      p['movimentos/' + store.key()] = movRecord({data:data, tipo:'entrada', pid:c.pid, tk:tk, loc:loc, qtd:+c.qtd, custoUnit:preco || undefined, doc:nf, fornecedor:k.escolhida ? k.escolhida.fornecedor : '', obs:'Compra ' + cmpNumero(c)});
      if(preco){ var tot = saldoAntes + (+c.qtd); if(tot > 0) p['produtos/' + c.pid + '/custo'] = Math.round((saldoAntes * (+pr.custo || 0) + (+c.qtd) * preco) / tot * 100) / 100; }
    }
    cmpHist(p, id, 'Recebida' + (nf ? ' — NF ' + nf : '') + (entrar ? ' · entrada no estoque' : ''));
    return save(p, 'Compra recebida', cmpNumero(c) + (entrar ? ' + entrada no estoque' : ''));
  }).then(function(){ closeModal(); toast('Recebimento registrado' + (entrar ? ' e saldo atualizado.' : '.')); })
    .catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['cmp-cancelar'] = function(btn){
  if(!confirmInline(btn, 'Confirmar cancelamento')) return;
  var id = btn.dataset.id, p = {}; p['compras/' + id + '/compra'] = 'cancelada'; cmpHist(p, id, 'Solicitação cancelada');
  save(p, 'Compra cancelada', cmpNumero(DB.compras[id])).then(function(){ closeModal(); toast('Solicitação cancelada.'); });
};

formHandlers['export-compras'] = function(){
  exportXlsx('compras', cmpFiltrar().map(function(c){
    var k = cmpCalc(c), q = function(i){ var x = k.qs.find(function(z){ return z.i === i; }); return x ? x.fornecedor + ' — ' + fmtR(x.preco) : ''; };
    return {'Solicitação':cmpNumero(c), 'Data':fmtD(fmtISO(c.criadoEm)), 'Solicitante':c.solicitante || '', 'Item':c.item, 'Quantidade':+c.qtd, 'Unidade':c.unidade || '', 'Centro / unidade':c.unidadeId ? nomeCentro(c.unidadeId) : '',
      'Necessidade':fmtD(c.necessidade), 'Urgente':c.urgente ? 'Sim' : 'Não', 'Justificativa':c.justificativa || '', 'Cotação 1':q(0), 'Cotação 2':q(1), 'Cotação 3':q(2),
      'Fornecedor escolhido':k.escolhida ? k.escolhida.fornecedor : '', 'Preço unitário':k.escolhida ? k.escolhida.preco : '', 'Preço total':k.escolhida ? Math.round(k.total * 100) / 100 : '', 'Prazo de pagamento':k.escolhida ? k.escolhida.prazoPgto : '',
      'Economia (R$)':Math.round(k.economia * 100) / 100, 'Economia (%)':k.economia ? Math.round(k.economiaPct * 10) / 10 : 0,
      'Status da aprovação':({cotacao:'Em cotação', aguardando:'Aguardando aprovação', aprovada:'Aprovada', reprovada:'Reprovada'})[c.aprovacao || 'cotacao'], 'Aprovado por':c.aprovadoPor || '',
      'Status da compra':({pendente:'Não iniciada', pedido:'Pedido emitido', recebida:'Recebida', cancelada:'Cancelada'})[c.compra || 'pendente'], 'Nº pedido':c.pedidoNumero || '', 'Entrega prevista':fmtD(c.entregaPrevista), 'Recebida em':fmtD(c.recebidoEm), 'NF':c.nf || ''};
  }));
};
