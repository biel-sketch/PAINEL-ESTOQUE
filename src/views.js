// =====================================================================
// NAVEGAÇÃO E RENDERIZAÇÃO
// =====================================================================
var curView = 'dashboard', curMod = 'inicio', curSub = 'resumo';
var tabs = {validade:'trocas', relatorios:'consumo', cadastros:'empresas'};
var renderQueued = false;

// Menu enxuto: 6 módulos; cada um com poucas subabas no topo da página.
var MODULES = [
  {id:'inicio', label:'Início', subs:[{id:'resumo', label:'Resumo', view:'dashboard'}]},
  {id:'estoque', label:'Estoque', subs:[
    {id:'saldo', label:'Saldo', view:'estoque'},
    {id:'movimentos', label:'Movimentações', view:'movimentos'},
    {id:'produtos', label:'Produtos', view:'produtos'},
    {id:'alertas', label:'CA e estoque mínimo', view:'validade', tab:'ca', tabsVisiveis:['ca','minimo']}]},
  {id:'entregas', label:'Entregas de EPI', subs:[
    {id:'entregas', label:'Entregas', view:'entregas'},
    {id:'empregados', label:'Empregados', view:'empregados'},
    {id:'trocas', label:'Trocas pendentes', view:'validade', tab:'trocas', tabsVisiveis:[]}]},
  {id:'compras', label:'Compras — cotação e aprovação', subs:[{id:'painel', label:'Painel', view:'compras'}]},
  {id:'relatorios', label:'Relatórios', subs:[{id:'rel', label:'Relatórios', view:'relatorios'}]},
  {id:'cadastros', label:'Cadastros', subs:[
    {id:'empresas', label:'Centros / unidades', view:'cadastros', tab:'empresas', tabsVisiveis:[]},
    {id:'cargos', label:'Cargos e kits de EPI', view:'cadastros', tab:'cargos', tabsVisiveis:[]},
    {id:'locais', label:'Locais de estoque', view:'cadastros', tab:'locais', tabsVisiveis:[]},
    {id:'sistema', label:'Sistema', view:'config', admin:true}]}
];
function modById(id){ return MODULES.find(function(m){ return m.id === id; }) || MODULES[0]; }

function scheduleRender(){
  if(renderQueued) return; renderQueued = true;
  requestAnimationFrame(function(){ renderQueued = false; if(currentUser) renderAll(); });
}
function renderAll(){
  fillSelects();
  updateBadges();
  renderView(curView);
  if(modalRefresh) modalRefresh();
}
function showModule(modId, subId){
  var m = modById(modId);
  var subs = m.subs.filter(function(x){ return !x.admin || can('admin'); });
  var sub = subs.find(function(x){ return x.id === subId; }) || subs[0];
  curMod = m.id; curSub = sub.id; curView = sub.view;
  if(sub.tab) tabs[sub.view] = sub.tab;
  try{ localStorage.setItem('painelestoque_nav', m.id + '/' + sub.id); }catch(e){}
  $$('.nav-item').forEach(function(n){ n.classList.toggle('active', n.dataset.mod === m.id); });
  $$('.view').forEach(function(s){ s.classList.toggle('active', s.id === 'view-' + sub.view); });
  $('#mod-title').textContent = m.label;
  $('#subnav').innerHTML = subs.length > 1 ? subs.map(function(x){ return '<div class="subtab'+(x.id === sub.id ? ' active' : '')+'" data-sub="'+x.id+'">'+esc(x.label)+'</div>'; }).join('') : '';
  $('#subnav').style.display = subs.length > 1 ? '' : 'none';
  // abas internas: mostra só as que fazem sentido nesta subaba
  var box = $('#view-' + sub.view + ' .tabs');
  if(box){
    var vis = sub.tabsVisiveis;
    $$('.tab', box).forEach(function(t){ t.style.display = !vis || vis.indexOf(t.dataset.tab) !== -1 ? '' : 'none'; t.classList.toggle('active', t.dataset.tab === tabs[sub.view]); });
    box.style.display = vis && vis.length < 2 ? 'none' : '';
  }
  renderAll();
  window.scrollTo(0, 0);
}
// Compatibilidade: abre a tela pelo nome antigo (ex.: 'validade' + aba 'minimo')
function showView(v, tab){
  var hit = null;
  MODULES.forEach(function(m){ m.subs.forEach(function(x){
    if(hit || x.view !== v) return;
    if(!tab || !x.tab || x.tab === tab || (x.tabsVisiveis || []).indexOf(tab) !== -1) hit = [m.id, x.id];
  }); });
  if(!hit) hit = ['inicio', 'resumo'];
  if(tab) tabs[v] = tab;
  showModule(hit[0], hit[1]);
  if(tab) setTab(v, tab);
}
function renderView(v){
  var f = {dashboard:renderDashboard, estoque:renderEstoque, movimentos:renderMovimentos, produtos:renderProdutos,
           entregas:renderEntregas, empregados:renderEmpregados, validade:renderValidade, relatorios:renderRelatorios,
           cadastros:renderCadastros, config:renderConfig, compras:renderCompras}[v];
  if(f) f();
}

function initUI(){
  var d = new Date();
  $$('.page-date-js').forEach(function(el){ el.textContent = d.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'}); });
  $$('.nav-item').forEach(function(n){ n.addEventListener('click', function(){ showModule(n.dataset.mod); }); });
  $('#subnav').addEventListener('click', function(e){ var t = e.target.closest('.subtab'); if(t) showModule(curMod, t.dataset.sub); });
  document.addEventListener('click', function(e){
    var go = e.target.closest('[data-go]'); if(go){ showView(go.dataset.go, go.dataset.tab); return; }
    var act = e.target.closest('[data-act]'); if(act && !act.disabled){ handleAction(act.dataset.act, act); return; }
    var tab = e.target.closest('.tabs .tab'); if(tab){ setTab(curView, tab.dataset.tab); }
  });
  // filtros: re-renderiza a tabela ao digitar/alterar
  ['est-busca','est-cat','est-local','est-zerados','est-minimo','mov-busca','mov-tipo','mov-de','mov-ate','prod-busca','prod-cat','prod-status',
   'ent-busca','ent-empresa','ent-de','ent-ate','emp-busca','emp-empresa','emp-status','rel-de','rel-ate','rel-empresa','rel-cat','cmp-busca','cmp-unidade'].forEach(function(id){
    var el = $('#' + id); if(!el) return;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input', function(){ renderView(curView); });
  });
  var mt = $('#mov-tipo'); Object.keys(MOV_TIPOS).forEach(function(k){ mt.insertAdjacentHTML('beforeend', '<option value="'+k+'">'+MOV_TIPOS[k].label+'</option>'); });
  // período padrão: mês corrente
  var ini = today().slice(0, 8) + '01';
  ['mov-de','ent-de','rel-de'].forEach(function(id){ $('#' + id).value = ini; });
  ['mov-ate','ent-ate','rel-ate'].forEach(function(id){ $('#' + id).value = today(); });
  // sidebar recolhível (mesmo comportamento dos outros painéis)
  var sb = $('#app-sidebar');
  function setCollapsed(c){ sb.classList.toggle('collapsed', c); try{ localStorage.setItem('painelestoque_sidebar', c ? '1' : '0'); }catch(e){} }
  $('#sidebar-toggle-btn').addEventListener('click', function(){ setCollapsed(!sb.classList.contains('collapsed')); });
  try{ if(localStorage.getItem('painelestoque_sidebar') === '1') setCollapsed(true); }catch(e){}
  $('#modal').addEventListener('mousedown', function(e){ if(e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && $('#modal').classList.contains('visible')) closeModal(); });
  $('#file-import').addEventListener('change', onImportFile);
}
function setTab(view, t){
  tabs[view] = t;
  var box = $('#view-' + view + ' .tabs');
  if(box) $$('.tab', box).forEach(function(x){ x.classList.toggle('active', x.dataset.tab === t); });
  renderView(view);
}

// Preenche selects/datalists que dependem de cadastros (mantendo a seleção)
function fillSelects(){
  var empresas = vals(DB.empresas).sort(byName), locais = vals(DB.locais).sort(byName);
  $$('.sel-empresas').forEach(function(s){
    var v = s.value;
    s.innerHTML = '<option value="">' + esc(s.dataset.all || 'Selecione...') + '</option>' + empresas.map(function(e){ return '<option value="'+e._id+'">'+esc(e.nome)+'</option>'; }).join('');
    s.value = v;
  });
  $$('.sel-locais').forEach(function(s){
    var v = s.value;
    s.innerHTML = '<option value="">' + esc(s.dataset.all || 'Selecione...') + '</option>' + locais.map(function(e){ return '<option value="'+e._id+'">'+esc(e.nome)+'</option>'; }).join('');
    s.value = v;
  });
  $('#dl-produtos').innerHTML = vals(DB.produtos).filter(function(p){ return p.ativo !== false; }).sort(byName).map(function(p){ return '<option value="'+esc(prodLabel(p))+'"></option>'; }).join('');
  $('#dl-empregados').innerHTML = vals(DB.empregados).filter(function(e){ return e.ativo !== false; }).sort(byName).map(function(e){ return '<option value="'+esc(empLabel(e))+'"></option>'; }).join('');
}
function prodLabel(p){ return p.nome + (p.ca ? ' · CA ' + p.ca : ''); }
function empLabel(e){ return e.nome + (e.matricula ? ' · ' + e.matricula : ''); }
function findProdByLabel(l){ l = norm(l); if(!l) return null; var p = vals(DB.produtos).find(function(p){ return norm(prodLabel(p)) === l; }) || vals(DB.produtos).find(function(p){ return norm(p.nome) === l; }); return p ? p._id : null; }
function findEmpByLabel(l){ l = norm(l); if(!l) return null; var e = vals(DB.empregados).find(function(e){ return norm(empLabel(e)) === l; }) || vals(DB.empregados).find(function(e){ return norm(e.nome) === l; }); return e ? e._id : null; }
function nomeEmpresa(id){ return (DB.empresas[id] || {}).nome || '—'; }
function nomeLocal(id){ return (DB.locais[id] || {}).nome || '—'; }
function nomeCargo(id){ return (DB.cargos[id] || {}).nome || '—'; }
function nomeProd(id){ return (DB.produtos[id] || {}).nome || '(produto removido)'; }

function caStatus(p){
  if(!p.ca) return {cls:'gray', txt:'Sem CA', d:null};
  if(p.caSituacao && norm(p.caSituacao) !== 'valido' && norm(p.caSituacao) !== 'vencido') return {cls:'red', txt:'CA ' + p.caSituacao.toLowerCase(), d:null};
  if(!p.validadeCA) return {cls:'amber', txt:'Sem validade', d:null};
  var d = daysUntil(p.validadeCA), lim = +cfg('diasAlertaCA', 60);
  if(d < 0) return {cls:'red', txt:'CA vencido', d:d};
  if(d <= lim) return {cls:'amber', txt:'Vence em ' + d + 'd', d:d};
  return {cls:'teal', txt:'Válido', d:d};
}
function emptyState(msg){ return '<div class="empty-state"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg><div>'+msg+'</div></div>'; }
function statCard(label, value, cls, sub, go){
  return '<div class="stat-card'+(go?' clickable':'')+'"'+(go?' data-go="'+go.split(':')[0]+'"'+(go.split(':')[1]?' data-tab="'+go.split(':')[1]+'"':''):'')+'><div class="stat-label">'+label+'</div><div class="stat-value '+(cls||'')+'">'+value+'</div>'+(sub?'<div class="stat-sub">'+sub+'</div>':'')+'</div>';
}

// =====================================================================
// CÁLCULOS COMPARTILHADOS
// =====================================================================
// Itens que cada empregado tem em posse (entregues, não devolvidos e não substituídos)
function itensEmPosse(empId){
  var out = [];
  vals(DB.entregas).forEach(function(en){
    if(en.cancelada || (empId && en.empregadoId !== empId)) return;
    (en.itens || []).forEach(function(it, idx){
      if(!it) return;
      var aberto = (+it.qtd || 0) - (+it.devolvido || 0);
      if(aberto > 0 && !it.substituidoPor) out.push({entregaId: en._id, idx: idx, empregadoId: en.empregadoId, data: en.data, item: it, aberto: aberto});
    });
  });
  return out;
}
function trocasPendentes(){
  var lim = +cfg('diasAlertaTroca', 15);
  return itensEmPosse(null).filter(function(x){
    var emp = DB.empregados[x.empregadoId];
    return emp && emp.ativo !== false && x.item.proximaTroca && daysUntil(x.item.proximaTroca) <= lim;
  }).sort(function(a, b){ return a.item.proximaTroca < b.item.proximaTroca ? -1 : 1; });
}
function produtosCAAlerta(){
  return vals(DB.produtos).filter(function(p){ if(p.ativo === false || !p.ca) return false; var s = caStatus(p); return s.cls === 'red' || s.cls === 'amber'; })
    .sort(function(a, b){ return (a.validadeCA || '') < (b.validadeCA || '') ? -1 : 1; });
}
function produtosAbaixoMinimo(){
  return vals(DB.produtos).filter(function(p){ return p.ativo !== false && +p.estoqueMinimo > 0 && saldoProduto(p._id) < +p.estoqueMinimo; });
}
function movsPeriodo(de, ate){
  return vals(DB.movimentos).filter(function(m){ return (!de || m.data >= de) && (!ate || m.data <= ate); });
}
function updateBadges(){
  var trocasVenc = trocasPendentes().filter(function(x){ return daysUntil(x.item.proximaTroca) < 0; }).length;
  var caVenc = produtosCAAlerta().filter(function(p){ return caStatus(p).cls === 'red' && saldoProduto(p._id) > 0; }).length;
  var cmp = typeof comprasPendentesUsuario === 'function' ? comprasPendentesUsuario() : 0;
  $('#badge-entregas').textContent = trocasVenc || '';
  $('#badge-estoque').textContent = caVenc || '';
  $('#badge-compras').textContent = cmp || '';
}

// =====================================================================
// VISÃO GERAL
// =====================================================================
function renderDashboard(){
  var prods = vals(DB.produtos).filter(function(p){ return p.ativo !== false; });
  var unidades = 0, valor = 0;
  prods.forEach(function(p){ var s = saldoProduto(p._id); unidades += s; valor += s * (+p.custo || 0); });
  var caVenc = produtosCAAlerta().filter(function(p){ return caStatus(p).cls === 'red' && saldoProduto(p._id) > 0; });
  var trocas = trocasPendentes(), trocasVenc = trocas.filter(function(x){ return daysUntil(x.item.proximaTroca) < 0; });
  var minimo = produtosAbaixoMinimo();
  var ini = today().slice(0, 8) + '01';
  var entMes = vals(DB.entregas).filter(function(e){ return !e.cancelada && e.data >= ini; });
  var itensMes = entMes.reduce(function(s, e){ return s + (e.itens || []).reduce(function(a, i){ return a + (+i.qtd || 0); }, 0); }, 0);

  $('#dash-stats').innerHTML =
    statCard('Unidades em estoque', fmtN(unidades), 'teal', prods.length + ' produtos ativos', 'estoque') +
    statCard('Valor em estoque', fmtR(valor), '', valor ? 'pelo custo médio' : 'cadastre o custo dos produtos', 'estoque') +
    statCard('Entregas no mês', fmtN(entMes.length), '', fmtN(itensMes) + ' itens entregues', 'entregas') +
    statCard('Trocas vencidas', fmtN(trocasVenc.length), trocasVenc.length ? 'red' : '', fmtN(trocas.length - trocasVenc.length) + ' vencendo em breve', 'validade:trocas') +
    statCard('CA vencido com saldo', fmtN(caVenc.length), caVenc.length ? 'red' : '', fmtN(minimo.length) + ' abaixo do mínimo', 'validade:ca');

  var al = [];
  caVenc.slice(0, 4).forEach(function(p){ al.push(['red', esc(p.nome), 'CA ' + esc(p.ca) + ' vencido em ' + fmtD(p.validadeCA) + ' · ' + saldoProduto(p._id) + ' em estoque', 'validade:ca']); });
  trocasVenc.slice(0, 4).forEach(function(x){ var e = DB.empregados[x.empregadoId] || {}; al.push(['red', esc(e.nome), esc(nomeProd(x.item.pid)) + ' — troca prevista ' + fmtD(x.item.proximaTroca), 'validade:trocas']); });
  minimo.slice(0, 4).forEach(function(p){ al.push(['amber', esc(p.nome), 'Saldo ' + saldoProduto(p._id) + ' · mínimo ' + p.estoqueMinimo, 'validade:minimo']); });
  produtosCAAlerta().filter(function(p){ return caStatus(p).cls === 'amber'; }).slice(0, 3).forEach(function(p){ al.push(['amber', esc(p.nome), 'CA ' + esc(p.ca) + ' vence em ' + fmtD(p.validadeCA), 'validade:ca']); });
  var cmps = vals(DB.compras);
  var aguard = cmps.filter(function(c){ return cmpEtapa(c) === 'aguardando'; }).length;
  var aEmitir = cmps.filter(function(c){ return cmpEtapa(c) === 'aprovada'; }).length;
  var atras = cmps.filter(function(c){ return cmpEtapa(c) === 'pedido' && daysUntil(c.entregaPrevista) < 0; }).length;
  if(atras) al.unshift(['red', atras + ' pedido(s) de compra atrasado(s)', 'Entrega prevista já passou', 'compras:']);
  if(aguard && can('aprovar')) al.unshift(['amber', aguard + ' compra(s) aguardando sua aprovação', 'Abra o painel de compras para aprovar ou reprovar', 'compras:']);
  if(aEmitir && can('comprar')) al.unshift(['amber', aEmitir + ' compra(s) aprovada(s) sem pedido', 'Emita o pedido ao fornecedor', 'compras:']);
  $('#dash-alertas').innerHTML = al.length ? al.slice(0, 9).map(function(a){
    var g = a[3].split(':');
    return '<div class="list-item" style="cursor:pointer" data-go="'+g[0]+'" data-tab="'+g[1]+'"><span class="alert-dot '+a[0]+'"></span><div class="grow"><div class="t">'+a[1]+'</div><div class="s">'+a[2]+'</div></div></div>';
  }).join('') : '<div class="list-item"><span class="alert-dot teal"></span><div class="grow"><div class="t">Nenhum alerta</div><div class="s">CAs, trocas e estoque mínimo em dia.</div></div></div>';

  var de = addDays(today(), -30), cons = {};
  movsPeriodo(de, null).forEach(function(m){ if(m.tipo === 'entrega') cons[m.pid] = (cons[m.pid] || 0) + (+m.qtd || 0); });
  var top = Object.keys(cons).map(function(k){ return [k, cons[k]]; }).sort(function(a, b){ return b[1] - a[1]; }).slice(0, 8);
  var mx = top.length ? top[0][1] : 1;
  $('#dash-top').innerHTML = top.length ? '<div class="bars">' + top.map(function(t){
    return '<div class="bar-row"><span class="bar-label" title="'+esc(nomeProd(t[0]))+'">'+esc(nomeProd(t[0]))+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(t[1]/mx*100)+'%"></div></div><span class="bar-val">'+fmtN(t[1])+'</span></div>';
  }).join('') + '</div>' : emptyState('Nenhuma entrega nos últimos 30 dias.');

  var movs = vals(DB.movimentos).sort(function(a, b){ return b.ts - a.ts; }).slice(0, 8);
  $('#dash-movs').innerHTML = movs.length ? movTable(movs, true) : emptyState('Nenhuma movimentação ainda.');
}

// =====================================================================
// POSIÇÃO DE ESTOQUE
// =====================================================================
function renderEstoque(){
  var q = norm($('#est-busca').value), cat = $('#est-cat').value, loc = $('#est-local').value;
  var zer = $('#est-zerados').checked, minOnly = $('#est-minimo').checked;
  var rows = vals(DB.produtos).filter(function(p){
    if(p.ativo === false) return false;
    if(cat && p.categoria !== cat) return false;
    if(q && norm(p.nome + ' ' + (p.ca || '') + ' ' + (p.fabricante || '')).indexOf(q) === -1) return false;
    var s = saldoProduto(p._id, loc);
    if(!zer && s <= 0) return false;
    if(minOnly && !(+p.estoqueMinimo > 0 && s < +p.estoqueMinimo)) return false;
    return true;
  }).sort(byName);
  var totU = 0, totV = 0, totSku = 0;
  rows.forEach(function(p){ var s = saldoProduto(p._id, loc); totU += s; totV += s * (+p.custo || 0); totSku += tamanhosProduto(p._id).filter(function(k){ return saldoDe(p._id, k, loc) > 0; }).length; });
  $('#est-stats').innerHTML = statCard('Produtos listados', fmtN(rows.length)) + statCard('Itens (produto × tamanho)', fmtN(totSku)) + statCard('Unidades', fmtN(totU), 'teal') + statCard('Valor', fmtR(totV));
  if(!rows.length){ $('#est-table').innerHTML = emptyState(vals(DB.produtos).length ? 'Nenhum produto com esses filtros.' : 'Nenhum produto cadastrado. Cadastre em Produtos / EPIs e dê entrada no saldo.'); return; }
  $('#est-table').innerHTML = '<table><thead><tr><th>Produto</th><th>CA</th><th>Tamanhos / saldo</th><th class="num">Total</th><th class="num">Mínimo</th><th>Situação</th></tr></thead><tbody>' +
    rows.map(function(p){
      var s = saldoProduto(p._id, loc), ca = caStatus(p);
      var chips = tamanhosProduto(p._id).map(function(k){ var v = saldoDe(p._id, k, loc); return (v || zer) ? '<span class="chip'+(v?'':' zero')+'">'+esc(tamLabel(k) === '—' ? 'UN' : k)+' <b>'+v+'</b></span>' : ''; }).join('');
      var sit = +p.estoqueMinimo > 0 && s < +p.estoqueMinimo ? '<span class="pill amber">Abaixo do mínimo</span>' : (s <= 0 ? '<span class="pill gray">Zerado</span>' : '<span class="pill teal">OK</span>');
      return '<tr class="row-clickable" data-act="ver-produto" data-id="'+p._id+'"><td>'+esc(p.nome)+'<span class="sub">'+esc(p.categoria || '')+(p.fabricante ? ' · ' + esc(p.fabricante) : '')+'</span></td>' +
        '<td>'+(p.ca ? '<span class="mono">'+esc(p.ca)+'</span><span class="sub"><span class="pill '+ca.cls+'" style="padding:1px 7px;font-size:10.5px">'+ca.txt+'</span></span>' : '<span class="mono">—</span>')+'</td>' +
        '<td><div class="chips">'+chips+'</div></td><td class="num">'+fmtN(s)+'</td><td class="num">'+(p.estoqueMinimo ? fmtN(p.estoqueMinimo) : '—')+'</td><td>'+sit+'</td></tr>';
    }).join('') + '</tbody></table>';
}

// =====================================================================
// MOVIMENTAÇÕES
// =====================================================================
function movRef(m){
  if(m.empregadoId){ var e = DB.empregados[m.empregadoId]; return e ? esc(e.nome) : '—'; }
  if(m.tipo === 'entrada') return esc([m.fornecedor, m.doc ? 'NF ' + m.doc : ''].filter(Boolean).join(' · ')) || '—';
  if(m.tipo === 'transf_saida') return '→ ' + esc(nomeLocal(m.locDest));
  if(m.tipo === 'transf_entrada') return '← ' + esc(nomeLocal(m.locDest));
  return esc(m.motivo || m.obs || '—');
}
function movTable(list, compact){
  return '<table><thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Tam.</th><th class="num">Qtd</th>'+(compact?'':'<th>Local</th>')+'<th>Referência</th><th>Usuário</th></tr></thead><tbody>' +
    list.map(function(m){
      var t = MOV_TIPOS[m.tipo] || {label:m.tipo, cls:'gray', sinal:0};
      return '<tr><td class="mono">'+fmtD(m.data)+'</td><td><span class="pill '+t.cls+'">'+t.label+'</span></td><td>'+esc(nomeProd(m.pid))+'</td><td class="mono">'+esc(tamLabel(m.tk))+'</td>' +
        '<td class="num '+(t.sinal > 0 ? 'qty-in' : t.sinal < 0 ? 'qty-out' : '')+'">'+(t.sinal > 0 ? '+' : t.sinal < 0 ? '−' : '')+fmtN(m.qtd)+'</td>'+(compact?'':'<td>'+esc(nomeLocal(m.loc))+'</td>')+'<td>'+movRef(m)+'</td><td class="mono">'+esc(m.usuario || '')+'</td></tr>';
    }).join('') + '</tbody></table>';
}
function filtroMovs(){
  var q = norm($('#mov-busca').value), tp = $('#mov-tipo').value;
  return movsPeriodo($('#mov-de').value, $('#mov-ate').value).filter(function(m){
    if(tp && m.tipo !== tp) return false;
    if(q){ var e = DB.empregados[m.empregadoId] || {}; if(norm([nomeProd(m.pid), e.nome, m.doc, m.fornecedor, m.motivo, m.obs].join(' ')).indexOf(q) === -1) return false; }
    return true;
  }).sort(function(a, b){ return b.data === a.data ? b.ts - a.ts : (b.data > a.data ? 1 : -1); });
}
function renderMovimentos(){
  var list = filtroMovs();
  if(!list.length){ $('#mov-table').innerHTML = emptyState('Nenhuma movimentação no período.'); return; }
  var shown = list.slice(0, 500);
  $('#mov-table').innerHTML = movTable(shown) + '<div class="tbl-foot">'+fmtN(list.length)+' movimentações'+(list.length > 500 ? ' — mostrando as 500 mais recentes (use Exportar para ver todas)' : '')+'</div>';
}

// =====================================================================
// PRODUTOS
// =====================================================================
function renderProdutos(){
  var q = norm($('#prod-busca').value), cat = $('#prod-cat').value, st = $('#prod-status').value;
  var rows = vals(DB.produtos).filter(function(p){
    if(st === 'ativos' && p.ativo === false) return false;
    if(st === 'inativos' && p.ativo !== false) return false;
    if(cat && p.categoria !== cat) return false;
    if(q && norm([p.nome, p.ca, p.fabricante, p.codRSData].join(' ')).indexOf(q) === -1) return false;
    return true;
  }).sort(byName);
  if(!rows.length){ $('#prod-table').innerHTML = emptyState('Nenhum produto encontrado.'); return; }
  $('#prod-table').innerHTML = '<table><thead><tr><th>Produto</th><th>Categoria</th><th>CA</th><th>Validade CA</th><th>Vida útil</th><th>Tamanhos</th><th class="num">Mínimo</th><th class="num">Custo</th><th class="num">Saldo</th></tr></thead><tbody>' +
    rows.map(function(p){
      var ca = caStatus(p);
      return '<tr class="row-clickable" data-act="editar-produto" data-id="'+p._id+'"><td>'+esc(p.nome)+(p.ativo === false ? ' <span class="pill gray">Inativo</span>' : '')+(p.fabricante ? '<span class="sub">'+esc(p.fabricante)+'</span>' : '')+'</td><td>'+esc(p.categoria || '')+'</td>' +
        '<td class="mono">'+esc(p.ca || '—')+'</td><td>'+(p.ca ? fmtD(p.validadeCA) + ' <span class="pill '+ca.cls+'" style="padding:1px 7px;font-size:10.5px">'+ca.txt+'</span>' : '—')+'</td>' +
        '<td>'+vidaUtilTxt(p.vidaUtilDias)+'</td><td><div class="chips">'+(p.tamanhos || []).map(function(t){ return '<span class="chip">'+esc(t)+'</span>'; }).join('')+'</div></td>' +
        '<td class="num">'+(p.estoqueMinimo || '—')+'</td><td class="num">'+(p.custo ? fmtR(p.custo) : '—')+'</td><td class="num">'+fmtN(saldoProduto(p._id))+'</td></tr>';
    }).join('') + '</tbody></table><div class="tbl-foot">'+rows.length+' produtos</div>';
}
function vidaUtilTxt(d){
  d = +d || 0; if(!d) return '—';
  if(d % 365 === 0) return (d / 365) + (d === 365 ? ' ano' : ' anos');
  if(d % 30 === 0) return (d / 30) + (d === 30 ? ' mês' : ' meses');
  return d + ' dias';
}

// =====================================================================
// ENTREGAS
// =====================================================================
function filtroEntregas(){
  var q = norm($('#ent-busca').value), emp = $('#ent-empresa').value, de = $('#ent-de').value, ate = $('#ent-ate').value;
  return vals(DB.entregas).filter(function(en){
    if(en.cancelada) return false;
    if(de && en.data < de) return false; if(ate && en.data > ate) return false;
    var e = DB.empregados[en.empregadoId] || {};
    if(emp && e.empresaId !== emp) return false;
    if(q && norm(e.nome + ' ' + (e.matricula || '') + ' ' + (en.itens || []).map(function(i){ return nomeProd(i.pid); }).join(' ')).indexOf(q) === -1) return false;
    return true;
  }).sort(function(a, b){ return b.ts - a.ts; });
}
function renderEntregas(){
  var list = filtroEntregas();
  if(!list.length){ $('#ent-table').innerHTML = emptyState('Nenhuma entrega no período.'); return; }
  $('#ent-table').innerHTML = '<table><thead><tr><th>Data</th><th>Empregado</th><th>Itens</th><th>Motivo</th><th>Assinatura</th><th>Responsável</th><th></th></tr></thead><tbody>' +
    list.map(function(en){
      var e = DB.empregados[en.empregadoId] || {};
      var itens = (en.itens || []).map(function(i){ return esc(i.qtd + '× ' + nomeProd(i.pid) + (i.tk && i.tk !== 'UN' ? ' (' + i.tk + ')' : '')); }).join('<br>');
      return '<tr><td class="mono">'+fmtD(en.data)+'</td><td><a href="#" data-act="ficha-empregado" data-id="'+en.empregadoId+'" style="color:var(--text)">'+esc(e.nome || '—')+'</a><span class="sub">'+esc(nomeEmpresa(e.empresaId))+'</span></td>' +
        '<td style="font-size:12px">'+itens+'</td><td style="font-size:12px">'+esc(en.motivo || '')+'</td><td>'+(en.assinatura ? '<span class="pill teal">Assinado</span>' : '<span class="pill amber">Pendente</span>')+'</td>' +
        '<td class="mono">'+esc(en.usuario || '')+'</td><td style="white-space:nowrap"><button class="btn btn-sm" data-act="print-termo" data-id="'+en._id+'">Termo</button></td></tr>';
    }).join('') + '</tbody></table><div class="tbl-foot">'+list.length+' entregas</div>';
}

// =====================================================================
// EMPREGADOS
// =====================================================================
function renderEmpregados(){
  var q = norm($('#emp-busca').value), emp = $('#emp-empresa').value, st = $('#emp-status').value;
  var posse = {}; itensEmPosse(null).forEach(function(x){ (posse[x.empregadoId] = posse[x.empregadoId] || []).push(x); });
  var rows = vals(DB.empregados).filter(function(e){
    if(st === 'ativos' && e.ativo === false) return false;
    if(st === 'inativos' && e.ativo !== false) return false;
    if(emp && e.empresaId !== emp) return false;
    if(q && norm([e.nome, e.matricula, e.cpf, e.setor].join(' ')).indexOf(q) === -1) return false;
    return true;
  }).sort(byName);
  if(!rows.length){ $('#emp-table').innerHTML = emptyState(vals(DB.empregados).length ? 'Nenhum empregado com esses filtros.' : 'Nenhum empregado cadastrado. Cadastre manualmente ou importe uma planilha do RH.'); return; }
  $('#emp-table').innerHTML = '<table><thead><tr><th>Nome</th><th>Matrícula</th><th>Empresa / setor</th><th>Cargo</th><th class="num">Itens em posse</th><th>Próxima troca</th><th></th></tr></thead><tbody>' +
    rows.map(function(e){
      var p = posse[e._id] || [];
      var prox = p.filter(function(x){ return x.item.proximaTroca; }).sort(function(a, b){ return a.item.proximaTroca < b.item.proximaTroca ? -1 : 1; })[0];
      var proxHtml = '—';
      if(prox){ var d = daysUntil(prox.item.proximaTroca); proxHtml = fmtD(prox.item.proximaTroca) + ' <span class="pill '+(d < 0 ? 'red' : d <= +cfg('diasAlertaTroca', 15) ? 'amber' : 'gray')+'" style="padding:1px 7px;font-size:10.5px">'+(d < 0 ? 'vencida' : d + 'd')+'</span><span class="sub">'+esc(nomeProd(prox.item.pid))+'</span>'; }
      return '<tr class="row-clickable" data-act="ficha-empregado" data-id="'+e._id+'"><td>'+esc(e.nome)+(e.ativo === false ? ' <span class="pill gray">Desligado</span>' : '')+'</td><td class="mono">'+esc(e.matricula || '—')+'</td>' +
        '<td>'+esc(nomeEmpresa(e.empresaId))+(e.setor ? '<span class="sub">'+esc(e.setor)+'</span>' : '')+'</td><td>'+esc(nomeCargo(e.cargoId))+'</td><td class="num">'+p.reduce(function(s, x){ return s + x.aberto; }, 0)+'</td><td>'+proxHtml+'</td>' +
        '<td><button class="btn btn-sm need-entregar" data-act="nova-entrega" data-id="'+e._id+'"'+(can('entregar') && e.ativo !== false ? '' : ' disabled')+'>Entregar</button></td></tr>';
    }).join('') + '</tbody></table><div class="tbl-foot">'+rows.length+' empregados</div>';
}

// =====================================================================
// VALIDADE E CA
// =====================================================================
function renderValidade(){
  var trocas = trocasPendentes(), cas = produtosCAAlerta(), minimo = produtosAbaixoMinimo();
  var tv = trocas.filter(function(x){ return daysUntil(x.item.proximaTroca) < 0; }).length;
  var cv = cas.filter(function(p){ return caStatus(p).cls === 'red'; }).length;
  var cvv = cas.filter(function(p){ return caStatus(p).cls === 'amber'; }).length;
  $('#val-stats').innerHTML = tabs.validade === 'trocas'
    ? statCard('Trocas vencidas', tv, tv ? 'red' : '') + statCard('Trocas nos próximos ' + cfg('diasAlertaTroca', 15) + ' dias', trocas.length - tv, 'amber')
    : statCard('CAs vencidos', cv, cv ? 'red' : '', '', 'validade:ca') + statCard('CAs vencendo', cvv, cvv ? 'amber' : '', 'próximos ' + cfg('diasAlertaCA', 60) + ' dias', 'validade:ca') + statCard('Abaixo do mínimo', minimo.length, minimo.length ? 'amber' : '', '', 'validade:minimo');
  var t = tabs.validade, h = '';
  if(t === 'trocas'){
    h = trocas.length ? '<table><thead><tr><th>Empregado</th><th>Item</th><th>Tam.</th><th>Entregue em</th><th>Troca prevista</th><th>Situação</th><th></th></tr></thead><tbody>' + trocas.map(function(x){
      var e = DB.empregados[x.empregadoId] || {}, d = daysUntil(x.item.proximaTroca);
      return '<tr><td>'+esc(e.nome)+'<span class="sub">'+esc(nomeEmpresa(e.empresaId))+'</span></td><td>'+esc(nomeProd(x.item.pid))+'</td><td class="mono">'+esc(tamLabel(x.item.tk))+'</td><td class="mono">'+fmtD(x.data)+'</td><td class="mono">'+fmtD(x.item.proximaTroca)+'</td>' +
        '<td><span class="pill '+(d < 0 ? 'red' : 'amber')+'">'+(d < 0 ? 'Vencida há ' + (-d) + 'd' : (d === 0 ? 'Hoje' : 'Em ' + d + 'd'))+'</span></td>' +
        '<td><button class="btn btn-sm" data-act="nova-entrega" data-id="'+x.empregadoId+'"'+(can('entregar') ? '' : ' disabled')+'>Trocar</button></td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Nenhuma troca vencida ou próxima.');
  } else if(t === 'ca'){
    var all = vals(DB.produtos).filter(function(p){ return p.ativo !== false && p.ca; }).sort(function(a, b){ return (a.validadeCA || '9') < (b.validadeCA || '9') ? -1 : 1; });
    h = '<div class="panel-head"><span class="panel-title" id="caepi-meta" style="font-size:12px;font-weight:400;color:var(--text-dim)">Base oficial CAEPI</span><button class="btn btn-sm btn-primary" data-act="atualizar-cas"'+(can('produtos') ? '' : ' disabled')+'>Atualizar CAs pela base oficial</button></div>';
    caepiMetaInfo().then(function(m){ var el = $('#caepi-meta'); if(el) el.textContent = 'Base oficial CAEPI (Ministério do Trabalho) de ' + fmtD(m.atualizadoEm) + ' · ' + fmtN(m.total) + ' CAs'; }).catch(function(){ var el = $('#caepi-meta'); if(el) el.textContent = 'Base oficial CAEPI ainda não publicada no site'; });
    h += all.length ? '<table><thead><tr><th>Produto</th><th>CA</th><th>Validade</th><th>Situação</th><th>Verificado em</th><th class="num">Saldo</th><th></th></tr></thead><tbody>' + all.map(function(p){
      var s = caStatus(p);
      return '<tr><td>'+esc(p.nome)+'</td><td class="mono">'+esc(p.ca)+'</td><td class="mono">'+fmtD(p.validadeCA)+'</td><td><span class="pill '+s.cls+'">'+s.txt+'</span></td><td class="mono">'+fmtD(p.caVerificadoEm)+'</td><td class="num">'+fmtN(saldoProduto(p._id))+'</td>' +
        '<td style="white-space:nowrap"><a class="btn btn-sm" target="_blank" rel="noopener" href="https://consultaca.com/'+encodeURIComponent(p.ca)+'">Consultar CA</a> <button class="btn btn-sm" data-act="editar-produto" data-id="'+p._id+'"'+(can('produtos') ? '' : ' disabled')+'>Atualizar</button></td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Nenhum produto com CA cadastrado.');
  } else {
    h = minimo.length ? '<table><thead><tr><th>Produto</th><th class="num">Saldo</th><th class="num">Mínimo</th><th class="num">Faltam</th><th></th></tr></thead><tbody>' + minimo.map(function(p){
      var s = saldoProduto(p._id);
      return '<tr><td>'+esc(p.nome)+'</td><td class="num">'+s+'</td><td class="num">'+p.estoqueMinimo+'</td><td class="num qty-out">'+(p.estoqueMinimo - s)+'</td><td style="white-space:nowrap"><button class="btn btn-sm" data-act="nova-compra" data-id="'+p._id+'"'+(can('solicitar') ? '' : ' disabled')+'>Solicitar compra</button> <button class="btn btn-sm" data-act="nova-entrada" data-id="'+p._id+'"'+(can('movimentar') ? '' : ' disabled')+'>Dar entrada</button></td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Nenhum produto abaixo do mínimo. Defina o estoque mínimo no cadastro de cada produto.');
  }
  $('#val-table').innerHTML = h;
}

// =====================================================================
// CADASTROS
// =====================================================================
function renderCadastros(){
  var t = tabs.cadastros, h = '';
  $('#cad-novo').disabled = !can('cadastros');
  $('#cad-novo').textContent = {empresas:'+ Nova empresa', cargos:'+ Novo cargo', locais:'+ Novo local'}[t];
  if(t === 'empresas'){
    var l = vals(DB.empresas).sort(byName);
    h = l.length ? '<table><thead><tr><th>Empresa / unidade</th><th>CNPJ</th><th>Cidade</th><th class="num">Empregados ativos</th></tr></thead><tbody>' + l.map(function(e){
      var n = vals(DB.empregados).filter(function(x){ return x.empresaId === e._id && x.ativo !== false; }).length;
      return '<tr class="row-clickable" data-act="editar-empresa" data-id="'+e._id+'"><td>'+esc(e.nome)+'</td><td class="mono">'+esc(e.cnpj || '—')+'</td><td>'+esc(e.cidade || '—')+'</td><td class="num">'+n+'</td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Cadastre as empresas/clientes onde os empregados trabalham (ex.: Eucatex, Femsa Marília).');
  } else if(t === 'cargos'){
    var c = vals(DB.cargos).sort(byName);
    h = c.length ? '<table><thead><tr><th>Cargo</th><th>Kit de EPI / uniforme</th><th class="num">Empregados</th></tr></thead><tbody>' + c.map(function(g){
      var n = vals(DB.empregados).filter(function(x){ return x.cargoId === g._id && x.ativo !== false; }).length;
      return '<tr class="row-clickable" data-act="editar-cargo" data-id="'+g._id+'"><td>'+esc(g.nome)+'</td><td style="font-size:12px">'+((g.kit || []).map(function(k){ return esc(k.qtd + '× ' + nomeProd(k.pid)); }).join('<br>') || '<span style="color:var(--text-faint)">Sem kit definido</span>')+'</td><td class="num">'+n+'</td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Cadastre os cargos e o kit de EPI de cada um. Na entrega, o kit é sugerido automaticamente.');
  } else {
    var lo = vals(DB.locais).sort(byName);
    h = lo.length ? '<table><thead><tr><th>Local</th><th>Descrição</th><th class="num">Unidades</th></tr></thead><tbody>' + lo.map(function(x){
      var u = 0; Object.keys(DB.produtos).forEach(function(pid){ u += saldoProduto(pid, x._id); });
      return '<tr class="row-clickable" data-act="editar-local" data-id="'+x._id+'"><td>'+esc(x.nome)+'</td><td>'+esc(x.descricao || '—')+'</td><td class="num">'+fmtN(u)+'</td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Nenhum local de estoque.');
  }
  $('#cad-table').innerHTML = h;
}

// =====================================================================
// RELATÓRIOS
// =====================================================================
var relData = null;
function renderRelatorios(){
  var t = tabs.relatorios;
  var de = $('#rel-de').value, ate = $('#rel-ate').value, emp = $('#rel-empresa').value, cat = $('#rel-cat').value;
  var movs = movsPeriodo(de, ate).filter(function(m){
    if(m.tipo !== 'entrega') return false;
    var p = DB.produtos[m.pid] || {}; if(cat && p.categoria !== cat) return false;
    if(emp){ var e = DB.empregados[m.empregadoId] || {}; if(e.empresaId !== emp) return false; }
    return true;
  });
  var h = '';
  if(t === 'consumo'){
    var g = {};
    movs.forEach(function(m){ var k = m.pid + '|' + m.tk; g[k] = g[k] || {pid:m.pid, tk:m.tk, qtd:0, valor:0, entregas:0}; g[k].qtd += +m.qtd; g[k].valor += (+m.qtd) * (+m.custoUnit || +(DB.produtos[m.pid] || {}).custo || 0); g[k].entregas++; });
    var rows = vals(g).sort(function(a, b){ return b.qtd - a.qtd; });
    relData = {nome:'consumo', rows: rows.map(function(r){ var p = DB.produtos[r.pid] || {}; return {Produto:p.nome, Categoria:p.categoria, CA:p.ca || '', Tamanho:tamLabel(r.tk), Quantidade:r.qtd, Valor:Math.round(r.valor * 100) / 100}; })};
    var tq = rows.reduce(function(s, r){ return s + r.qtd; }, 0), tv = rows.reduce(function(s, r){ return s + r.valor; }, 0);
    h = '<div class="stats">' + statCard('Itens entregues', fmtN(tq), 'teal') + statCard('Valor consumido', fmtR(tv)) + statCard('Produtos diferentes', fmtN(Object.keys(rows.reduce(function(o, r){ o[r.pid] = 1; return o; }, {})).length)) + statCard('Período', fmtD(de) + ' a ' + fmtD(ate)) + '</div>';
    h += '<div class="panel"><div class="table-wrap">' + (rows.length ? '<table><thead><tr><th>Produto</th><th>Categoria</th><th>Tam.</th><th class="num">Quantidade</th><th class="num">Valor</th></tr></thead><tbody>' + rows.map(function(r){
      var p = DB.produtos[r.pid] || {};
      return '<tr><td>'+esc(p.nome)+'</td><td>'+esc(p.categoria || '')+'</td><td class="mono">'+esc(tamLabel(r.tk))+'</td><td class="num">'+fmtN(r.qtd)+'</td><td class="num">'+(r.valor ? fmtR(r.valor) : '—')+'</td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Nenhuma entrega no período.')) + '</div></div>';
  } else {
    var ge = {};
    movs.forEach(function(m){ var e = DB.empregados[m.empregadoId] || {}; var k = e.empresaId || '_'; ge[k] = ge[k] || {empresa:k, qtd:0, valor:0, pessoas:{}}; ge[k].qtd += +m.qtd; ge[k].valor += (+m.qtd) * (+m.custoUnit || +(DB.produtos[m.pid] || {}).custo || 0); ge[k].pessoas[m.empregadoId] = 1; });
    var re = vals(ge).sort(function(a, b){ return b.qtd - a.qtd; });
    relData = {nome:'consumo-por-empresa', rows: re.map(function(r){ var n = Object.keys(r.pessoas).length; return {Empresa:nomeEmpresa(r.empresa), Empregados:n, Itens:r.qtd, Valor:Math.round(r.valor * 100) / 100, 'Valor por empregado':n ? Math.round(r.valor / n * 100) / 100 : 0}; })};
    var mx = re.length ? re[0].qtd : 1;
    h = '<div class="panel"><div class="panel-head"><span class="panel-title">Itens entregues por empresa — '+fmtD(de)+' a '+fmtD(ate)+'</span></div>' + (re.length ? '<div class="bars">' + re.map(function(r){
      return '<div class="bar-row"><span class="bar-label">'+esc(nomeEmpresa(r.empresa))+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(r.qtd / mx * 100)+'%"></div></div><span class="bar-val">'+fmtN(r.qtd)+'</span></div>';
    }).join('') + '</div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th class="num">Empregados atendidos</th><th class="num">Itens</th><th class="num">Valor</th><th class="num">Valor / empregado</th></tr></thead><tbody>' + relData.rows.map(function(r){
      return '<tr><td>'+esc(r.Empresa)+'</td><td class="num">'+r.Empregados+'</td><td class="num">'+fmtN(r.Itens)+'</td><td class="num">'+(r.Valor ? fmtR(r.Valor) : '—')+'</td><td class="num">'+(r['Valor por empregado'] ? fmtR(r['Valor por empregado']) : '—')+'</td></tr>';
    }).join('') + '</tbody></table></div>' : emptyState('Nenhuma entrega no período.')) + '</div>';
  }
  $('#rel-body').innerHTML = h;
}

// =====================================================================
// CONFIGURAÇÕES
// =====================================================================
function renderConfig(){
  if(!can('admin')){ $('#cfg-body').innerHTML = '<div class="perm-note">Somente administradores.</div>'; return; }
  var users = USER_ROLES.map(function(u){ var r = rolePermissions[u.role] || {}; return '<tr><td>'+esc(u.name)+'</td><td class="mono">'+esc(u.user)+'</td><td class="mono">'+esc(u.email)+'</td><td><span class="pill teal">'+esc(r.label || u.role)+'</span></td></tr>'; }).join('');
  var perms = Object.keys(rolePermissions).map(function(k){ var r = rolePermissions[k]; var ok = function(b){ return b ? '<span class="qty-in">✓</span>' : '<span style="color:var(--text-faint)">—</span>'; };
    return '<tr><td>'+r.label+'</td><td>'+ok(r.movimentar)+'</td><td>'+ok(r.entregar)+'</td><td>'+ok(r.produtos)+'</td><td>'+ok(r.empregados)+'</td><td>'+ok(r.cadastros)+'</td><td>'+ok(r.solicitar)+'</td><td>'+ok(r.comprar)+'</td><td>'+ok(r.aprovar)+'</td><td>'+ok(r.admin)+'</td></tr>'; }).join('');
  var logs = vals(DB.logs).sort(function(a, b){ return b.ts - a.ts; }).slice(0, 150);
  $('#cfg-body').innerHTML =
    '<div class="cfg-grid">' +
      '<div class="cfg-card"><h3>Conexão</h3><p>' + (FB_ON ? 'Conectado ao Firebase (<span class="mono">'+esc(firebaseConfig.projectId)+'</span>), nó <span class="mono">'+DB_ROOT+'</span>.' : '<b style="color:var(--amber)">Modo demonstração.</b> Os dados ficam só neste navegador. Cole a configuração do Firebase no início do código (variável <span class="mono">firebaseConfig</span>) para usar com a equipe.') + '</p></div>' +
      '<div class="cfg-card"><h3>Alertas</h3><p>Antecedência para avisar sobre vencimento de CA e troca de EPI.</p><div class="modal-grid">' +
        '<div class="modal-field"><label>CA vencendo (dias)</label><input type="number" id="cfg-diasCA" value="'+cfg('diasAlertaCA', 60)+'" min="1"></div>' +
        '<div class="modal-field"><label>Troca de EPI (dias)</label><input type="number" id="cfg-diasTroca" value="'+cfg('diasAlertaTroca', 15)+'" min="1"></div>' +
        '<div class="modal-field full"><label>Empresa no cabeçalho dos termos</label><input id="cfg-empresaTermo" value="'+esc(cfg('empresaTermo', 'Grupo Login Serv'))+'"></div>' +
      '</div><div class="modal-actions" style="margin-top:12px"><button class="btn btn-primary" data-act="salvar-config">Salvar</button></div></div>' +
      '<div class="cfg-card"><h3>Backup</h3><p>Baixa todos os dados do painel em um arquivo JSON.</p><button class="btn" data-act="backup">Baixar backup</button></div>' +
    '</div>' +
    '<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">Usuários com acesso</span><span class="mono" style="font-size:11px">edite a lista USER_ROLES no código e crie o login no Firebase Authentication</span></div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>E-mail (Firebase)</th><th>Perfil</th></tr></thead><tbody>'+users+'</tbody></table></div></div>' +
    '<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">O que cada perfil pode fazer</span></div><div class="table-wrap"><table><thead><tr><th>Perfil</th><th>Movimentar estoque</th><th>Entregar EPI</th><th>Produtos</th><th>Empregados</th><th>Cadastros</th><th>Solicitar compra</th><th>Cotar / comprar</th><th>Aprovar compra</th><th>Administração</th></tr></thead><tbody>'+perms+'</tbody></table></div></div>' +
    '<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">Log de auditoria</span><span class="mono" style="font-size:11px">últimos '+logs.length+' registros</span></div><div class="table-wrap">' + (logs.length ? '<table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>' + logs.map(function(l){
      return '<tr><td class="mono">'+fmtDT(l.ts)+'</td><td>'+esc(l.usuario)+'</td><td>'+esc(l.acao)+'</td><td style="font-size:12px">'+esc(l.detalhe)+'</td></tr>'; }).join('') + '</tbody></table>' : emptyState('Sem registros.')) + '</div></div>';
}
