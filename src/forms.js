// =====================================================================
// MODAL GENÉRICO
// =====================================================================
var modalRefresh = null;
function openModal(html, size){
  var box = $('#modal-box');
  box.className = 'modal-box' + (size ? ' ' + size : '');
  box.innerHTML = html;
  $('#modal').classList.add('visible');
  var f = box.querySelector('input:not([type=hidden]):not([readonly]), select, textarea'); if(f && !f.dataset.nofocus) setTimeout(function(){ f.focus(); }, 30);
}
function closeModal(){ $('#modal').classList.remove('visible'); $('#modal-box').innerHTML = ''; modalRefresh = null; }
function formError(msg){ var e = $('#form-error'); if(e){ e.textContent = msg; e.style.display = msg ? 'block' : 'none'; } }
function field(label, inner, cls, hint){ return '<div class="modal-field '+(cls || '')+'"><label>'+label+'</label>'+inner+(hint ? '<div class="hint">'+hint+'</div>' : '')+'</div>'; }
function optList(list, sel, empty){ return (empty != null ? '<option value="">'+esc(empty)+'</option>' : '') + list.map(function(o){ return '<option value="'+esc(o[0])+'"'+(o[0] === sel ? ' selected' : '')+'>'+esc(o[1])+'</option>'; }).join(''); }
function locaisOpts(sel){ return vals(DB.locais).sort(byName).map(function(l){ return [l._id, l.nome]; }); }
function defaultLocal(){ var l = vals(DB.locais).sort(byName)[0]; return l ? l._id : ''; }
function modalActions(saveLabel, saveAct, extra){ return '<div id="form-error" class="form-error"></div><div class="modal-actions">'+(extra || '')+'<button class="btn btn-ghost" data-act="fechar">Cancelar</button><button class="btn btn-primary" data-act="'+saveAct+'">'+saveLabel+'</button></div>'; }
function busy(btn, on){ if(!btn) return; btn.disabled = on; if(on){ btn.dataset.txt = btn.textContent; btn.textContent = 'Salvando...'; } else if(btn.dataset.txt) btn.textContent = btn.dataset.txt; }

// =====================================================================
// AÇÕES (cliques com data-act)
// =====================================================================
function handleAction(a, el){
  var id = el.dataset.id;
  switch(a){
    case 'fechar': closeModal(); break;
    case 'nova-entrada': formEntrada(id); break;
    case 'nova-ajuste': formAjuste(id); break;
    case 'nova-transferencia': formTransferencia(); break;
    case 'nova-baixa': formBaixa(); break;
    case 'novo-produto': formProduto(); break;
    case 'editar-produto': if(can('produtos')) formProduto(id); else verProduto(id); break;
    case 'ver-produto': verProduto(id); break;
    case 'nova-entrega': formEntrega(id); break;
    case 'novo-empregado': formEmpregado(); break;
    case 'editar-empregado': formEmpregado(id); break;
    case 'ficha-empregado': fichaEmpregado(id); break;
    case 'devolver': formDevolucao(el.dataset.ent, +el.dataset.idx); break;
    case 'cad-novo': ({empresas:formEmpresa, cargos:formCargo, locais:formLocal})[tabs.cadastros](); break;
    case 'editar-empresa': formEmpresa(id); break;
    case 'editar-cargo': formCargo(id); break;
    case 'editar-local': formLocal(id); break;
    case 'print-termo': printTermo(id); break;
    case 'salvar-config': salvarConfig(); break;
    case 'backup': downloadBackup(); break;
    case 'importar-empregados': $('#file-import').value = ''; $('#file-import').click(); break;
    case 'export-estoque': exportEstoque(); break;
    case 'export-movs': exportXlsx('movimentacoes', filtroMovs().map(function(m){ var e = DB.empregados[m.empregadoId] || {}; var p = DB.produtos[m.pid] || {}; return {Data:fmtD(m.data), Tipo:(MOV_TIPOS[m.tipo] || {}).label || m.tipo, Produto:p.nome, CA:p.ca || '', Tamanho:tamLabel(m.tk), Quantidade:m.qtd * (((MOV_TIPOS[m.tipo] || {}).sinal) === -1 ? -1 : 1), 'Afeta saldo':((MOV_TIPOS[m.tipo] || {}).sinal) === 0 ? 'Não' : 'Sim', Local:nomeLocal(m.loc), Empregado:e.nome || '', Fornecedor:m.fornecedor || '', NF:m.doc || '', Motivo:m.motivo || '', 'Custo unit.':m.custoUnit || '', Usuario:m.usuario}; })); break;
    case 'export-produtos': exportXlsx('produtos', vals(DB.produtos).sort(byName).map(function(p){ return {Produto:p.nome, Categoria:p.categoria, CA:p.ca || '', 'Validade CA':fmtD(p.validadeCA), Fabricante:p.fabricante || '', 'Vida util (dias)':p.vidaUtilDias || '', Tamanhos:(p.tamanhos || []).join(', '), 'Estoque minimo':p.estoqueMinimo || 0, Custo:p.custo || 0, Saldo:saldoProduto(p._id), Ativo:p.ativo === false ? 'Não' : 'Sim'}; })); break;
    case 'export-entregas': exportEntregas(); break;
    case 'export-empregados': exportXlsx('empregados', vals(DB.empregados).sort(byName).map(function(e){ var t = e.tamanhos || {}; return {Nome:e.nome, Matricula:e.matricula || '', CPF:e.cpf || '', Empresa:nomeEmpresa(e.empresaId), Setor:e.setor || '', Cargo:nomeCargo(e.cargoId), Admissao:fmtD(e.admissao), Camisa:t.camisa || '', Calca:t.calca || '', Calcado:t.calcado || '', Luva:t.luva || '', Situacao:e.ativo === false ? 'Desligado' : 'Ativo', 'Itens em posse':itensEmPosse(e._id).reduce(function(s, x){ return s + x.aberto; }, 0)}; })); break;
    case 'rel-export': if(relData && relData.rows) exportXlsx(relData.nome, relData.rows); else toast('Nada para exportar nesta aba.', 'err'); break;
    case 'rel-print': printRelatorio(); break;
    default:
      if(formHandlers[a]) formHandlers[a](el);
  }
}
var formHandlers = {};
function onPick(el, fn){ var last = null; ['input','change'].forEach(function(ev){ el.addEventListener(ev, function(){ if(el.value === last && ev === 'change') return; last = el.value; fn(); }); }); }

// Linha de item com produto (datalist) + tamanho
function prodInput(cls, val){ return '<input class="'+cls+'" list="dl-produtos" placeholder="Digite para buscar..." value="'+esc(val || '')+'">'; }
function tamOptions(pid, sel, loc, comSaldo){
  return tamanhosProduto(pid).map(function(k){
    var s = saldoDe(pid, k, loc);
    return '<option value="'+esc(k)+'"'+(k === sel ? ' selected' : '')+'>'+esc(k === 'UN' ? 'Único' : k)+(comSaldo ? ' — saldo ' + s : '')+'</option>';
  }).join('');
}

// =====================================================================
// ENTRADA (compra / recebimento de NF) — vários itens
// =====================================================================
function formEntrada(pidInicial){
  if(!can('movimentar')) return;
  openModal('<div class="modal-title">Entrada de material</div><div class="modal-sub">Recebimento de compra ou nota fiscal. O saldo é somado no local escolhido.</div>' +
    '<div class="modal-grid three">' + field('Data', '<input type="date" id="f-data" value="'+today()+'">') + field('Local de estoque', '<select id="f-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') + field('Nota fiscal', '<input id="f-doc" placeholder="Nº da NF">') +
    field('Fornecedor', '<input id="f-forn" placeholder="Nome do fornecedor">', 'full') + '</div>' +
    '<div class="section-label">Itens</div><table class="items-table"><thead><tr><th style="width:44%">Produto</th><th>Tamanho</th><th style="width:90px">Qtd</th><th style="width:120px">Custo unit. (R$)</th><th style="width:36px"></th></tr></thead><tbody id="f-itens"></tbody></table>' +
    '<button class="btn btn-sm" style="margin-top:8px" data-act="add-item-entrada">+ Adicionar item</button>' +
    field('Observação', '<textarea id="f-obs" rows="2"></textarea>', 'full') + modalActions('Registrar entrada', 'salvar-entrada'), 'wide');
  addItemEntrada(pidInicial ? prodLabel(DB.produtos[pidInicial]) : '');
}
function addItemEntrada(label){
  var tr = document.createElement('tr');
  tr.innerHTML = '<td>'+prodInput('it-prod', label)+'<div class="err it-msg"></div></td><td><input class="it-tam" list="dl-tam-x" placeholder="Único"></td><td><input class="it-qtd" type="number" min="1" step="1" value="1"></td><td><input class="it-custo" placeholder="0,00"></td><td><button class="icon-btn" data-act="rm-item" title="Remover">×</button></td>';
  $('#f-itens').appendChild(tr);
  var pin = $('.it-prod', tr), tin = $('.it-tam', tr), dlId = 'dl-tam-' + Math.random().toString(36).slice(2, 8);
  tin.setAttribute('list', dlId); tr.insertAdjacentHTML('beforeend', '<datalist id="'+dlId+'"></datalist>');
  onPick(pin, function(){
    var pid = findProdByLabel(pin.value), p = DB.produtos[pid];
    $('.it-msg', tr).textContent = '';
    $('#' + dlId).innerHTML = pid ? tamanhosProduto(pid).filter(function(k){ return k !== 'UN'; }).map(function(k){ return '<option value="'+esc(k)+'">'; }).join('') : '';
    if(p && p.custo && !$('.it-custo', tr).value) $('.it-custo', tr).value = String(p.custo).replace('.', ',');
  });
  pin.addEventListener('blur', function(){ $('.it-msg', tr).textContent = pin.value && !findProdByLabel(pin.value) ? 'Produto não encontrado — cadastre-o antes.' : ''; });
  if(label) pin.dispatchEvent(new Event('input'));
}
formHandlers['add-item-entrada'] = function(){ addItemEntrada(''); };
formHandlers['rm-item'] = function(el){ var tb = el.closest('tbody'); if(tb.children.length > 1) el.closest('tr').remove(); };
formHandlers['salvar-entrada'] = function(btn){
  var data = $('#f-data').value, loc = $('#f-loc').value, itens = [];
  if(!loc) return formError('Cadastre um local de estoque primeiro.');
  var bad = null;
  $$('#f-itens tr').forEach(function(tr){
    var lab = $('.it-prod', tr).value.trim(); if(!lab) return;
    var pid = findProdByLabel(lab); if(!pid){ bad = 'Produto não encontrado: ' + lab; return; }
    var q = Math.floor(num($('.it-qtd', tr).value)); if(q <= 0){ bad = 'Quantidade inválida em ' + nomeProd(pid); return; }
    itens.push({pid: pid, tk: tamKey($('.it-tam', tr).value), qtd: q, custo: num($('.it-custo', tr).value)});
  });
  if(bad) return formError(bad);
  if(!itens.length) return formError('Adicione pelo menos um item.');
  busy(btn, true);
  // custo médio ponderado (calculado antes de somar o saldo)
  var custos = {};
  itens.forEach(function(i){
    if(!i.custo) return;
    var p = DB.produtos[i.pid]; var c = custos[i.pid] || {s: saldoProduto(i.pid), v: saldoProduto(i.pid) * (+p.custo || 0)};
    c.s += i.qtd; c.v += i.qtd * i.custo; custos[i.pid] = c;
  });
  applyStock(itens.map(function(i){ return {pid:i.pid, tk:i.tk, loc:loc, delta:i.qtd}; })).then(function(){
    var paths = {}, doc = $('#f-doc').value.trim(), forn = $('#f-forn').value.trim(), obs = $('#f-obs').value.trim();
    itens.forEach(function(i){
      paths['movimentos/' + store.key()] = movRecord({data:data, tipo:'entrada', pid:i.pid, tk:i.tk, loc:loc, qtd:i.qtd, custoUnit:i.custo || undefined, doc:doc, fornecedor:forn, obs:obs});
      var p = DB.produtos[i.pid];
      if(i.tk !== 'UN' && (p.tamanhos || []).map(tamKey).indexOf(i.tk) === -1) paths['produtos/' + i.pid + '/tamanhos'] = (p.tamanhos || []).concat([i.tk]);
    });
    Object.keys(custos).forEach(function(pid){ var c = custos[pid]; if(c.s > 0) paths['produtos/' + pid + '/custo'] = Math.round(c.v / c.s * 100) / 100; });
    return save(paths, 'Entrada', itens.length + ' item(ns)' + (doc ? ' · NF ' + doc : ''));
  }).then(function(){ closeModal(); toast('Entrada registrada.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// =====================================================================
// AJUSTE / INVENTÁRIO
// =====================================================================
function formAjuste(pid){
  if(!can('movimentar')) return;
  openModal('<div class="modal-title">Ajuste de estoque</div><div class="modal-sub">Use para corrigir o saldo após uma contagem (inventário) ou um lançamento errado.</div>' +
    '<div class="modal-grid">' + field('Produto', prodInput('', pid ? prodLabel(DB.produtos[pid]) : '').replace('<input', '<input id="f-prod"'), 'full') +
    field('Local', '<select id="f-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') + field('Tamanho', '<select id="f-tam"></select>') +
    field('Tipo de ajuste', '<select id="f-modo"><option value="definir">Definir saldo contado</option><option value="mais">Somar (+)</option><option value="menos">Subtrair (−)</option></select>') +
    field('Quantidade', '<input type="number" id="f-qtd" min="0" step="1">', '', '<span id="f-atual"></span>') +
    field('Motivo', '<select id="f-mot">'+optList(MOTIVOS_AJUSTE.map(function(m){ return [m, m]; }), MOTIVOS_AJUSTE[0])+'</select>') + field('Observação', '<input id="f-obs">') +
    '</div>' + modalActions('Aplicar ajuste', 'salvar-ajuste'));
  wireProdTam('#f-prod', '#f-tam', '#f-loc', '#f-atual');
}
function wireProdTam(prodSel, tamSel, locSel, infoSel){
  function upd(){
    var pid = findProdByLabel($(prodSel).value), loc = $(locSel).value;
    var cur = $(tamSel).value;
    $(tamSel).innerHTML = pid ? tamOptions(pid, cur, loc, true) : '';
    if(infoSel) $(infoSel).textContent = pid ? 'Saldo atual neste local: ' + saldoDe(pid, $(tamSel).value, loc) : '';
  }
  onPick($(prodSel), upd); $(locSel).addEventListener('change', upd);
  $(tamSel).addEventListener('change', function(){ var pid = findProdByLabel($(prodSel).value); if(infoSel && pid) $(infoSel).textContent = 'Saldo atual neste local: ' + saldoDe(pid, $(tamSel).value, $(locSel).value); });
  upd();
}
formHandlers['salvar-ajuste'] = function(btn){
  var pid = findProdByLabel($('#f-prod').value); if(!pid) return formError('Escolha um produto.');
  var loc = $('#f-loc').value, tk = $('#f-tam').value || 'UN', modo = $('#f-modo').value, q = Math.floor(num($('#f-qtd').value));
  if($('#f-qtd').value === '' || q < 0) return formError('Informe a quantidade.');
  var atual = saldoDe(pid, tk, loc), delta = modo === 'definir' ? q - atual : (modo === 'mais' ? q : -q);
  if(!delta) return formError('O saldo já é ' + atual + '. Nada a ajustar.');
  busy(btn, true);
  applyStock([{pid:pid, tk:tk, loc:loc, delta:delta}]).then(function(){
    var p = {}; p['movimentos/' + store.key()] = movRecord({tipo: delta > 0 ? 'ajuste_mais' : 'ajuste_menos', pid:pid, tk:tk, loc:loc, qtd:Math.abs(delta), motivo:$('#f-mot').value, obs:$('#f-obs').value.trim()});
    return save(p, 'Ajuste de estoque', nomeProd(pid) + ' ' + tamLabel(tk) + ': ' + atual + ' → ' + (atual + delta));
  }).then(function(){ closeModal(); toast('Ajuste aplicado.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// =====================================================================
// TRANSFERÊNCIA ENTRE LOCAIS
// =====================================================================
function formTransferencia(){
  if(!can('movimentar')) return;
  if(vals(DB.locais).length < 2){ toast('Cadastre pelo menos dois locais de estoque em Cadastros.', 'err'); return; }
  var lo = locaisOpts();
  openModal('<div class="modal-title">Transferência entre locais</div><div class="modal-grid">' +
    field('Produto', '<input id="f-prod" list="dl-produtos" placeholder="Digite para buscar...">', 'full') +
    field('Origem', '<select id="f-loc">'+optList(lo, lo[0][0])+'</select>') + field('Destino', '<select id="f-dest">'+optList(lo, lo[1][0])+'</select>') +
    field('Tamanho', '<select id="f-tam"></select>') + field('Quantidade', '<input type="number" id="f-qtd" min="1" step="1" value="1">', '', '<span id="f-atual"></span>') +
    field('Observação', '<input id="f-obs">', 'full') + '</div>' + modalActions('Transferir', 'salvar-transf'));
  wireProdTam('#f-prod', '#f-tam', '#f-loc', '#f-atual');
}
formHandlers['salvar-transf'] = function(btn){
  var pid = findProdByLabel($('#f-prod').value); if(!pid) return formError('Escolha um produto.');
  var o = $('#f-loc').value, d = $('#f-dest').value, tk = $('#f-tam').value || 'UN', q = Math.floor(num($('#f-qtd').value));
  if(o === d) return formError('Origem e destino são iguais.');
  if(q <= 0) return formError('Quantidade inválida.');
  busy(btn, true);
  applyStock([{pid:pid, tk:tk, loc:o, delta:-q}, {pid:pid, tk:tk, loc:d, delta:q}]).then(function(){
    var p = {}, obs = $('#f-obs').value.trim();
    p['movimentos/' + store.key()] = movRecord({tipo:'transf_saida', pid:pid, tk:tk, loc:o, locDest:d, qtd:q, obs:obs});
    p['movimentos/' + store.key()] = movRecord({tipo:'transf_entrada', pid:pid, tk:tk, loc:d, locDest:o, qtd:q, obs:obs});
    return save(p, 'Transferência', q + '× ' + nomeProd(pid) + ' ' + nomeLocal(o) + ' → ' + nomeLocal(d));
  }).then(function(){ closeModal(); toast('Transferência registrada.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// =====================================================================
// BAIXA (perda, dano, CA vencido...)
// =====================================================================
function formBaixa(){
  if(!can('movimentar')) return;
  openModal('<div class="modal-title">Baixa de estoque</div><div class="modal-sub">Retira do estoque itens perdidos, danificados ou com CA vencido.</div><div class="modal-grid">' +
    field('Produto', '<input id="f-prod" list="dl-produtos" placeholder="Digite para buscar...">', 'full') +
    field('Local', '<select id="f-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') + field('Tamanho', '<select id="f-tam"></select>') +
    field('Quantidade', '<input type="number" id="f-qtd" min="1" step="1" value="1">', '', '<span id="f-atual"></span>') +
    field('Motivo', '<select id="f-mot">'+optList(MOTIVOS_BAIXA.map(function(m){ return [m, m]; }), MOTIVOS_BAIXA[0])+'</select>') +
    field('Observação', '<input id="f-obs">', 'full') + '</div>' + modalActions('Dar baixa', 'salvar-baixa'));
  wireProdTam('#f-prod', '#f-tam', '#f-loc', '#f-atual');
}
formHandlers['salvar-baixa'] = function(btn){
  var pid = findProdByLabel($('#f-prod').value); if(!pid) return formError('Escolha um produto.');
  var loc = $('#f-loc').value, tk = $('#f-tam').value || 'UN', q = Math.floor(num($('#f-qtd').value));
  if(q <= 0) return formError('Quantidade inválida.');
  busy(btn, true);
  applyStock([{pid:pid, tk:tk, loc:loc, delta:-q}]).then(function(){
    var p = {}; p['movimentos/' + store.key()] = movRecord({tipo:'baixa', pid:pid, tk:tk, loc:loc, qtd:q, motivo:$('#f-mot').value, obs:$('#f-obs').value.trim()});
    return save(p, 'Baixa', q + '× ' + nomeProd(pid) + ' — ' + $('#f-mot').value);
  }).then(function(){ closeModal(); toast('Baixa registrada.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// =====================================================================
// PRODUTO
// =====================================================================
function formProduto(pid){
  if(!can('produtos')) return;
  var p = pid ? DB.produtos[pid] : {categoria:'EPI', unidade:'UN', ativo:true, vidaUtilDias:365};
  var vu = +p.vidaUtilDias || 0, vuUn = vu && vu % 365 === 0 ? 365 : (vu && vu % 30 === 0 ? 30 : 1), vuN = vu ? vu / vuUn : '';
  openModal('<div class="modal-title">'+(pid ? 'Editar produto' : 'Novo produto')+'</div><div class="modal-grid">' +
    field('Nome', '<input id="p-nome" value="'+esc(p.nome || '')+'">', 'full') +
    field('Categoria', '<select id="p-cat">'+optList([['EPI','EPI'],['Uniforme','Uniforme'],['Material','Material']], p.categoria)+'</select>') +
    field('Unidade', '<input id="p-un" value="'+esc(p.unidade || 'UN')+'">') +
    field('Nº do CA', '<div style="display:flex;gap:8px"><input id="p-ca" value="'+esc(p.ca || '')+'" placeholder="Só para EPI" inputmode="numeric"><button class="btn btn-sm" data-act="consultar-ca" type="button">Consultar</button></div><input type="hidden" id="p-ca-sit" value="'+esc(p.caSituacao || '')+'">', '', 'Ao sair do campo, a validade é buscada na base oficial.') +
    field('Validade do CA', '<input type="date" id="p-val" value="'+esc(p.validadeCA || '')+'">') +
    '<div class="full" id="p-ca-info" style="grid-column:1/-1"></div>' +
    field('Fabricante / marca', '<input id="p-fab" value="'+esc(p.fabricante || '')+'">', 'full') +
    field('Vida útil (troca)', '<div style="display:flex;gap:8px"><input type="number" id="p-vu" min="0" value="'+vuN+'" style="width:90px"><select id="p-vuun">'+optList([['1','dias'],['30','meses'],['365','anos']], String(vuUn))+'</select></div>', '', 'Usada para calcular a próxima troca.') +
    field('Estoque mínimo', '<input type="number" id="p-min" min="0" value="'+(p.estoqueMinimo || 0)+'">', '', 'Gera alerta quando o saldo total ficar abaixo.') +
    field('Tamanhos', '<input id="p-tams" value="'+esc((p.tamanhos || []).join(', '))+'" placeholder="Ex.: P, M, G, GG  ou  36, 38, 40">', 'full', 'Separe por vírgula. Deixe vazio para produto de tamanho único.') +
    field('Custo médio (R$)', '<input id="p-custo" value="'+(p.custo ? String(p.custo).replace('.', ',') : '')+'">', '', 'Atualizado automaticamente nas entradas com custo.') +
    field('Situação', '<select id="p-ativo">'+optList([['1','Ativo'],['0','Inativo']], p.ativo === false ? '0' : '1')+'</select>') +
    '</div>' + modalActions('Salvar', 'salvar-produto', pid && can('admin') && !saldoProduto(pid) && !vals(DB.movimentos).some(function(m){ return m.pid === pid; }) ? '<button class="btn btn-danger" data-act="excluir-produto" data-id="'+pid+'" style="margin-right:auto">Excluir</button>' : '') + (pid ? '<input type="hidden" id="p-id" value="'+pid+'">' : ''));
  wireCAProduto();
}
formHandlers['salvar-produto'] = function(btn){
  if(($('#p-ca').value.trim()) !== ((DB.produtos[($('#p-id') || {}).value] || {}).ca || '') && !$('#p-ca-info').innerHTML) $('#p-ca-sit').value = '';
  var pid = ($('#p-id') || {}).value, nome = $('#p-nome').value.trim();
  if(!nome) return formError('Informe o nome.');
  var dup = vals(DB.produtos).find(function(x){ return x._id !== pid && norm(x.nome) === norm(nome); });
  if(dup) return formError('Já existe um produto com esse nome.');
  var tams = $('#p-tams').value.split(',').map(function(t){ return tamKey(t); }).filter(function(t){ return t && t !== 'UN'; });
  var rec = Object.assign({}, pid ? DB.produtos[pid] : {}, {
    nome: nome, categoria: $('#p-cat').value, unidade: $('#p-un').value.trim() || 'UN', ca: $('#p-ca').value.trim(), validadeCA: $('#p-val').value,
    fabricante: $('#p-fab').value.trim(), vidaUtilDias: Math.round(num($('#p-vu').value) * +$('#p-vuun').value), estoqueMinimo: Math.floor(num($('#p-min').value)),
    tamanhos: tams, custo: num($('#p-custo').value), ativo: $('#p-ativo').value === '1', atualizadoEm: nowTs(),
    caSituacao: $('#p-ca').value.trim() ? $('#p-ca-sit').value : ''
  });
  delete rec._id;
  var id = pid || store.key(), paths = {}; paths['produtos/' + id] = rec;
  busy(btn, true);
  save(paths, pid ? 'Produto alterado' : 'Produto criado', nome).then(function(){ closeModal(); toast('Produto salvo.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['excluir-produto'] = function(el){
  var pid = el.dataset.id; if(!confirmInline(el, 'Confirmar exclusão')) return;
  var p = {}; p['produtos/' + pid] = null; p['saldos/' + pid] = null;
  save(p, 'Produto excluído', nomeProd(pid)).then(function(){ closeModal(); toast('Produto excluído.'); });
};
// confirmação em dois cliques (evita alert/confirm do navegador)
function confirmInline(el, txt){
  if(el.dataset.armed){ return true; }
  el.dataset.orig = el.textContent; el.dataset.armed = '1'; el.textContent = txt + '?'; setTimeout(function(){ if(el.isConnected){ delete el.dataset.armed; el.textContent = el.dataset.orig || 'Excluir'; } }, 4000);
  return false;
}

function verProduto(pid){
  var p = DB.produtos[pid]; if(!p) return;
  var locs = vals(DB.locais).sort(byName), tams = tamanhosProduto(pid), ca = caStatus(p);
  var grid = '<table class="items-table"><thead><tr><th>Tamanho</th>' + locs.map(function(l){ return '<th class="num">'+esc(l.nome)+'</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
    tams.map(function(k){ return '<tr><td class="mono">'+esc(k === 'UN' ? 'Único' : k)+'</td>' + locs.map(function(l){ return '<td class="num">'+saldoDe(pid, k, l._id)+'</td>'; }).join('') + '<td class="num"><b>'+saldoDe(pid, k)+'</b></td></tr>'; }).join('') + '</tbody></table>';
  var movs = vals(DB.movimentos).filter(function(m){ return m.pid === pid; }).sort(function(a, b){ return b.ts - a.ts; }).slice(0, 15);
  openModal('<div class="modal-title">'+esc(p.nome)+'</div><div class="info-grid">' +
    '<div><div class="lbl">Categoria</div>'+esc(p.categoria)+'</div><div><div class="lbl">CA</div>'+esc(p.ca || '—')+(p.ca ? ' <span class="pill '+ca.cls+'" style="padding:1px 7px;font-size:10.5px">'+ca.txt+'</span>' : '')+'</div>' +
    '<div><div class="lbl">Validade CA</div>'+fmtD(p.validadeCA)+'</div><div><div class="lbl">Vida útil</div>'+vidaUtilTxt(p.vidaUtilDias)+'</div>' +
    '<div><div class="lbl">Saldo total</div>'+fmtN(saldoProduto(pid))+'</div><div><div class="lbl">Mínimo</div>'+(p.estoqueMinimo || '—')+'</div><div><div class="lbl">Custo médio</div>'+(p.custo ? fmtR(p.custo) : '—')+'</div><div><div class="lbl">Fabricante</div>'+esc(p.fabricante || '—')+'</div></div>' +
    '<div class="section-label">Saldo por tamanho e local</div>' + grid +
    '<div class="section-label">Últimas movimentações</div>' + (movs.length ? '<div class="table-wrap">' + movTable(movs, true) + '</div>' : '<div style="color:var(--text-faint);font-size:12.5px">Nenhuma.</div>') +
    '<div class="modal-actions"><button class="btn btn-ghost" data-act="fechar">Fechar</button>' +
    (can('produtos') ? '<button class="btn" data-act="editar-produto" data-id="'+pid+'">Editar cadastro</button>' : '') +
    (can('movimentar') ? '<button class="btn" data-act="nova-ajuste" data-id="'+pid+'">Ajustar</button><button class="btn btn-primary" data-act="nova-entrada" data-id="'+pid+'">+ Entrada</button>' : '') + '</div>', 'wide');
}

// =====================================================================
// ENTREGA DE EPI (com kit do cargo, tamanhos e assinatura)
// =====================================================================
var sigPad = null;
function grupoTamanho(p){
  var n = norm(p.nome), t = (p.tamanhos || [])[0] || '';
  if(/^\d+$/.test(t) && +t >= 30 && +t <= 50 && /bota|botina|sapato|coturno|galocha|tenis|calcado/.test(n)) return 'calcado';
  if(/luva/.test(n)) return 'luva';
  if(/calca|bermuda|short/.test(n)) return 'calca';
  return 'camisa';
}
function formEntrega(empId){
  if(!can('entregar')) return;
  if(!vals(DB.empregados).length){ toast('Cadastre os empregados primeiro.', 'err'); showView('empregados'); return; }
  var e = empId ? DB.empregados[empId] : null;
  openModal('<div class="modal-title">Entrega de EPI / uniforme</div>' +
    '<div class="modal-grid three">' + field('Empregado', '<input id="e-emp" list="dl-empregados" placeholder="Digite o nome..." value="'+esc(e ? empLabel(e) : '')+'">', 'full') +
    '<div class="full" id="e-info" style="grid-column:1/-1"></div>' +
    field('Data', '<input type="date" id="e-data" value="'+today()+'">') + field('Retirar do local', '<select id="e-loc">'+optList(locaisOpts(), defaultLocal())+'</select>') +
    field('Motivo', '<select id="e-mot">'+optList(MOTIVOS_ENTREGA.map(function(m){ return [m, m]; }), MOTIVOS_ENTREGA[0])+'</select>') + '</div>' +
    '<div class="section-label" style="display:flex;align-items:center;justify-content:space-between">Itens <button class="btn btn-sm" data-act="carregar-kit">Carregar kit do cargo</button></div>' +
    '<table class="items-table"><thead><tr><th style="width:46%">Produto</th><th>Tamanho</th><th style="width:80px">Qtd</th><th>Próxima troca</th><th style="width:36px"></th></tr></thead><tbody id="e-itens"></tbody></table>' +
    '<button class="btn btn-sm" style="margin-top:8px" data-act="add-item-entrega">+ Adicionar item</button>' +
    field('Observação', '<input id="e-obs">', 'full') +
    '<div class="section-label">Assinatura do empregado</div><div class="sig-wrap"><canvas id="e-sig"></canvas><button class="btn btn-sm sig-clear" data-act="limpar-assinatura" style="background:#fff;color:#333;border-color:#ccc">Limpar</button><span class="sig-hint">Assine aqui com o dedo ou o mouse</span></div>' +
    '<label class="modal-check"><input type="checkbox" id="e-print" checked> Imprimir o termo de recebimento ao salvar</label>' +
    modalActions('Registrar entrega', 'salvar-entrega'), 'wide');
  onPick($('#e-emp'), entregaEmpChanged);
  $('#e-data').addEventListener('change', function(){ $$('#e-itens tr').forEach(function(tr){ refreshItemEntrega(tr); }); });
  $('#e-loc').addEventListener('change', function(){ $$('#e-itens tr').forEach(function(tr){ refreshItemEntrega(tr); }); });
  sigPad = initSignature($('#e-sig'));
  entregaEmpChanged();
  if(e && e.cargoId && (DB.cargos[e.cargoId] || {}).kit && itensEmPosse(empId).length === 0) carregarKit();
  else addItemEntrega();
}
function entregaEmpChanged(){
  var id = findEmpByLabel($('#e-emp').value), e = DB.empregados[id], box = $('#e-info');
  if(!e){ box.innerHTML = ''; return; }
  var t = e.tamanhos || {}, posse = itensEmPosse(id);
  box.innerHTML = '<div class="info-grid" style="background:#0D1526;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0">' +
    '<div><div class="lbl">Empresa</div>'+esc(nomeEmpresa(e.empresaId))+'</div><div><div class="lbl">Cargo</div>'+esc(nomeCargo(e.cargoId))+'</div>' +
    '<div><div class="lbl">Tamanhos</div>Camisa '+esc(t.camisa || '—')+' · Calça '+esc(t.calca || '—')+' · Calçado '+esc(t.calcado || '—')+' · Luva '+esc(t.luva || '—')+'</div>' +
    '<div><div class="lbl">Em posse</div>'+(posse.length ? posse.map(function(x){ return esc(x.aberto + '× ' + nomeProd(x.item.pid)); }).join(', ') : 'Nada')+'</div></div>';
  $$('#e-itens tr').forEach(function(tr){ refreshItemEntrega(tr, true); });
}
function addItemEntrega(pid, qtd){
  var tr = document.createElement('tr');
  tr.innerHTML = '<td>'+prodInput('it-prod', pid ? prodLabel(DB.produtos[pid]) : '')+'<div class="it-msg"></div></td><td><select class="it-tam"></select></td><td><input class="it-qtd" type="number" min="1" step="1" value="'+(qtd || 1)+'"></td><td class="mono it-troca" style="padding-top:13px">—</td><td><button class="icon-btn" data-act="rm-item" title="Remover">×</button></td>';
  $('#e-itens').appendChild(tr);
  onPick($('.it-prod', tr), function(){ refreshItemEntrega(tr, true); });
  $('.it-tam', tr).addEventListener('change', function(){ refreshItemEntrega(tr); });
  $('.it-qtd', tr).addEventListener('input', function(){ refreshItemEntrega(tr); });
  refreshItemEntrega(tr, true);
}
function refreshItemEntrega(tr, autoTam){
  var pid = findProdByLabel($('.it-prod', tr).value), p = DB.produtos[pid], loc = $('#e-loc').value, msg = $('.it-msg', tr);
  var sel = $('.it-tam', tr);
  if(!p){ sel.innerHTML = ''; $('.it-troca', tr).textContent = '—'; msg.className = 'err it-msg'; msg.textContent = $('.it-prod', tr).value ? 'Produto não encontrado.' : ''; return; }
  var cur = sel.value;
  if(autoTam){
    var emp = DB.empregados[findEmpByLabel($('#e-emp').value)];
    var pref = emp && emp.tamanhos ? tamKey(emp.tamanhos[grupoTamanho(p)]) : '';
    if(pref && tamanhosProduto(pid).indexOf(pref) !== -1) cur = pref;
  }
  sel.innerHTML = tamOptions(pid, cur, loc, true);
  if(!sel.value || (autoTam && !cur)){ var withStock = tamanhosProduto(pid).find(function(k){ return saldoDe(pid, k, loc) > 0; }); if(withStock) sel.value = withStock; }
  var data = $('#e-data').value || today();
  $('.it-troca', tr).textContent = p.vidaUtilDias ? fmtD(addDays(data, +p.vidaUtilDias)) : '—';
  var avisos = [], erro = '';
  var s = saldoDe(pid, sel.value, loc), q = Math.floor(num($('.it-qtd', tr).value));
  if(q > s) erro = 'Saldo insuficiente neste local (' + s + ').';
  var ca = caStatus(p); if(p.ca && ca.cls === 'red') avisos.push('CA vencido em ' + fmtD(p.validadeCA) + '.');
  var empId = findEmpByLabel($('#e-emp').value);
  if(empId){
    var antes = itensEmPosse(empId).find(function(x){ return x.item.pid === pid; });
    if(antes && antes.item.proximaTroca && daysUntil(antes.item.proximaTroca) > 0) avisos.push('Já recebeu em ' + fmtD(antes.data) + ' — troca prevista só em ' + fmtD(antes.item.proximaTroca) + '.');
  }
  msg.className = erro ? 'err it-msg' : 'warn it-msg';
  msg.textContent = erro || avisos.join(' ');
}
function carregarKit(){
  var e = DB.empregados[findEmpByLabel($('#e-emp').value)];
  if(!e){ formError('Escolha o empregado primeiro.'); return; }
  var kit = (DB.cargos[e.cargoId] || {}).kit || [];
  if(!kit.length){ formError('O cargo deste empregado não tem kit definido (Cadastros > Cargos).'); return; }
  formError('');
  $$('#e-itens tr').forEach(function(tr){ if(!$('.it-prod', tr).value) tr.remove(); });
  kit.forEach(function(k){ if(DB.produtos[k.pid] && DB.produtos[k.pid].ativo !== false) addItemEntrega(k.pid, k.qtd); });
}
formHandlers['carregar-kit'] = carregarKit;
formHandlers['add-item-entrega'] = function(){ addItemEntrega(); };
formHandlers['limpar-assinatura'] = function(){ if(sigPad) sigPad.clear(); };
formHandlers['salvar-entrega'] = function(btn){
  var empId = findEmpByLabel($('#e-emp').value); if(!empId) return formError('Escolha o empregado.');
  var loc = $('#e-loc').value, data = $('#e-data').value || today(), itens = [], bad = null;
  if(!loc) return formError('Cadastre um local de estoque.');
  $$('#e-itens tr').forEach(function(tr){
    var lab = $('.it-prod', tr).value.trim(); if(!lab) return;
    var pid = findProdByLabel(lab); if(!pid){ bad = 'Produto não encontrado: ' + lab; return; }
    var q = Math.floor(num($('.it-qtd', tr).value)); if(q <= 0){ bad = 'Quantidade inválida.'; return; }
    var p = DB.produtos[pid];
    itens.push({pid: pid, tk: $('.it-tam', tr).value || 'UN', qtd: q, ca: p.ca || '', validadeCA: p.validadeCA || '', proximaTroca: p.vidaUtilDias ? addDays(data, +p.vidaUtilDias) : ''});
  });
  if(bad) return formError(bad);
  if(!itens.length) return formError('Adicione pelo menos um item.');
  var assinatura = sigPad && !sigPad.isEmpty() ? sigPad.toDataURL() : '';
  var imprimir = $('#e-print').checked;
  busy(btn, true);
  applyStock(itens.map(function(i){ return {pid:i.pid, tk:i.tk, loc:loc, delta:-i.qtd}; })).then(function(){
    var entId = store.key(), paths = {};
    // itens anteriores do mesmo produto ficam marcados como substituídos (não entram mais nas trocas pendentes)
    itensEmPosse(empId).forEach(function(x){ if(itens.some(function(i){ return i.pid === x.item.pid; })) paths['entregas/' + x.entregaId + '/itens/' + x.idx + '/substituidoPor'] = entId; });
    itens.forEach(function(i){ paths['movimentos/' + store.key()] = movRecord({data:data, tipo:'entrega', pid:i.pid, tk:i.tk, loc:loc, qtd:i.qtd, empregadoId:empId, entregaId:entId, custoUnit:(DB.produtos[i.pid] || {}).custo || undefined, motivo:$('#e-mot').value}); });
    paths['entregas/' + entId] = {data:data, ts:nowTs(), empregadoId:empId, loc:loc, motivo:$('#e-mot').value, obs:$('#e-obs').value.trim(), itens:itens, assinatura:assinatura, usuario:currentUser.name};
    return save(paths, 'Entrega de EPI', (DB.empregados[empId] || {}).nome + ' — ' + itens.length + ' item(ns)').then(function(){ return entId; });
  }).then(function(entId){ closeModal(); toast('Entrega registrada.'); if(imprimir) setTimeout(function(){ printTermo(entId); }, 150); })
    .catch(function(e){ busy(btn, false); formError(e.message); });
};

// Assinatura em canvas (dedo, caneta ou mouse)
function initSignature(cv){
  var ctx, drawing = false, empty = true, last = null;
  function size(){ var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; ctx = cv.getContext('2d'); ctx.scale(d, d); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B1220'; }
  setTimeout(size, 30);
  function pos(e){ var r = cv.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; }
  cv.addEventListener('pointerdown', function(e){ drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); var h = cv.parentNode.querySelector('.sig-hint'); if(h) h.style.display = 'none'; });
  cv.addEventListener('pointermove', function(e){ if(!drawing) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; empty = false; });
  ['pointerup','pointercancel','pointerleave'].forEach(function(ev){ cv.addEventListener(ev, function(){ drawing = false; }); });
  return {
    clear: function(){ ctx.clearRect(0, 0, cv.width, cv.height); empty = true; var h = cv.parentNode.querySelector('.sig-hint'); if(h) h.style.display = ''; },
    isEmpty: function(){ return empty; },
    toDataURL: function(){
      // reduz para economizar espaço no banco
      var o = document.createElement('canvas'); o.width = 420; o.height = Math.round(420 * cv.height / cv.width);
      o.getContext('2d').drawImage(cv, 0, 0, o.width, o.height); return o.toDataURL('image/png');
    }
  };
}

// =====================================================================
// DEVOLUÇÃO
// =====================================================================
function formDevolucao(entId, idx){
  if(!can('entregar')) return;
  var en = DB.entregas[entId], it = en && en.itens[idx]; if(!it) return;
  var aberto = it.qtd - (it.devolvido || 0);
  openModal('<div class="modal-title">Devolução</div><div class="modal-sub">'+esc((DB.empregados[en.empregadoId] || {}).nome)+' — '+esc(nomeProd(it.pid))+(it.tk !== 'UN' ? ' ('+esc(it.tk)+')' : '')+', entregue em '+fmtD(en.data)+'</div><div class="modal-grid">' +
    field('Quantidade devolvida', '<input type="number" id="d-qtd" min="1" max="'+aberto+'" value="'+aberto+'">') +
    field('Condição', '<select id="d-cond"><option value="reutilizar">Em bom estado — volta ao estoque</option><option value="descartar">Danificado — descartar</option></select>') +
    field('Local (se voltar ao estoque)', '<select id="d-loc">'+optList(locaisOpts(), en.loc || defaultLocal())+'</select>') + field('Data', '<input type="date" id="d-data" value="'+today()+'">') +
    field('Observação', '<input id="d-obs">', 'full') + '<input type="hidden" id="d-ent" value="'+entId+'"><input type="hidden" id="d-idx" value="'+idx+'"></div>' + modalActions('Registrar devolução', 'salvar-devolucao'));
}
formHandlers['salvar-devolucao'] = function(btn){
  var entId = $('#d-ent').value, idx = +$('#d-idx').value, en = DB.entregas[entId], it = en.itens[idx];
  var q = Math.floor(num($('#d-qtd').value)), aberto = it.qtd - (it.devolvido || 0);
  if(q <= 0 || q > aberto) return formError('Quantidade deve ser entre 1 e ' + aberto + '.');
  var reut = $('#d-cond').value === 'reutilizar', loc = $('#d-loc').value, data = $('#d-data').value || today();
  busy(btn, true);
  (reut ? applyStock([{pid:it.pid, tk:it.tk, loc:loc, delta:q}]) : Promise.resolve()).then(function(){
    var p = {};
    p['entregas/' + entId + '/itens/' + idx + '/devolvido'] = (it.devolvido || 0) + q;
    // descartado: registra a devolução sem somar ao estoque
    p['movimentos/' + store.key()] = movRecord({data:data, tipo: reut ? 'devolucao' : 'devol_descarte', pid:it.pid, tk:it.tk, loc: reut ? loc : (en.loc || loc), qtd:q, empregadoId:en.empregadoId, entregaId:entId, motivo: reut ? 'Devolução (reutilizável)' : 'Devolvido e descartado', obs:$('#d-obs').value.trim()});
    return save(p, 'Devolução', (DB.empregados[en.empregadoId] || {}).nome + ' — ' + q + '× ' + nomeProd(it.pid) + (reut ? '' : ' (descartado)'));
  }).then(function(){ closeModal(); toast('Devolução registrada.'); fichaEmpregado(en.empregadoId); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// =====================================================================
// EMPREGADO
// =====================================================================
function formEmpregado(id){
  if(!can('empregados')) return;
  var e = id ? DB.empregados[id] : {ativo:true}, t = e.tamanhos || {};
  var emp = vals(DB.empresas).sort(byName).map(function(x){ return [x._id, x.nome]; }), car = vals(DB.cargos).sort(byName).map(function(x){ return [x._id, x.nome]; });
  openModal('<div class="modal-title">'+(id ? 'Editar empregado' : 'Novo empregado')+'</div><div class="modal-grid">' +
    field('Nome completo', '<input id="m-nome" value="'+esc(e.nome || '')+'">', 'full') +
    field('Matrícula', '<input id="m-mat" value="'+esc(e.matricula || '')+'">') + field('CPF', '<input id="m-cpf" value="'+esc(e.cpf || '')+'" placeholder="Opcional">') +
    field('Empresa / unidade', '<select id="m-emp">'+optList(emp, e.empresaId, 'Selecione...')+'</select>', '', emp.length ? '' : 'Cadastre em Cadastros > Empresas') +
    field('Cargo', '<select id="m-car">'+optList(car, e.cargoId, 'Selecione...')+'</select>', '', car.length ? '' : 'Cadastre em Cadastros > Cargos') +
    field('Setor', '<input id="m-set" value="'+esc(e.setor || '')+'">') + field('Admissão', '<input type="date" id="m-adm" value="'+esc(e.admissao || '')+'">') +
    '</div><div class="section-label">Tamanhos</div><div class="modal-grid" style="grid-template-columns:repeat(4,1fr)">' +
    field('Camisa / jaleco', '<input id="m-t-camisa" value="'+esc(t.camisa || '')+'" placeholder="P, M, G...">') + field('Calça', '<input id="m-t-calca" value="'+esc(t.calca || '')+'">') +
    field('Calçado', '<input id="m-t-calcado" value="'+esc(t.calcado || '')+'" placeholder="38, 40...">') + field('Luva', '<input id="m-t-luva" value="'+esc(t.luva || '')+'">') +
    '</div><div class="modal-grid" style="margin-top:12px">' + field('Situação', '<select id="m-ativo">'+optList([['1','Ativo'],['0','Desligado']], e.ativo === false ? '0' : '1')+'</select>') + '</div>' +
    (id ? '<input type="hidden" id="m-id" value="'+id+'">' : '') + modalActions('Salvar', 'salvar-empregado'), 'wide');
}
formHandlers['salvar-empregado'] = function(btn){
  var id = ($('#m-id') || {}).value, nome = $('#m-nome').value.trim(); if(!nome) return formError('Informe o nome.');
  var mat = $('#m-mat').value.trim();
  if(mat && vals(DB.empregados).some(function(x){ return x._id !== id && x.matricula === mat && x.empresaId === $('#m-emp').value; })) return formError('Já existe um empregado com essa matrícula nesta empresa.');
  var rec = Object.assign({}, id ? DB.empregados[id] : {}, {nome:nome, matricula:mat, cpf:$('#m-cpf').value.trim(), empresaId:$('#m-emp').value, cargoId:$('#m-car').value, setor:$('#m-set').value.trim(), admissao:$('#m-adm').value,
    tamanhos:{camisa:$('#m-t-camisa').value.trim().toUpperCase(), calca:$('#m-t-calca').value.trim().toUpperCase(), calcado:$('#m-t-calcado').value.trim().toUpperCase(), luva:$('#m-t-luva').value.trim().toUpperCase()},
    ativo:$('#m-ativo').value === '1', atualizadoEm:nowTs()});
  delete rec._id;
  var key = id || store.key(), p = {}; p['empregados/' + key] = rec;
  busy(btn, true);
  save(p, id ? 'Empregado alterado' : 'Empregado criado', nome).then(function(){ closeModal(); toast('Empregado salvo.'); if(id) fichaEmpregado(id); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
function fichaEmpregado(id){
  var e = DB.empregados[id]; if(!e) return;
  var t = e.tamanhos || {}, posse = itensEmPosse(id);
  var hist = vals(DB.entregas).filter(function(en){ return en.empregadoId === id && !en.cancelada; }).sort(function(a, b){ return b.ts - a.ts; });
  openModal('<div class="modal-title">'+esc(e.nome)+(e.ativo === false ? ' <span class="pill gray">Desligado</span>' : '')+'</div><div class="info-grid">' +
    '<div><div class="lbl">Matrícula</div>'+esc(e.matricula || '—')+'</div><div><div class="lbl">Empresa</div>'+esc(nomeEmpresa(e.empresaId))+'</div><div><div class="lbl">Cargo</div>'+esc(nomeCargo(e.cargoId))+'</div><div><div class="lbl">Setor</div>'+esc(e.setor || '—')+'</div>' +
    '<div><div class="lbl">Admissão</div>'+fmtD(e.admissao)+'</div><div><div class="lbl">CPF</div>'+esc(e.cpf || '—')+'</div><div style="grid-column:span 2"><div class="lbl">Tamanhos</div>Camisa '+esc(t.camisa || '—')+' · Calça '+esc(t.calca || '—')+' · Calçado '+esc(t.calcado || '—')+' · Luva '+esc(t.luva || '—')+'</div></div>' +
    '<div class="section-label">Itens em posse</div>' + (posse.length ? '<table class="items-table"><thead><tr><th>Item</th><th>Tam.</th><th class="num">Qtd</th><th>CA</th><th>Entregue</th><th>Troca prevista</th><th></th></tr></thead><tbody>' + posse.map(function(x){
      var d = daysUntil(x.item.proximaTroca);
      return '<tr><td>'+esc(nomeProd(x.item.pid))+'</td><td class="mono">'+esc(tamLabel(x.item.tk))+'</td><td class="num">'+x.aberto+'</td><td class="mono">'+esc(x.item.ca || '—')+'</td><td class="mono">'+fmtD(x.data)+'</td>' +
        '<td>'+(x.item.proximaTroca ? fmtD(x.item.proximaTroca) + ' <span class="pill '+(d < 0 ? 'red' : d <= +cfg('diasAlertaTroca', 15) ? 'amber' : 'gray')+'" style="padding:1px 7px;font-size:10.5px">'+(d < 0 ? 'vencida' : d + 'd')+'</span>' : '—')+'</td>' +
        '<td><button class="btn btn-sm" data-act="devolver" data-ent="'+x.entregaId+'" data-idx="'+x.idx+'"'+(can('entregar') ? '' : ' disabled')+'>Devolver</button></td></tr>';
    }).join('') + '</tbody></table>' : '<div style="color:var(--text-faint);font-size:12.5px">Nenhum item em posse.</div>') +
    '<div class="section-label">Histórico de entregas</div>' + (hist.length ? '<table class="items-table"><thead><tr><th>Data</th><th>Itens</th><th>Motivo</th><th>Assinatura</th><th></th></tr></thead><tbody>' + hist.map(function(en){
      return '<tr><td class="mono">'+fmtD(en.data)+'</td><td style="font-size:12px">'+(en.itens || []).map(function(i){ return esc(i.qtd + '× ' + nomeProd(i.pid) + (i.tk !== 'UN' ? ' (' + i.tk + ')' : '')) + (i.devolvido ? ' <span class="pill gray" style="padding:0 6px;font-size:10px">dev. ' + i.devolvido + '</span>' : ''); }).join('<br>')+'</td><td style="font-size:12px">'+esc(en.motivo || '')+'</td><td>'+(en.assinatura ? '<span class="pill teal">Sim</span>' : '<span class="pill amber">Não</span>')+'</td><td><button class="btn btn-sm" data-act="print-termo" data-id="'+en._id+'">Termo</button></td></tr>';
    }).join('') + '</tbody></table>' : '<div style="color:var(--text-faint);font-size:12.5px">Nenhuma entrega registrada.</div>') +
    '<div class="modal-actions"><button class="btn btn-ghost" data-act="fechar">Fechar</button>' +
    (can('empregados') ? '<button class="btn" data-act="editar-empregado" data-id="'+id+'">Editar</button>' : '') +
    (can('entregar') && e.ativo !== false ? '<button class="btn btn-primary" data-act="nova-entrega" data-id="'+id+'">+ Nova entrega</button>' : '') + '</div>', 'xwide');
}

// =====================================================================
// CADASTROS SIMPLES: empresa, cargo (com kit), local
// =====================================================================
function formEmpresa(id){
  if(!can('cadastros')) return;
  var e = id ? DB.empresas[id] : {};
  openModal('<div class="modal-title">'+(id ? 'Editar empresa' : 'Nova empresa / unidade')+'</div><div class="modal-grid">' +
    field('Nome', '<input id="c-nome" value="'+esc(e.nome || '')+'" placeholder="Ex.: Femsa Marília">', 'full') + field('CNPJ', '<input id="c-cnpj" value="'+esc(e.cnpj || '')+'">') + field('Cidade', '<input id="c-cid" value="'+esc(e.cidade || '')+'">') +
    '</div>' + (id ? '<input type="hidden" id="c-id" value="'+id+'">' : '') + modalActions('Salvar', 'salvar-empresa'));
}
formHandlers['salvar-empresa'] = function(btn){
  var id = ($('#c-id') || {}).value, nome = $('#c-nome').value.trim(); if(!nome) return formError('Informe o nome.');
  if(vals(DB.empresas).some(function(x){ return x._id !== id && norm(x.nome) === norm(nome); })) return formError('Já existe uma empresa com esse nome.');
  var p = {}; p['empresas/' + (id || store.key())] = {nome:nome, cnpj:$('#c-cnpj').value.trim(), cidade:$('#c-cid').value.trim()};
  busy(btn, true); save(p, id ? 'Empresa alterada' : 'Empresa criada', nome).then(function(){ closeModal(); toast('Salvo.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
function formLocal(id){
  if(!can('cadastros')) return;
  var e = id ? DB.locais[id] : {};
  openModal('<div class="modal-title">'+(id ? 'Editar local' : 'Novo local de estoque')+'</div><div class="modal-grid">' +
    field('Nome', '<input id="c-nome" value="'+esc(e.nome || '')+'" placeholder="Ex.: Almoxarifado Garça">', 'full') + field('Descrição', '<input id="c-desc" value="'+esc(e.descricao || '')+'">', 'full') +
    '</div>' + (id ? '<input type="hidden" id="c-id" value="'+id+'">' : '') + modalActions('Salvar', 'salvar-local'));
}
formHandlers['salvar-local'] = function(btn){
  var id = ($('#c-id') || {}).value, nome = $('#c-nome').value.trim(); if(!nome) return formError('Informe o nome.');
  var p = {}; p['locais/' + (id || store.key())] = {nome:nome, descricao:$('#c-desc').value.trim()};
  busy(btn, true); save(p, id ? 'Local alterado' : 'Local criado', nome).then(function(){ closeModal(); toast('Salvo.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
function formCargo(id){
  if(!can('cadastros')) return;
  var c = id ? DB.cargos[id] : {kit:[]};
  openModal('<div class="modal-title">'+(id ? 'Editar cargo' : 'Novo cargo')+'</div><div class="modal-grid">' + field('Nome do cargo', '<input id="c-nome" value="'+esc(c.nome || '')+'" placeholder="Ex.: Auxiliar de limpeza">', 'full') + '</div>' +
    '<div class="section-label">Kit de EPI / uniforme</div><div class="modal-sub" style="margin:0 0 6px">Sugerido automaticamente na entrega. O tamanho vem do cadastro do empregado.</div>' +
    '<table class="items-table"><thead><tr><th>Produto</th><th style="width:90px">Qtd</th><th style="width:36px"></th></tr></thead><tbody id="k-itens"></tbody></table><button class="btn btn-sm" style="margin-top:8px" data-act="add-item-kit">+ Adicionar item</button>' +
    (id ? '<input type="hidden" id="c-id" value="'+id+'">' : '') + modalActions('Salvar', 'salvar-cargo'), 'wide');
  (c.kit && c.kit.length ? c.kit : [{}]).forEach(function(k){ addItemKit(k.pid, k.qtd); });
}
function addItemKit(pid, q){
  var tr = document.createElement('tr');
  tr.innerHTML = '<td>'+prodInput('it-prod', pid && DB.produtos[pid] ? prodLabel(DB.produtos[pid]) : '')+'</td><td><input class="it-qtd" type="number" min="1" value="'+(q || 1)+'"></td><td><button class="icon-btn" data-act="rm-item">×</button></td>';
  $('#k-itens').appendChild(tr);
}
formHandlers['add-item-kit'] = function(){ addItemKit(); };
formHandlers['salvar-cargo'] = function(btn){
  var id = ($('#c-id') || {}).value, nome = $('#c-nome').value.trim(); if(!nome) return formError('Informe o nome.');
  var kit = [], bad = null;
  $$('#k-itens tr').forEach(function(tr){ var l = $('.it-prod', tr).value.trim(); if(!l) return; var pid = findProdByLabel(l); if(!pid){ bad = 'Produto não encontrado: ' + l; return; } kit.push({pid:pid, qtd:Math.max(1, Math.floor(num($('.it-qtd', tr).value)))}); });
  if(bad) return formError(bad);
  var p = {}; p['cargos/' + (id || store.key())] = {nome:nome, kit:kit};
  busy(btn, true); save(p, id ? 'Cargo alterado' : 'Cargo criado', nome).then(function(){ closeModal(); toast('Salvo.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// =====================================================================
// CONFIGURAÇÕES / CARGA INICIAL / BACKUP
// =====================================================================
function salvarConfig(){
  var p = {'config/diasAlertaCA': Math.max(1, Math.floor(num($('#cfg-diasCA').value))), 'config/diasAlertaTroca': Math.max(1, Math.floor(num($('#cfg-diasTroca').value))), 'config/empresaTermo': $('#cfg-empresaTermo').value.trim()};
  save(p, 'Configurações alteradas', '').then(function(){ toast('Configurações salvas.'); });
}
function downloadBackup(){
  var data = {}; COLS.forEach(function(c){ data[c] = DB[c]; });
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type:'application/json'}));
  a.download = 'backup-painel-estoque-' + today() + '.json'; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
}

// =====================================================================
// IMPORTAÇÃO DE EMPREGADOS (planilha do RH)
// =====================================================================
function onImportFile(ev){
  var f = ev.target.files[0]; if(!f) return;
  if(typeof XLSX === 'undefined'){ toast('Biblioteca de planilhas não carregou. Verifique a internet.', 'err'); return; }
  var r = new FileReader();
  r.onload = function(){
    try{
      var wb = XLSX.read(new Uint8Array(r.result), {type:'array', cellDates:true});
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
      previewImport(rows);
    }catch(e){ console.error(e); toast('Não consegui ler a planilha.', 'err'); }
  };
  r.readAsArrayBuffer(f);
}
var importRows = [];
function pick(row, names){ var keys = Object.keys(row); for(var i = 0; i < names.length; i++){ var k = keys.find(function(x){ return norm(x) === names[i]; }); if(k && String(row[k]).trim() !== '') return row[k]; } return ''; }
function toIso(v){
  if(v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth()+1) + '-' + pad(v.getDate());
  var s = String(v || '').trim(), m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}
function previewImport(rows){
  importRows = rows.map(function(r){
    return {nome:String(pick(r, ['nome','nome completo','empregado','funcionario','colaborador'])).trim(), matricula:String(pick(r, ['matricula','matrícula','registro','re','chapa'])).trim(),
      cpf:String(pick(r, ['cpf'])).trim(), empresa:String(pick(r, ['empresa','unidade','cliente','razao social','lotacao'])).trim(), setor:String(pick(r, ['setor','departamento'])).trim(),
      cargo:String(pick(r, ['cargo','funcao','função'])).trim(), admissao:toIso(pick(r, ['admissao','admissão','data admissao','data de admissao'])),
      camisa:String(pick(r, ['camisa','tamanho camisa'])).trim(), calca:String(pick(r, ['calca','calça','tamanho calca'])).trim(), calcado:String(pick(r, ['calcado','calçado','sapato','bota'])).trim(), luva:String(pick(r, ['luva'])).trim()};
  }).filter(function(r){ return r.nome; });
  if(!importRows.length){ toast('Nenhuma linha com a coluna "Nome" encontrada.', 'err'); return; }
  var novos = 0, atual = 0;
  importRows.forEach(function(r){ if(findExistente(r)) atual++; else novos++; });
  openModal('<div class="modal-title">Importar empregados</div><div class="modal-sub">'+importRows.length+' linhas lidas · '+novos+' novos · '+atual+' já cadastrados (serão atualizados). Empresas e cargos que não existirem serão criados.</div>' +
    '<div class="table-wrap" style="max-height:340px;overflow:auto"><table class="items-table"><thead><tr><th>Nome</th><th>Matrícula</th><th>Empresa</th><th>Cargo</th><th>Setor</th><th>Admissão</th></tr></thead><tbody>' +
    importRows.slice(0, 200).map(function(r){ return '<tr><td>'+esc(r.nome)+(findExistente(r) ? ' <span class="pill gray" style="padding:0 6px;font-size:10px">atualizar</span>' : '')+'</td><td class="mono">'+esc(r.matricula)+'</td><td>'+esc(r.empresa)+'</td><td>'+esc(r.cargo)+'</td><td>'+esc(r.setor)+'</td><td class="mono">'+fmtD(r.admissao)+'</td></tr>'; }).join('') +
    '</tbody></table></div><div class="modal-sub" style="margin-top:10px">Colunas reconhecidas: Nome, Matrícula, CPF, Empresa, Setor, Cargo, Admissão, Camisa, Calça, Calçado, Luva.</div>' + modalActions('Importar ' + importRows.length, 'confirmar-import'), 'wide');
}
function findExistente(r){
  return vals(DB.empregados).find(function(e){ return (r.matricula && e.matricula === r.matricula) || (r.cpf && e.cpf && e.cpf.replace(/\D/g, '') === r.cpf.replace(/\D/g, '')) || norm(e.nome) === norm(r.nome); });
}
formHandlers['confirmar-import'] = function(btn){
  var p = {}, empMap = {}, carMap = {};
  vals(DB.empresas).forEach(function(e){ empMap[norm(e.nome)] = e._id; }); vals(DB.cargos).forEach(function(c){ carMap[norm(c.nome)] = c._id; });
  function idPara(map, col, nome, extra){ if(!nome) return ''; var k = norm(nome); if(!map[k]){ map[k] = store.key(); p[col + '/' + map[k]] = Object.assign({nome:nome}, extra || {}); } return map[k]; }
  importRows.forEach(function(r){
    var ex = findExistente(r), id = ex ? ex._id : store.key(), base = ex ? Object.assign({}, DB.empregados[id]) : {ativo:true};
    delete base._id;
    var t = base.tamanhos || {};
    p['empregados/' + id] = Object.assign(base, {nome:r.nome, matricula:r.matricula || base.matricula || '', cpf:r.cpf || base.cpf || '', setor:r.setor || base.setor || '', admissao:r.admissao || base.admissao || '',
      empresaId: idPara(empMap, 'empresas', r.empresa) || base.empresaId || '', cargoId: idPara(carMap, 'cargos', r.cargo, {kit:[]}) || base.cargoId || '',
      tamanhos:{camisa:(r.camisa || t.camisa || '').toUpperCase(), calca:(r.calca || t.calca || '').toUpperCase(), calcado:(r.calcado || t.calcado || '').toUpperCase(), luva:(r.luva || t.luva || '').toUpperCase()}, atualizadoEm:nowTs()});
  });
  busy(btn, true);
  save(p, 'Importação de empregados', importRows.length + ' linhas').then(function(){ closeModal(); toast(importRows.length + ' empregados importados.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
