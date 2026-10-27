// =====================================================================
// CONSULTA DE CA (base oficial CAEPI do Ministério do Trabalho)
// A base é baixada todo dia pelo GitHub Actions (.github/workflows/atualizar-caepi.yml)
// e publicada junto com o site em ca/<numero % 500>.json.
// =====================================================================
var CAEPI_URL = location.protocol.indexOf('http') === 0 ? 'ca/' : 'https://biel-sketch.github.io/PAINEL-ESTOQUE/ca/';
var caepiCache = {}, caepiMeta = null;

function caepiMetaInfo(){
  if(caepiMeta) return Promise.resolve(caepiMeta);
  return fetch(CAEPI_URL + 'meta.json', {cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error('sem base'); return r.json(); })
    .then(function(m){ caepiMeta = m; return m; });
}
// Resolve com o registro do CA, null se não existe na base, ou rejeita se a base não estiver disponível.
function consultaCA(numero){
  var n = String(numero || '').replace(/\D/g, '').replace(/^0+/, '');
  if(!n) return Promise.resolve(null);
  return caepiMetaInfo().then(function(m){
    var shard = Number(n) % (m.shards || 500);
    if(!caepiCache[shard]){
      caepiCache[shard] = fetch(CAEPI_URL + shard + '.json', {cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(function(e){ delete caepiCache[shard]; throw e; });
    }
    return caepiCache[shard].then(function(d){ var r = d[n]; if(r) r.ca = n; return r || null; });
  });
}
function caSituacaoCls(rec){
  if(!rec) return 'gray';
  var s = norm(rec.s);
  if(s !== 'valido') return 'red';
  var d = daysUntil(rec.v);
  if(d != null && d < 0) return 'red';
  if(d != null && d <= +cfg('diasAlertaCA', 60)) return 'amber';
  return 'teal';
}
function caInfoHtml(rec){
  return '<div style="background:#0D1526;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;line-height:1.5">' +
    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px"><b>CA '+esc(rec.ca)+' — '+esc(rec.e || '')+'</b><span class="pill '+caSituacaoCls(rec)+'">'+esc(rec.s || '—')+' até '+fmtD(rec.v)+'</span></div>' +
    '<div style="color:var(--text-dim)">'+esc(rec.f || '')+(rec.r ? ' · Ref. ' + esc(rec.r) : '')+'</div>' +
    (rec.d ? '<div style="color:var(--text-dim);margin-top:4px">'+esc(rec.d)+'</div>' : '') +
    (rec.a ? '<div style="margin-top:4px"><span style="color:var(--text-faint);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em">Aprovado para</span><br>'+esc(rec.a)+'</div>' : '') +
    '</div>';
}

// No cadastro de produto: consulta ao sair do campo CA (ou clicando em Consultar) e preenche os dados
// Na aba Validade e CA: atualiza validade e situação de todos os produtos pela base oficial
formHandlers['atualizar-cas'] = function(btn){
  if(!can('produtos')) return;
  var prods = vals(DB.produtos).filter(function(p){ return produtoCAs(p).some(function(c){ return /\d/.test(c.ca); }); });
  if(!prods.length){ toast('Nenhum produto com CA.', 'err'); return; }
  var nCA = prods.reduce(function(s, p){ return s + produtoCAs(p).length; }, 0);
  btn.disabled = true; btn.textContent = 'Consultando ' + nCA + ' CAs...';
  var paths = {}, mudou = 0, naoAchou = [];
  Promise.all(prods.map(function(p){
    var L = produtoCAs(p).map(function(c){ return Object.assign({}, c, {tamanhos:(c.tamanhos || []).slice()}); }), alterou = false;
    return Promise.all(L.map(function(c){
      return consultaCA(c.ca.replace(/\D/g, '')).then(function(rec){
        if(!rec){ naoAchou.push(c.ca); return; }
        if((rec.v || '') !== (c.validade || '') || (rec.s || '') !== (c.situacao || '')){ c.validade = rec.v || ''; c.situacao = rec.s || ''; alterou = true; }
        c.verificadoEm = today();
      });
    })).then(function(){
      if(alterou) mudou++;
      var rec = espelharCAs({cas:L});
      paths['produtos/' + p._id + '/cas'] = rec.cas;
      ['ca','validadeCA','caSituacao','caVerificadoEm'].forEach(function(f){ paths['produtos/' + p._id + '/' + f] = rec[f]; });
    });
  })).then(function(){
    return save(paths, 'CAs atualizados pela base oficial', mudou + ' produto(s) alterado(s)' + (naoAchou.length ? ', não encontrados: ' + naoAchou.join(', ') : ''));
  }).then(function(){
    toast(mudou + ' produto(s) atualizado(s)' + (naoAchou.length ? ' · ' + naoAchou.length + ' CA(s) não encontrado(s)' : '') + '.');
  }).catch(function(){
    toast('Base de CAs ainda não disponível no site.', 'err');
  }).then(function(){ btn.disabled = false; btn.textContent = 'Atualizar CAs pela base oficial'; });
};
