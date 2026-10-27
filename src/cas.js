// =====================================================================
// VÁRIOS CAs POR PRODUTO — cada CA cobre alguns tamanhos (ou todos)
// =====================================================================
// p.cas = [{ca, validade, situacao, verificadoEm, fabricante, tamanhos:[tk,...]}]
// tamanhos vazio = cobre os tamanhos que não estão em outro CA.
// Os campos antigos (p.ca, p.validadeCA, p.caSituacao, p.caVerificadoEm) espelham o 1º CA.
function produtoCAs(p){
  if(!p) return [];
  if(p.cas && p.cas.length) return (Array.isArray(p.cas) ? p.cas : vals(p.cas)).filter(function(c){ return c && c.ca; });
  return p.ca ? [{ca:p.ca, validade:p.validadeCA || '', situacao:p.caSituacao || '', verificadoEm:p.caVerificadoEm || '', fabricante:p.fabricante || '', tamanhos:[]}] : [];
}
function caStatusCA(c){
  if(!c || !c.ca) return {cls:'gray', txt:'Sem CA', d:null};
  if(c.situacao && norm(c.situacao) !== 'valido' && norm(c.situacao) !== 'vencido') return {cls:'red', txt:'CA ' + c.situacao.toLowerCase(), d:null};
  if(!c.validade) return {cls:'amber', txt:'Sem validade', d:null};
  var d = daysUntil(c.validade), lim = +cfg('diasAlertaCA', 60);
  if(d < 0) return {cls:'red', txt:'CA vencido', d:d};
  if(d <= lim) return {cls:'amber', txt:'Vence em ' + d + 'd', d:d};
  return {cls:'teal', txt:'Válido', d:d};
}
var CA_RANK = {red:3, amber:2, teal:1, gray:0};
// Situação do produto = a pior entre os CAs dele
function caStatus(p){
  var L = produtoCAs(p); if(!L.length) return {cls:'gray', txt:'Sem CA', d:null};
  var w = null;
  L.forEach(function(c){ var s = caStatusCA(c); if(!w || CA_RANK[s.cls] > CA_RANK[w.cls] || (s.cls === w.cls && s.d != null && (w.d == null || s.d < w.d))) w = s; });
  return w;
}
// Tamanhos que cada CA cobre de fato
function tamanhosDoCA(p, c){
  var L = produtoCAs(p), todos = tamanhosProduto(p._id);
  if(c.tamanhos && c.tamanhos.length) return c.tamanhos.slice();
  var outros = {}; L.forEach(function(o){ if(o !== c) (o.tamanhos || []).forEach(function(t){ outros[t] = 1; }); });
  return todos.filter(function(t){ return !outros[t]; });
}
function caDoTamanho(p, tk){
  var L = produtoCAs(p); if(!L.length) return null;
  var c = L.find(function(x){ return (x.tamanhos || []).indexOf(tk) !== -1; });
  return c || L.find(function(x){ return !(x.tamanhos || []).length; }) || null;
}
function tamCAVencido(p, tk){ var c = caDoTamanho(p, tk); return !!c && caStatusCA(c).cls === 'red'; }
function saldoCAVencido(p, loc){
  return tamanhosProduto(p._id).reduce(function(s, k){ return s + (tamCAVencido(p, k) ? saldoDe(p._id, k, loc) : 0); }, 0);
}
function cvsTxt(p){ return produtoCAs(p).map(function(c){ return c.ca; }).join(' / '); }
// Lista de CAs (um por linha) para a aba de CAs
function listaCAs(loc){
  var out = [];
  vals(DB.produtos).forEach(function(p){
    if(p.ativo === false) return;
    produtoCAs(p).forEach(function(c){
      var tams = tamanhosDoCA(p, c), saldo = tams.reduce(function(s, k){ return s + saldoDe(p._id, k, loc); }, 0);
      if(loc && saldo <= 0) return;
      out.push({p:p, c:c, st:caStatusCA(c), tams:tams, saldo:saldo, valor:saldo * (+p.custo || 0), varios:produtoCAs(p).length > 1});
    });
  });
  return out.sort(function(a, b){ return (a.c.validade || '9') < (b.c.validade || '9') ? -1 : ((a.c.validade || '9') > (b.c.validade || '9') ? 1 : (a.p.nome < b.p.nome ? -1 : 1)); });
}
// Espelha o 1º CA nos campos antigos (relatórios, exportações, busca)
function espelharCAs(rec){
  var L = (rec.cas || []).filter(function(c){ return c && c.ca; });
  rec.cas = L.length ? L : null;
  var f = L[0] || {};
  rec.ca = f.ca || ''; rec.validadeCA = f.validade || ''; rec.caSituacao = f.situacao || ''; rec.caVerificadoEm = f.verificadoEm || '';
  return rec;
}
function tamsTxt(t){ return (t || []).map(tamLabel).join(', '); }

// ---------- editor de CAs no cadastro do produto ----------
function caRowHtml(c){
  c = c || {};
  return '<div class="ca-row" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
    '<div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:end">' +
      '<div class="modal-field" style="margin:0"><label>Nº do CA</label><input class="ca-num" value="'+esc(c.ca || '')+'" placeholder="Ex.: 38201" inputmode="numeric"></div>' +
      '<button class="btn btn-sm" data-act="ca-consultar" type="button" style="height:38px">Consultar</button>' +
      '<div class="modal-field" style="margin:0"><label>Validade</label><input type="date" class="ca-val" value="'+esc(c.validade || '')+'"></div>' +
      '<button class="btn btn-sm btn-ghost" data-act="ca-remover" type="button" title="Remover este CA" style="height:38px">Remover</button>' +
    '</div>' +
    '<div class="modal-field" style="margin:8px 0 0"><label>Tamanhos deste CA</label><input class="ca-tams" value="'+esc((c.tamanhos || []).join(', '))+'" placeholder="Ex.: 40, 41, 42 — vazio = todos os tamanhos (ou os que não estão em outro CA)"></div>' +
    '<input type="hidden" class="ca-sit" value="'+esc(c.situacao || '')+'"><input type="hidden" class="ca-ver" value="'+esc(c.verificadoEm || '')+'"><input type="hidden" class="ca-orig" value="'+esc(c.ca || '')+'">' +
    '<div class="ca-info"></div></div>';
}
function caEditorHtml(p){
  var L = produtoCAs(p);
  return '<div class="full" style="grid-column:1/-1"><div class="section-label" style="margin-top:4px">Certificados de Aprovação</div>' +
    '<div id="p-cas">' + (L.length ? L : [{}]).map(caRowHtml).join('') + '</div>' +
    '<button class="btn btn-sm" type="button" data-act="ca-adicionar">+ Adicionar outro CA</button>' +
    '<div style="margin-top:6px;font-size:11.5px;line-height:1.45;color:var(--text-faint)">Um produto pode ter mais de um CA (ex.: tamanhos de fabricantes diferentes). Informe em cada CA os tamanhos que ele cobre; deixe vazio no CA que vale para os demais. Ao sair do campo, a validade é buscada na base oficial.</div></div>';
}
function lerCAsForm(tamsProduto){
  var out = [], vistos = {}, erro = '';
  $$('#p-cas .ca-row').forEach(function(r){
    var n = $('.ca-num', r).value.replace(/\D/g, '');
    if(!n) return;
    var tams = $('.ca-tams', r).value.split(',').map(function(t){ return tamKey(t); }).filter(function(t){ return t && t !== 'UN'; });
    tams.forEach(function(t){
      if(vistos[t]) erro = 'O tamanho ' + t + ' está em dois CAs (' + vistos[t] + ' e ' + n + ').';
      else vistos[t] = n;
      if(tamsProduto.length && tamsProduto.indexOf(t) === -1) erro = 'O tamanho ' + t + ' do CA ' + n + ' não está nos tamanhos do produto.';
    });
    var mesmo = n === $('.ca-orig', r).value.replace(/\D/g, '');
    out.push({ca:n, validade:$('.ca-val', r).value, situacao:(mesmo || $('.ca-info', r).innerHTML) ? $('.ca-sit', r).value : '', verificadoEm:$('.ca-ver', r).value, tamanhos:tams});
  });
  if(!erro && out.length > 1 && out.filter(function(c){ return !c.tamanhos.length; }).length > 1) erro = 'Só um CA pode ficar com os tamanhos em branco (os que sobram). Informe os tamanhos dos outros.';
  if(!erro && out.length > 1 && tamsProduto.length && !out.some(function(c){ return !c.tamanhos.length; })){
    var sem = tamsProduto.filter(function(t){ return !vistos[t]; });
    if(sem.length) erro = 'Tamanho(s) sem CA: ' + sem.join(', ') + '. Coloque-os em um CA ou deixe um CA com os tamanhos em branco.';
  }
  return {cas:out, erro:erro};
}
function consultarCARow(r, force){
  var inp = $('.ca-num', r), box = $('.ca-info', r), n = inp.value.replace(/\D/g, '');
  if(!n){ box.innerHTML = ''; return; }
  if(r.dataset.last === n && !force) return; r.dataset.last = n;
  box.innerHTML = '<div class="hint">Consultando CA '+esc(n)+' na base do Ministério do Trabalho...</div>';
  consultaCA(n).then(function(rec){
    if(inp.value.replace(/\D/g, '') !== n) return;
    if(!rec){ box.innerHTML = '<div class="hint" style="color:var(--amber)">CA '+esc(n)+' não encontrado na base oficial. Confira o número ou <a href="https://consultaca.com/'+esc(n)+'" target="_blank" rel="noopener" style="color:var(--teal)">consulte no consultaca.com</a>.</div>'; return; }
    $('.ca-val', r).value = rec.v || ''; $('.ca-sit', r).value = rec.s || ''; $('.ca-ver', r).value = today();
    var fab = $('#p-fab'), nome = $('#p-nome');
    if(fab && !fab.value.trim() && rec.f) fab.value = rec.f;
    if(nome && !nome.value.trim() && rec.e) nome.value = rec.e;
    box.innerHTML = caInfoHtml(rec) + '<div class="hint">Validade preenchida automaticamente. Base CAEPI de '+fmtD((caepiMeta || {}).atualizadoEm)+'.</div>';
  }).catch(function(){
    box.innerHTML = '<div class="hint" style="color:var(--amber)">Base de CAs ainda não disponível no site. Preencha a validade manualmente ou <a href="https://consultaca.com/'+esc(n)+'" target="_blank" rel="noopener" style="color:var(--teal)">consulte no consultaca.com</a>.</div>';
    delete r.dataset.last;
  });
}
function wireCAProduto(){
  var wrap = $('#p-cas'); if(!wrap) return;
  wrap.addEventListener('focusout', function(e){ if(e.target.classList.contains('ca-num')) consultarCARow(e.target.closest('.ca-row'), false); });
  wrap.addEventListener('keydown', function(e){ if(e.key === 'Enter' && e.target.classList.contains('ca-num')){ e.preventDefault(); consultarCARow(e.target.closest('.ca-row'), true); } });
}
formHandlers['ca-consultar'] = function(btn){ consultarCARow(btn.closest('.ca-row'), true); };
formHandlers['ca-adicionar'] = function(){ $('#p-cas').insertAdjacentHTML('beforeend', caRowHtml({})); var rs = $$('#p-cas .ca-row'); $('.ca-num', rs[rs.length - 1]).focus(); };
formHandlers['ca-remover'] = function(btn){
  var rows = $$('#p-cas .ca-row'), r = btn.closest('.ca-row');
  if(rows.length > 1) r.remove(); else { $$('input', r).forEach(function(i){ i.value = ''; }); $('.ca-info', r).innerHTML = ''; }
};
