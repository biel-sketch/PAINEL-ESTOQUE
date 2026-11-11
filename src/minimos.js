// =====================================================================
// ESTOQUE MÍNIMO POR LOCAL E TAMANHO
// =====================================================================
// p.minimos = {localId: {tamanho: qtd}}. Cada local tem o seu mínimo, por tamanho.
// p.estoqueMinimo guarda a soma (para relatórios). Produtos antigos sem p.minimos
// continuam com o mínimo total do produto até serem preenchidos.
function temMinimos(p){ return !!(p && p.minimos && Object.keys(p.minimos).some(function(l){ return DB.locais[l] && !DB.locais[l].excluido && Object.keys(p.minimos[l] || {}).length; })); }
function locaisComMinimo(p){ return Object.keys(p.minimos || {}).filter(function(l){ return DB.locais[l] && !DB.locais[l].excluido; }); }
function minimoDe(p, tk, loc){
  var m = p.minimos || {};
  if(loc) return +((m[loc] || {})[tk]) || 0;
  return locaisComMinimo(p).reduce(function(s, l){ return s + (+((m[l] || {})[tk]) || 0); }, 0);
}
function minimoProduto(p, loc){
  if(!temMinimos(p)) return +p.estoqueMinimo || 0;
  return tamanhosProduto(p._id).reduce(function(s, k){ return s + minimoDe(p, k, loc); }, 0);
}
function somaMinimos(m){ var s = 0; Object.keys(m || {}).forEach(function(l){ Object.keys(m[l] || {}).forEach(function(k){ s += +m[l][k] || 0; }); }); return s; }
// Linhas abaixo do mínimo: uma por produto × tamanho × local
function faltasMinimo(loc){
  var out = [];
  vals(DB.produtos).forEach(function(p){
    if(p.ativo === false) return;
    if(temMinimos(p)){
      (loc ? [loc] : locaisComMinimo(p)).forEach(function(l){
        tamanhosProduto(p._id).forEach(function(k){
          var mn = minimoDe(p, k, l); if(mn <= 0) return;
          var s = saldoDe(p._id, k, l); if(s < mn) out.push({p:p, tk:k, loc:l, min:mn, saldo:s, falta:mn - s});
        });
      });
    } else if(+p.estoqueMinimo > 0){
      var s = saldoProduto(p._id, loc); if(s < +p.estoqueMinimo) out.push({p:p, tk:'', loc:loc || '', min:+p.estoqueMinimo, saldo:s, falta:+p.estoqueMinimo - s, antigo:true});
    }
  });
  return out;
}
function tamAbaixoMinimo(p, tk, loc){
  if(!temMinimos(p)) return false;
  return (loc ? [loc] : locaisComMinimo(p)).some(function(l){ var mn = minimoDe(p, tk, l); return mn > 0 && saldoDe(p._id, tk, l) < mn; });
}
function produtoAbaixoMinimo(p, loc){
  if(!temMinimos(p)) return +p.estoqueMinimo > 0 && saldoProduto(p._id, loc) < +p.estoqueMinimo;
  return tamanhosProduto(p._id).some(function(k){ return tamAbaixoMinimo(p, k, loc); });
}

// ---------- grade de mínimos no cadastro do produto ----------
function minGradeHtml(minimos, tams){
  var locs = locaisAtivos().sort(byName);
  if(!locs.length) return '<div class="hint">Cadastre os locais de estoque em Cadastros para definir o mínimo.</div>';
  var ks = tams.length ? tams : ['UN'];
  return '<div class="table-wrap" style="overflow:auto"><table class="items-table min-grade"><thead><tr><th>Local</th>' + ks.map(function(k){ return '<th class="num" style="min-width:58px">'+esc(k === 'UN' ? 'Único' : k)+'</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
    locs.map(function(l){
      var row = (minimos || {})[l._id] || {}, t = 0;
      return '<tr><td style="white-space:nowrap">'+esc(l.nome)+'</td>' + ks.map(function(k){ var v = +row[k] || 0; t += v; return '<td><input type="number" class="min-in" min="0" step="1" data-loc="'+l._id+'" data-tk="'+esc(k)+'" value="'+(v || '')+'" placeholder="0"></td>'; }).join('') + '<td class="num min-tot">'+(t || '—')+'</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function lerGradeMinimos(root){
  var m = {};
  $$('.min-in', root).forEach(function(i){ var v = Math.floor(num(i.value)); if(v > 0){ (m[i.dataset.loc] = m[i.dataset.loc] || {})[i.dataset.tk] = v; } });
  return m;
}
function minEditorHtml(p){
  var antigo = !temMinimos(p) && +p.estoqueMinimo > 0;
  return '<div class="full" style="grid-column:1/-1"><div class="section-label" style="margin-top:4px">Estoque mínimo por local e tamanho</div>' +
    '<div id="p-min-grade">' + minGradeHtml(p.minimos, (p.tamanhos || []).map(tamKey)) + '</div>' +
    '<div style="margin-top:6px;font-size:11.5px;line-height:1.45;color:var(--text-faint)">Cada local tem o seu mínimo, por tamanho. Vazio = sem mínimo naquele local/tamanho. O painel avisa quando o saldo do tamanho naquele local fica abaixo.' +
    (antigo ? '<br><span style="color:var(--amber)">Mínimo antigo (total, sem tamanho e sem local): '+fmtN(p.estoqueMinimo)+'. Ele continua valendo até você preencher esta grade.</span>' : '') + '</div></div>';
}
function wireMinEditor(){
  var box = $('#p-min-grade'), tamsIn = $('#p-tams'); if(!box) return;
  var totais = function(){ $$('tbody tr', box).forEach(function(tr){ var t = $$('.min-in', tr).reduce(function(s, i){ return s + (Math.floor(num(i.value)) || 0); }, 0); $('.min-tot', tr).textContent = t || '—'; }); };
  box.addEventListener('input', totais);
  if(tamsIn) tamsIn.addEventListener('change', function(){
    var atual = lerGradeMinimos(box), tams = tamsIn.value.split(',').map(function(t){ return tamKey(t); }).filter(function(t){ return t && t !== 'UN'; });
    box.innerHTML = minGradeHtml(atual, tams);
  });
}

// ---------- definir mínimos de vários produtos de uma vez (por local) ----------
formHandlers['min-definir'] = function(){
  if(!can('produtos')) return;
  var locs = locaisAtivos().sort(byName); if(!locs.length){ toast('Cadastre um local de estoque em Cadastros.', 'err'); return; }
  var loc = valLocal() || locs[0]._id;
  openModal('<div class="modal-title">Definir estoque mínimo</div><div class="modal-sub">Escolha o local e preencha o mínimo de cada tamanho. Vazio = sem mínimo. Só os produtos alterados são salvos.</div>' +
    '<div class="modal-grid">' + field('Local de estoque', '<select id="md-loc">'+optList(locs.map(function(l){ return [l._id, l.nome]; }), loc)+'</select>') +
      field('Buscar produto', '<input id="md-busca" placeholder="Nome ou grupo">') + '</div>' +
    '<div id="md-lista" style="max-height:52vh;overflow:auto;margin-top:6px"></div>' +
    modalActions('Salvar mínimos', 'md-salvar'), 'xwide');
  var desenhar = function(){
    var l = $('#md-loc').value, q = norm($('#md-busca').value || '');
    var ps = vals(DB.produtos).filter(function(p){ return p.ativo !== false && (!q || norm(p.nome + ' ' + (p.grupo || '') + ' ' + (p.categoria || '')).indexOf(q) !== -1); }).sort(byName);
    $('#md-lista').innerHTML = ps.length ? '<table class="items-table"><thead><tr><th>Produto</th><th>Saldo neste local e mínimo por tamanho</th></tr></thead><tbody>' + ps.map(function(p){
      var ks = tamanhosProduto(p._id), row = (p.minimos || {})[l] || {};
      return '<tr class="md-row" data-pid="'+p._id+'"><td style="min-width:220px">'+esc(p.nome)+'<span class="sub">'+esc(p.grupo || p.categoria || '')+(!temMinimos(p) && +p.estoqueMinimo ? ' · mínimo antigo total: ' + fmtN(p.estoqueMinimo) : '')+'</span></td><td><div style="display:flex;flex-wrap:wrap;gap:6px">' +
        ks.map(function(k){ return '<label style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:var(--text-dim)"><span>'+esc(k === 'UN' ? 'Único' : k)+' · saldo '+saldoDe(p._id, k, l)+'</span><input type="number" class="min-in" min="0" step="1" data-loc="'+l+'" data-tk="'+esc(k)+'" value="'+(+row[k] || '')+'" placeholder="0" style="width:76px"></label>'; }).join('') + '</div></td></tr>';
    }).join('') + '</tbody></table>' : emptyState('Nenhum produto.');
  };
  var pend = {}; // alterações guardadas ao trocar de local/busca
  var guardar = function(){ $$('#md-lista .md-row').forEach(function(tr){ $$('.min-in', tr).forEach(function(i){ var k = tr.dataset.pid + '|' + i.dataset.loc + '|' + i.dataset.tk, v = Math.floor(num(i.value)) || 0, ant = +(((DB.produtos[tr.dataset.pid].minimos || {})[i.dataset.loc] || {})[i.dataset.tk]) || 0; if(v !== ant) pend[k] = v; else delete pend[k]; }); }); };
  var reaplicar = function(){ $$('#md-lista .md-row').forEach(function(tr){ $$('.min-in', tr).forEach(function(i){ var k = tr.dataset.pid + '|' + i.dataset.loc + '|' + i.dataset.tk; if(pend[k] != null) i.value = pend[k] || ''; }); }); };
  $('#md-loc').addEventListener('change', function(){ guardar(); desenhar(); reaplicar(); });
  $('#md-busca').addEventListener('input', function(){ guardar(); desenhar(); reaplicar(); });
  $('#modal-box')._mdGuardar = function(){ guardar(); return pend; };
  desenhar();
};
formHandlers['md-salvar'] = function(btn){
  var pend = $('#modal-box')._mdGuardar(), porProd = {};
  Object.keys(pend).forEach(function(k){ var a = k.split('|'); (porProd[a[0]] = porProd[a[0]] || []).push({loc:a[1], tk:a[2], v:pend[k]}); });
  var ids = Object.keys(porProd); if(!ids.length){ closeModal(); return; }
  var p = {};
  ids.forEach(function(pid){
    var m = JSON.parse(JSON.stringify(DB.produtos[pid].minimos || {}));
    porProd[pid].forEach(function(x){ m[x.loc] = m[x.loc] || {}; if(x.v > 0) m[x.loc][x.tk] = x.v; else delete m[x.loc][x.tk]; if(!Object.keys(m[x.loc]).length) delete m[x.loc]; });
    p['produtos/' + pid + '/minimos'] = Object.keys(m).length ? m : null;
    p['produtos/' + pid + '/estoqueMinimo'] = Object.keys(m).length ? somaMinimos(m) : (temMinimos(DB.produtos[pid]) ? 0 : (+DB.produtos[pid].estoqueMinimo || 0));
  });
  busy(btn, true);
  save(p, 'Estoque mínimo definido', ids.length + ' produto(s)').then(function(){ closeModal(); toast('Mínimo salvo em ' + ids.length + ' produto(s).'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};

// Planilha com o mínimo atual de cada produto × tamanho × local (preencha e importe em Produtos → Importar)
formHandlers['min-planilha'] = function(){
  var locs = valLocal() ? [DB.locais[valLocal()]] : locaisAtivos().sort(byName), rows = [];
  vals(DB.produtos).filter(function(p){ return p.ativo !== false; }).sort(byName).forEach(function(p){
    locs.forEach(function(l){
      tamanhosProduto(p._id).forEach(function(k){
        rows.push({'Produto':p.nome, 'Categoria':p.categoria || '', 'Grupo':p.grupo || '', 'Tamanho':k === 'UN' ? '' : k, 'Local':l.nome, 'Saldo hoje (só consulta)':saldoDe(p._id, k, l._id), 'Estoque mínimo':minimoDe(p, k, l._id) || ''});
      });
    });
  });
  exportXlsx('estoque-minimo-por-local', rows);
};
