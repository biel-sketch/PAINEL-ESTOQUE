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
function wireCAProduto(){
  var inp = $('#p-ca'), box = $('#p-ca-info'), last = null;
  if(!inp) return;
  function run(force){
    var n = inp.value.replace(/\D/g, '');
    if(!n){ box.innerHTML = ''; return; }
    if(n === last && !force) return; last = n;
    box.innerHTML = '<div class="hint">Consultando CA '+esc(n)+' na base do Ministério do Trabalho...</div>';
    consultaCA(n).then(function(rec){
      if(inp.value.replace(/\D/g, '') !== n) return;
      if(!rec){ box.innerHTML = '<div class="hint" style="color:var(--amber)">CA '+esc(n)+' não encontrado na base oficial. Confira o número ou <a href="https://consultaca.com/'+esc(n)+'" target="_blank" rel="noopener" style="color:var(--teal)">consulte no consultaca.com</a>.</div>'; return; }
      $('#p-val').value = rec.v || '';
      if(!$('#p-fab').value.trim() && rec.f) $('#p-fab').value = rec.f;
      if(!$('#p-nome').value.trim() && rec.e) $('#p-nome').value = rec.e;
      $('#p-ca-sit').value = rec.s || '';
      box.innerHTML = caInfoHtml(rec) + '<div class="hint">Validade preenchida automaticamente. Base CAEPI de '+fmtD((caepiMeta || {}).atualizadoEm)+'.</div>';
    }).catch(function(){
      box.innerHTML = '<div class="hint" style="color:var(--amber)">Base de CAs ainda não disponível no site. Preencha a validade manualmente ou <a href="https://consultaca.com/'+esc(n)+'" target="_blank" rel="noopener" style="color:var(--teal)">consulte no consultaca.com</a>.</div>';
      last = null;
    });
  }
  inp.addEventListener('blur', function(){ run(false); });
  inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); run(true); } });
  formHandlers['consultar-ca'] = function(){ run(true); };
}

// Na aba Validade e CA: atualiza validade e situação de todos os produtos pela base oficial
formHandlers['atualizar-cas'] = function(btn){
  if(!can('produtos')) return;
  var prods = vals(DB.produtos).filter(function(p){ return p.ca && /\d/.test(p.ca); });
  if(!prods.length){ toast('Nenhum produto com CA.', 'err'); return; }
  btn.disabled = true; btn.textContent = 'Consultando ' + prods.length + ' CAs...';
  var paths = {}, mudou = 0, naoAchou = [];
  Promise.all(prods.map(function(p){
    return consultaCA(p.ca).then(function(rec){
      if(!rec){ naoAchou.push(p.ca); return; }
      if(rec.v !== p.validadeCA || rec.s !== p.caSituacao){
        paths['produtos/' + p._id + '/validadeCA'] = rec.v || '';
        paths['produtos/' + p._id + '/caSituacao'] = rec.s || '';
        mudou++;
      }
      paths['produtos/' + p._id + '/caVerificadoEm'] = today();
    });
  })).then(function(){
    return save(paths, 'CAs atualizados pela base oficial', mudou + ' alterado(s)' + (naoAchou.length ? ', não encontrados: ' + naoAchou.join(', ') : ''));
  }).then(function(){
    toast(mudou + ' produto(s) atualizado(s)' + (naoAchou.length ? ' · ' + naoAchou.length + ' CA(s) não encontrado(s)' : '') + '.');
  }).catch(function(){
    toast('Base de CAs ainda não disponível no site.', 'err');
  }).then(function(){ btn.disabled = false; btn.textContent = 'Atualizar CAs pela base oficial'; });
};
