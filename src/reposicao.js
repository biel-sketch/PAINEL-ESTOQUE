// =====================================================================
// REPOSIÇÃO DO ESTOQUE MÍNIMO — comprar todos os faltantes de uma vez
// =====================================================================
// Quantidade já pedida e ainda não recebida, por produto|tamanho (tamanho '' = não informado)
function qtdEmCompra(){
  var m = {};
  vals(DB.compras).forEach(function(c){
    var e = cmpEtapa(c);
    if(e === 'cancelada' || e === 'recebida') return;
    cmpItens(c).forEach(function(it, j){
      if(!it.pid) return;
      var qi = (c.selecao || [])[j], ped = c.pedidos && qi != null ? c.pedidos[qi] : null;
      if(ped && ped.recebidoEm) return;
      var k = it.pid + '|' + (it.tk && it.tk !== 'UN' ? tamKey(it.tk) : (it.tk === 'UN' ? 'UN' : ''));
      m[k] = (m[k] || 0) + (+it.qtd || 0);
    });
  });
  return m;
}
function valLocal(){ var e = $('#val-local'); return e ? e.value : ''; }
// Uma linha por produto × tamanho (somando os locais que estão abaixo do mínimo)
function listaReposicao(loc){
  var em = qtdEmCompra(), rows = {}, ordem = [];
  faltasMinimo(loc).forEach(function(f){
    var k = f.p._id + '|' + f.tk, r = rows[k];
    if(!r){ r = rows[k] = {p:f.p, tk:f.tk, grupo:(f.p.grupo || f.p.categoria || 'Outros'), saldo:0, min:0, falta:0, locais:[], antigo:!!f.antigo}; ordem.push(k); }
    r.saldo += f.saldo; r.min += f.min; r.falta += f.falta; if(f.loc) r.locais.push({loc:f.loc, saldo:f.saldo, min:f.min, falta:f.falta});
  });
  var L = ordem.map(function(k){ return rows[k]; });
  // desconta o que já está em compra: primeiro o do mesmo tamanho, depois o sem tamanho
  var semTam = {}; Object.keys(em).forEach(function(k){ var a = k.split('|'); if(a[1] === '') semTam[a[0]] = em[k]; });
  L.forEach(function(r){ var ja = r.tk ? (em[r.p._id + '|' + r.tk] || 0) : Object.keys(em).filter(function(k){ return k.indexOf(r.p._id + '|') === 0; }).reduce(function(s, k){ return s + em[k]; }, 0); r.emCompra = Math.min(ja, r.falta); });
  L.forEach(function(r){ if(!r.tk) return; var livre = semTam[r.p._id] || 0, resto = r.falta - r.emCompra; if(livre > 0 && resto > 0){ var u = Math.min(livre, resto); r.emCompra += u; semTam[r.p._id] = livre - u; } });
  L.forEach(function(r){ r.comprar = Math.max(0, r.falta - r.emCompra); r.custo = +r.p.custo || 0; r.valor = r.comprar * r.custo; });
  return L.sort(function(a, b){ return a.grupo !== b.grupo ? (a.grupo < b.grupo ? -1 : 1) : (a.p.nome !== b.p.nome ? (a.p.nome < b.p.nome ? -1 : 1) : (ordTam(a.tk) - ordTam(b.tk))); });
}
function ordTam(t){ var o = ['PP','P','M','G','GG','XG','EG','XGG','EXG','GGG','EEG','XXG','EXGG','EEEG','G1','G2','G3','E1','E2','E3']; if(/^\d+$/.test(t)) return +t; var i = o.indexOf(t); return i === -1 ? 999 : 500 + i; }
function tamTxt(tk){ return !tk ? 'todos' : (tk === 'UN' ? 'Único' : tk); }
function locaisTxt(r){ return r.locais.map(function(x){ return nomeLocal(x.loc) + ': ' + x.saldo + '/' + x.min; }).join(' · '); }
function valorReposicao(loc){ return listaReposicao(loc).reduce(function(s, r){ return s + r.valor; }, 0); }

function renderTabelaMinimo(loc){
  var L = listaReposicao(loc);
  var acoes = '<button class="btn btn-sm" data-act="min-definir"'+(can('produtos') ? '' : ' disabled')+'>Definir mínimos</button><button class="btn btn-sm" data-act="min-planilha" title="Planilha com o mínimo de cada produto, tamanho e local, para preencher e importar em Produtos → Importar">Planilha de mínimos</button>';
  if(!L.length) return '<div class="panel-head"><span class="panel-title" style="font-size:12.5px;font-weight:400;color:var(--text-dim)">Nada abaixo do mínimo'+(loc ? ' em ' + esc(nomeLocal(loc)) : '')+'.</span>'+acoes+'</div>' + emptyState('Defina o mínimo de cada tamanho em cada local em "Definir mínimos" ou no cadastro do produto.');
  var tot = L.reduce(function(s, r){ return s + r.valor; }, 0), nComprar = L.filter(function(r){ return r.comprar > 0; }).length;
  var semCusto = L.filter(function(r){ return r.comprar > 0 && !r.custo; }).length, antigos = L.filter(function(r){ return r.antigo; }).length;
  return '<div class="panel-head"><span class="panel-title" style="font-size:12.5px;font-weight:400;color:var(--text-dim)">'+nComprar+' item(ns) para repor · estimativa '+fmtR(tot)+(semCusto ? ' · ' + semCusto + ' sem custo cadastrado' : '')+'</span>' +
    '<span style="display:flex;gap:6px;flex-wrap:wrap">'+acoes+'<button class="btn btn-sm" data-act="min-export">Exportar Excel</button><button class="btn btn-sm btn-primary" data-act="min-comprar"'+(can('solicitar') && nComprar ? '' : ' disabled')+'>Comprar todos os faltantes</button></span></div>' +
    '<table><thead><tr><th>Produto</th><th>Tamanho</th><th>Grupo</th><th class="num">Saldo</th><th class="num">Mínimo</th><th class="num">Faltam</th><th class="num">Já em compra</th><th class="num">A comprar</th><th class="num">Valor estimado</th><th></th></tr></thead><tbody>' + L.map(function(r){
      var lt = r.antigo ? 'mínimo antigo do produto (total, sem tamanho e sem local)' : locaisTxt(r);
      return '<tr><td>'+esc(r.p.nome)+'<span class="sub">'+esc(lt)+'</span></td><td class="mono">'+esc(tamTxt(r.tk))+'</td><td>'+esc(r.grupo)+'</td><td class="num">'+r.saldo+'</td><td class="num">'+r.min+'</td><td class="num qty-out">'+r.falta+'</td>' +
        '<td class="num">'+(r.emCompra ? r.emCompra : '—')+'</td><td class="num"><b>'+r.comprar+'</b></td><td class="num">'+(r.custo ? fmtR(r.valor) : '<span class="sub" style="display:inline">sem custo</span>')+'</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-sm" data-act="nova-compra" data-id="'+r.p._id+'"'+(can('solicitar') ? '' : ' disabled')+'>Solicitar compra</button> <button class="btn btn-sm" data-act="nova-entrada" data-id="'+r.p._id+'"'+(can('movimentar') ? '' : ' disabled')+'>Dar entrada</button></td></tr>';
    }).join('') + '</tbody><tfoot><tr><td colspan="7"><b>Total</b></td><td class="num"><b>'+L.reduce(function(s, r){ return s + r.comprar; }, 0)+'</b></td><td class="num"><b>'+fmtR(tot)+'</b></td><td></td></tr></tfoot></table>' +
    '<div class="tbl-foot">Cada local tem o seu mínimo por tamanho; embaixo do produto aparece saldo/mínimo de cada local. "Já em compra" desconta o que está em solicitações e pedidos ainda não recebidos.'+(antigos ? ' ' + antigos + ' produto(s) ainda usam o mínimo antigo (total): defina por local e tamanho em "Definir mínimos".' : '')+'</div>';
}

function linhasExcelReposicao(L, loc){
  var out = [];
  L.forEach(function(r){
    var base = {Grupo:r.grupo, Produto:r.p.nome, Tamanho:tamTxt(r.tk), Unidade:r.p.unidade || 'UN'};
    var tot = Object.assign({}, base, {'Local':loc ? nomeLocal(loc) : (r.antigo ? 'Todos (mínimo antigo)' : 'Todos os locais'), 'Saldo':r.saldo, 'Estoque mínimo':r.min, 'Faltam':r.falta, 'Já em compra':r.emCompra, 'A comprar':r.comprar, 'Custo unitário':r.custo, 'Valor estimado':Math.round(r.valor * 100) / 100, 'Detalhe por local':r.antigo ? '' : locaisTxt(r)});
    out.push(tot);
  });
  return out;
}
formHandlers['min-export'] = function(){ var loc = valLocal(); exportXlsx('reposicao-estoque-minimo', linhasExcelReposicao(listaReposicao(loc), loc)); };

formHandlers['min-comprar'] = function(){
  if(!can('solicitar')) return;
  var loc = valLocal(), L = listaReposicao(loc).filter(function(r){ return r.comprar > 0; }), grupos = {};
  L.forEach(function(r){ (grupos[r.grupo] = grupos[r.grupo] || []).push(r); });
  var h = '<div class="modal-title">Comprar todos os faltantes</div>' +
    '<div class="modal-sub">'+(loc ? '<b>Local: ' + esc(nomeLocal(loc)) + '</b> · ' : '<b>Todos os locais</b> · ')+'Cria uma solicitação de compra por grupo, com um item por tamanho, na quantidade para voltar ao estoque mínimo (já descontando o que está em compra). Ajuste as quantidades ou desmarque o que não quiser.</div>' +
    '<div class="modal-grid three">' +
      field('Centro / unidade', '<select id="mc-unid">'+centrosOptsHtml('')+'</select>') +
      field('Necessário até', '<input type="date" id="mc-nec">') +
      field('Prioridade', '<select id="mc-urg">'+optList([['0','Normal'],['1','Urgente']], '0')+'</select>') +
      field('Justificativa', '<input id="mc-just" value="Reposição do estoque mínimo'+(loc ? ' — ' + esc(nomeLocal(loc)) : '')+'">', 'full') +
    '</div>' +
    Object.keys(grupos).sort().map(function(g){
      return '<div class="section-label">'+esc(g)+'</div><table class="items-table"><thead><tr><th style="width:34px"></th><th>Item</th><th>Tam.</th><th class="num">Saldo</th><th class="num">Mínimo</th><th style="width:96px">Qtd</th><th class="num">Valor</th></tr></thead><tbody>' +
        grupos[g].map(function(r){
          return '<tr class="mc-row" data-pid="'+r.p._id+'" data-tk="'+esc(r.tk)+'" data-g="'+esc(g)+'" data-custo="'+r.custo+'"><td><input type="checkbox" class="mc-on" checked></td><td>'+esc(r.p.nome)+'<span class="sub">'+esc(r.antigo ? 'mínimo antigo (total)' : locaisTxt(r))+(r.emCompra ? ' · ' + r.emCompra + ' já em compra' : '')+'</span></td><td class="mono">'+esc(tamTxt(r.tk))+'</td><td class="num">'+r.saldo+'</td><td class="num">'+r.min+'</td>' +
            '<td><input type="number" class="mc-qtd" min="1" step="1" value="'+r.comprar+'"></td><td class="num mc-val">'+(r.custo ? fmtR(r.valor) : '—')+'</td></tr>';
        }).join('') + '</tbody></table>';
    }).join('') +
    '<div class="hint" id="mc-resumo" style="margin-top:10px"></div>' +
    '<div id="form-error" class="form-error"></div><div class="modal-actions"><button class="btn" data-act="mc-export">Exportar Excel</button><button class="btn btn-ghost" data-act="fechar">Fechar</button><button class="btn btn-primary" data-act="mc-criar" id="mc-criar">Criar solicitações</button></div>';
  openModal(h, 'wide');
  var box = $('#modal-box');
  var atualizar = function(){
    if(!$('#mc-resumo')) return; // modal já foi trocado por outro
    var sel = mcLer(), gs = {};
    sel.forEach(function(x){ gs[x.grupo] = 1; });
    $$('.mc-row', box).forEach(function(tr){ var q = +$('.mc-qtd', tr).value || 0, c = +tr.dataset.custo; $('.mc-val', tr).textContent = c ? fmtR(q * c) : '—'; tr.style.opacity = $('.mc-on', tr).checked ? '' : '.45'; });
    var n = Object.keys(gs).length, tot = sel.reduce(function(s, x){ return s + x.qtd * x.custo; }, 0);
    $('#mc-resumo').textContent = sel.length + ' item(ns) em ' + n + ' grupo(s) · estimativa ' + fmtR(tot);
    var b = $('#mc-criar'); b.textContent = n === 1 ? 'Criar 1 solicitação' : 'Criar ' + n + ' solicitações (uma por grupo)'; b.disabled = !n;
  };
  box.addEventListener('input', atualizar); box.addEventListener('change', atualizar);
  atualizar();
};
function mcLer(){
  return $$('.mc-row', $('#modal-box')).filter(function(tr){ return $('.mc-on', tr).checked && (+$('.mc-qtd', tr).value || 0) > 0; }).map(function(tr){
    var p = DB.produtos[tr.dataset.pid] || {};
    return {pid:tr.dataset.pid, tk:tr.dataset.tk || '', grupo:tr.dataset.g, qtd:Math.round(+$('.mc-qtd', tr).value), custo:+tr.dataset.custo || 0, nome:p.nome, unidade:p.unidade || 'UN'};
  });
}
formHandlers['mc-export'] = function(){
  var sel = mcLer(), q = {}, loc = valLocal(); sel.forEach(function(x){ q[x.pid + '|' + x.tk] = x.qtd; });
  var L = listaReposicao(loc).filter(function(r){ return q[r.p._id + '|' + r.tk]; }).map(function(r){ r.comprar = q[r.p._id + '|' + r.tk]; r.valor = r.comprar * r.custo; return r; });
  exportXlsx('reposicao-estoque-minimo', linhasExcelReposicao(L, loc));
};
formHandlers['mc-criar'] = function(btn){
  var sel = mcLer(); if(!sel.length) return formError('Marque pelo menos um item.');
  var gs = {}; sel.forEach(function(x){ (gs[x.grupo] = gs[x.grupo] || []).push(x); });
  var locR = valLocal(), base = {unidadeId:$('#mc-unid').value, necessidade:$('#mc-nec').value, urgente:$('#mc-urg').value === '1', justificativa:$('#mc-just').value.trim() || 'Reposição do estoque mínimo', localReposicao:locR || ''};
  var nums = [];
  busy(btn, true);
  Object.keys(gs).sort().reduce(function(pr, g){
    return pr.then(function(){
      return store.txn('config/seqCompra', function(cur){ return (+cur || 0) + 1; }).then(function(r){
        var nid = store.key(), p = {};
        var sol = Object.assign({}, base, {grupo:g, itens:gs[g].map(function(x){ return {item:x.nome, pid:x.pid, tk:x.tk || '', qtd:x.qtd, unidade:x.unidade}; }),
          numero:r.value, criadoEm:nowTs(), solicitante:currentUser.name, aprovacao:'cotacao', compra:'pendente', cotacoes:[], origem:'estoque-minimo'});
        p['compras/' + nid] = sol;
        cmpHist(p, nid, 'Solicitação criada pela reposição do estoque mínimo — ' + g + ', ' + sol.itens.length + ' item(ns)');
        nums.push('SC-' + String(r.value).padStart(4, '0'));
        return save(p, 'Solicitação de compra', nums[nums.length - 1] + ' ' + g + ' (estoque mínimo)');
      });
    });
  }, Promise.resolve()).then(function(){
    closeModal();
    toast(nums.length === 1 ? 'Solicitação ' + nums[0] + ' criada.' : nums.length + ' solicitações criadas: ' + nums.join(', ') + '.');
  }).catch(function(e){ busy(btn, false); formError(e.message + (nums.length ? ' (já criadas: ' + nums.join(', ') + ')' : '')); });
};

// =====================================================================
// VALOR PARADO EM ESTOQUE COM CA VENCIDO
// =====================================================================
function valorEstoqueProduto(p, loc){ return saldoProduto(p._id, loc) * (+p.custo || 0); }
function resumoValorCA(loc){
  var venc = 0, geral = 0, nVenc = 0;
  vals(DB.produtos).forEach(function(p){
    if(p.ativo === false) return;
    geral += valorEstoqueProduto(p, loc);
    var sv = saldoCAVencido(p, loc);
    if(sv > 0){ venc += sv * (+p.custo || 0); nVenc++; }
  });
  return {vencido:venc, geral:geral, n:nVenc};
}
