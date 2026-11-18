// =====================================================================
// DEVOLUÇÕES (avulsa, desligamento e troca por tamanho) + TERMO DE DEVOLUÇÃO
// =====================================================================
// devolucoes/<id> = {data, ts, empregadoId, motivo, obs, usuario, itens:[{entregaId, idx, pid, tk, qtd, ca, cond, loc}]}
// cond: 'reutilizar' (bom estado, volta ao estoque) · 'descartar' (gasto / sem condições) · 'nao_devolvido'
// O termo de devolução só sai quando há itens devolvidos em condições de uso (cond 'reutilizar').
var COND_DEV = [['reutilizar','Bom estado — volta ao estoque'],['descartar','Gasto / sem condições — descarte'],['nao_devolvido','Não devolvido']];

function registrarDevolucao(empId, motivo, linhas, data, obs, resp){
  linhas = linhas.filter(function(l){ return l.qtd > 0; });
  if(!linhas.length) return Promise.resolve(null);
  var ops = linhas.filter(function(l){ return l.cond === 'reutilizar'; }).map(function(l){ var it = DB.entregas[l.entregaId].itens[l.idx]; return {pid:it.pid, tk:it.tk, loc:l.loc, delta:l.qtd}; });
  return (ops.length ? applyStock(ops) : Promise.resolve()).then(function(){
    var p = {}, devId = store.key(), soma = {};
    linhas.forEach(function(l){
      var en = DB.entregas[l.entregaId], it = en.itens[l.idx], k = l.entregaId + '/itens/' + l.idx;
      soma[k] = soma[k] || {dev:+it.devolvido || 0, nao:+it.naoDevolvido || 0};
      if(l.cond === 'nao_devolvido') soma[k].nao += l.qtd; else soma[k].dev += l.qtd;
      var tipo = l.cond === 'reutilizar' ? 'devolucao' : (l.cond === 'descartar' ? 'devol_descarte' : 'nao_devolvido');
      p['movimentos/' + store.key()] = movRecord({data:data, tipo:tipo, pid:it.pid, tk:it.tk, loc:l.cond === 'reutilizar' ? l.loc : (en.loc || l.loc), qtd:l.qtd, empregadoId:empId, entregaId:l.entregaId, devolucaoId:devId,
        motivo: motivo + (l.cond === 'reutilizar' ? ' — bom estado' : l.cond === 'descartar' ? ' — gasto / sem condições (descarte)' : ' — não devolvido'), obs:obs || ''});
      l.pid = it.pid; l.tk = it.tk; l.ca = it.ca || '';
    });
    Object.keys(soma).forEach(function(k){ p['entregas/' + k + '/devolvido'] = soma[k].dev; if(soma[k].nao) p['entregas/' + k + '/naoDevolvido'] = soma[k].nao; });
    p['devolucoes/' + devId] = {data:data, ts:nowTs(), empregadoId:empId, motivo:motivo, obs:obs || '', usuario:currentUser.name, responsavel:resp || currentUser.name,
      itens:linhas.map(function(l){ return {entregaId:l.entregaId, idx:l.idx, pid:l.pid, tk:l.tk, qtd:l.qtd, ca:l.ca, cond:l.cond, loc:l.loc || ''}; })};
    var nRe = linhas.filter(function(l){ return l.cond === 'reutilizar'; }).length;
    return save(p, 'Devolução (' + motivo + ')', (DB.empregados[empId] || {}).nome + ' — ' + linhas.length + ' item(ns)').then(function(){ return {id:devId, temTermo:nRe > 0}; });
  });
}
function devTemTermo(d){ return d && (d.itens || []).some(function(i){ return i.cond === 'reutilizar'; }); }

var TEXTO_DEVOLUCAO = 'Declaro ter devolvido à empresa, nesta data, os Equipamentos de Proteção Individual (EPI) e/ou uniformes relacionados abaixo, ' +
  'em condições de uso, que estavam sob minha guarda e responsabilidade.';
function termoDevolucaoHtml(devId){
  var d = DB.devolucoes && DB.devolucoes[devId]; if(!devTemTermo(d)) return '';
  var e = DB.empregados[d.empregadoId] || {}, its = d.itens.filter(function(i){ return i.cond === 'reutilizar'; });
  return prHead('Termo de Devolução de EPI e Uniforme') + prEmpInfo(e) +
    '<div class="pr-text">' + TEXTO_DEVOLUCAO + '</div>' +
    '<table class="pr-table"><thead><tr><th>Qtd</th><th>Descrição</th><th>Tam.</th><th>CA</th><th>Entregue em</th><th>Condição</th></tr></thead><tbody>' +
    its.map(function(i){ var en = DB.entregas[i.entregaId] || {}; return '<tr><td>'+i.qtd+'</td><td>'+esc(nomeProd(i.pid))+'</td><td>'+esc(tamLabel(i.tk))+'</td><td>'+esc(i.ca || '—')+'</td><td>'+fmtD(en.data)+'</td><td>Em condições de uso</td></tr>'; }).join('') +
    '</tbody></table><div><b>Data da devolução:</b> '+fmtD(d.data)+' &nbsp; <b>Motivo:</b> '+esc(d.motivo || '')+(d.obs ? ' &nbsp; <b>Obs.:</b> ' + esc(d.obs) : '')+'</div>' +
    '<div class="pr-sign"><div><br><br>'+esc(e.nome || '')+'<br>Empregado</div><div><br><br>'+esc(d.responsavel || d.usuario || '')+'<br>Responsável pelo recebimento</div></div>';
}
function printTermoDevolucao(devId){ var h = termoDevolucaoHtml(devId); if(h) doPrint(h); }

// Itens em posse no termo de recebimento (posição atual)
function possePrintHtml(empId){
  var posse = itensEmPosse(empId).sort(function(a, b){ return (a.data || '') < (b.data || '') ? -1 : 1; });
  if(!posse.length) return '';
  return '<div class="pr-sub">EPIs e uniformes em posse do empregado (posição em '+fmtD(today())+')</div>' +
    '<table class="pr-table"><thead><tr><th>Qtd</th><th>Descrição</th><th>Tam.</th><th>CA</th><th>Entregue em</th><th>Próxima troca</th></tr></thead><tbody>' +
    posse.map(function(x){ return '<tr><td>'+x.aberto+'</td><td>'+esc(nomeProd(x.item.pid))+'</td><td>'+esc(tamLabel(x.item.tk))+'</td><td>'+esc(x.item.ca || '—')+'</td><td>'+fmtD(x.data)+'</td><td>'+fmtD(x.item.proximaTroca)+'</td></tr>'; }).join('') +
    '</tbody></table>';
}

// ---------- desligamento: devolve tudo o que está em posse ----------
function formDesligamento(empId){
  if(!can('entregar') && !can('empregados')) return;
  var e = DB.empregados[empId]; if(!e) return;
  var posse = itensEmPosse(empId);
  openModal('<div class="modal-title">Desligamento — '+esc(e.nome)+'</div>' +
    '<div class="modal-sub">'+(posse.length ? 'Informe o que foi devolvido. Só os itens em bom estado voltam ao estoque e entram no termo de devolução; gastos, sem condições de uso ou não devolvidos não geram termo.' : 'Este empregado não tem itens em posse.')+'</div>' +
    '<div class="modal-grid">' + field('Data do desligamento', '<input type="date" id="dl-data" value="'+today()+'">') + field('Devolver no local', '<select id="dl-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') + '</div>' +
    (posse.length ? '<table class="items-table" style="margin-top:8px"><thead><tr><th>Item</th><th>Tam.</th><th class="num">Em posse</th><th style="width:90px">Qtd</th><th>Condição</th></tr></thead><tbody>' + posse.map(function(x){
      return '<tr class="dl-row" data-ent="'+x.entregaId+'" data-idx="'+x.idx+'" data-max="'+x.aberto+'"><td>'+esc(nomeProd(x.item.pid))+'<span class="sub">entregue em '+fmtD(x.data)+'</span></td><td class="mono">'+esc(tamLabel(x.item.tk))+'</td><td class="num">'+x.aberto+'</td>' +
        '<td><input type="number" class="dl-qtd" min="0" max="'+x.aberto+'" value="'+x.aberto+'"></td><td><select class="dl-cond">'+optList(COND_DEV, 'reutilizar')+'</select></td></tr>';
    }).join('') + '</tbody></table>' : '') +
    '<div class="modal-grid">' + field('Observação', '<input id="dl-obs">') + field('Responsável pelo recebimento', '<input id="dl-resp" value="'+esc(currentUser.name || '')+'">', '', 'Nome que sai no termo.') + '</div>' +
    (posse.length ? '<label class="modal-check"><input type="checkbox" id="dl-print" checked> Imprimir o termo de devolução (só com os itens em bom estado)</label>' : '') +
    '<input type="hidden" id="dl-emp" value="'+empId+'">' + modalActions('Registrar desligamento', 'salvar-desligamento'), 'wide');
}
formHandlers['desligar-empregado'] = function(el){ formDesligamento(el.dataset.id); };
formHandlers['salvar-desligamento'] = function(btn){
  var empId = $('#dl-emp').value, data = $('#dl-data').value || today(), loc = $('#dl-loc').value, linhas = [], bad = '';
  $$('#modal-box .dl-row').forEach(function(tr){
    var q = Math.floor(num($('.dl-qtd', tr).value)), mx = +tr.dataset.max;
    if(q < 0 || q > mx){ bad = 'Quantidade deve ser entre 0 e ' + mx + '.'; return; }
    if(q > 0) linhas.push({entregaId:tr.dataset.ent, idx:+tr.dataset.idx, qtd:q, cond:$('.dl-cond', tr).value, loc:loc});
  });
  if(bad) return formError(bad);
  if(linhas.some(function(l){ return l.cond === 'reutilizar'; }) && !loc) return formError('Escolha o local para onde os itens voltam.');
  var imprimir = $('#dl-print') && $('#dl-print').checked, obs = $('#dl-obs').value.trim();
  busy(btn, true);
  registrarDevolucao(empId, 'Desligamento', linhas, data, obs, $('#dl-resp').value.trim()).then(function(r){
    var p = {}; p['empregados/' + empId + '/ativo'] = false; p['empregados/' + empId + '/desligadoEm'] = data;
    return save(p, 'Empregado desligado', (DB.empregados[empId] || {}).nome).then(function(){ return r; });
  }).then(function(r){
    closeModal(); toast('Desligamento registrado.' + (r && !r.temTermo ? ' Nenhum item em bom estado: sem termo de devolução.' : ''));
    if(r && r.temTermo && imprimir) setTimeout(function(){ printTermoDevolucao(r.id); }, 150);
  }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// Editar o responsável que sai no termo (entrega ou devolução já registrada)
formHandlers['editar-resp'] = function(el){
  if(!can('entregar')) return;
  var tipo = el.dataset.tipo, id = el.dataset.id, r = (DB[tipo] || {})[id]; if(!r) return;
  openModal('<div class="modal-title">Responsável no termo</div><div class="modal-sub">'+(tipo === 'entregas' ? 'Entrega' : 'Devolução')+' de '+fmtD(r.data)+' — '+esc((DB.empregados[r.empregadoId] || {}).nome || '')+'</div>' +
    '<div class="modal-grid">' + field(tipo === 'entregas' ? 'Responsável pela entrega' : 'Responsável pelo recebimento', '<input id="er-nome" value="'+esc(r.responsavel || r.usuario || '')+'">', 'full', 'Registrado no painel por: ' + esc(r.usuario || '—')) + '</div>' +
    '<input type="hidden" id="er-tipo" value="'+tipo+'"><input type="hidden" id="er-id" value="'+id+'">' + modalActions('Salvar', 'salvar-resp'));
};
formHandlers['salvar-resp'] = function(btn){
  var tipo = $('#er-tipo').value, id = $('#er-id').value, nome = $('#er-nome').value.trim(), r = DB[tipo][id];
  if(!nome) return formError('Informe o nome do responsável.');
  var p = {}; p[tipo + '/' + id + '/responsavel'] = nome;
  busy(btn, true);
  save(p, 'Responsável do termo alterado', (r.responsavel || r.usuario || '') + ' → ' + nome).then(function(){ closeModal(); toast('Responsável alterado.'); fichaEmpregado(r.empregadoId); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
