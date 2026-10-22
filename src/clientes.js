// =====================================================================
// CLIENTES (postos / tomadores onde os colaboradores trabalham)
// O cadastro é alimentado sozinho a partir do campo "Cliente" dos empregados.
// A chave é fixa pelo nome (cli_<nome>), então nunca duplica, mesmo com vários usuários.
// =====================================================================
function cliKey(nome){ return 'cli_' + norm(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80); }
function nomeCliente(id){ return (DB.clientes[id] || {}).nome || ''; }
// Nome de um "centro" usado em compras/relatórios: pode ser cliente ou empresa
function nomeCentro(id){ return id ? (nomeCliente(id) || nomeEmpresa(id)) : '—'; }
function empregadosDoCliente(nome, soAtivos){
  var k = norm(nome);
  return vals(DB.empregados).filter(function(e){ return norm(e.cliente) === k && (!soAtivos || e.ativo !== false); });
}

var syncClientesRodando = false;
function syncClientes(){
  if(syncClientesRodando || !currentUser || !can('cadastros') || !DB_LOADED.clientes || !DB_LOADED.empregados) return;
  var faltando = {};
  vals(DB.empregados).forEach(function(e){
    var nome = (e.cliente || '').trim(); if(!nome) return;
    var k = cliKey(nome); if(!DB.clientes[k] && !faltando[k]) faltando[k] = nome;
  });
  var ks = Object.keys(faltando); if(!ks.length) return;
  var p = {};
  // grava só o nome (caminho folha): se outro usuário já criou com CNPJ/cidade, nada é perdido
  ks.forEach(function(k){ p['clientes/' + k + '/nome'] = faltando[k]; });
  syncClientesRodando = true;
  store.update(p).then(function(){ syncClientesRodando = false; }, function(){ syncClientesRodando = false; });
}

// <select> de centro (compras): clientes e empresas agrupados
function centrosOptsHtml(sel, vazio){
  var cl = vals(DB.clientes).sort(byName), em = vals(DB.empresas).sort(byName);
  function o(x){ return '<option value="'+esc(x._id)+'"'+(x._id === sel ? ' selected' : '')+'>'+esc(x.nome)+'</option>'; }
  return '<option value="">'+esc(vazio || 'Selecione...')+'</option>' +
    (cl.length ? '<optgroup label="Clientes">' + cl.map(o).join('') + '</optgroup>' : '') +
    (em.length ? '<optgroup label="Empresas">' + em.map(o).join('') + '</optgroup>' : '');
}

function renderClientesTab(){
  syncClientes();
  var l = vals(DB.clientes).sort(byName);
  if(!l.length) return emptyState('Os clientes aparecem aqui sozinhos a partir do campo "Cliente" dos colaboradores. Importe a planilha do RH ou preencha o cliente no cadastro do empregado.');
  var emps = {};
  vals(DB.empregados).forEach(function(e){ if(e.ativo === false || !e.cliente) return; var k = cliKey(e.cliente); (emps[k] = emps[k] || {total:0, por:{}}).total++; var en = nomeEmpresa(e.empresaId); emps[k].por[en] = (emps[k].por[en] || 0) + 1; });
  var tot = l.reduce(function(s, c){ return s + ((emps[c._id] || {}).total || 0); }, 0);
  return '<table><thead><tr><th>Cliente</th><th>Empresa(s)</th><th>CNPJ</th><th>Cidade</th><th class="num">Colaboradores ativos</th></tr></thead><tbody>' + l.map(function(c){
    var x = emps[c._id] || {total:0, por:{}};
    var por = Object.keys(x.por).sort().map(function(n){ return '<span class="chip">'+esc(n)+' <b>'+x.por[n]+'</b></span>'; }).join('');
    return '<tr class="row-clickable" data-act="editar-cliente" data-id="'+c._id+'"><td>'+esc(c.nome)+'</td><td><div class="chips">'+(por || '<span style="color:var(--text-faint)">—</span>')+'</div></td>' +
      '<td class="mono">'+esc(c.cnpj || '—')+'</td><td>'+esc(c.cidade || '—')+'</td><td class="num">'+x.total+'</td></tr>';
  }).join('') + '</tbody></table><div class="tbl-foot">'+l.length+' clientes · '+tot+' colaboradores ativos · a lista é atualizada sozinha a partir do cadastro dos colaboradores</div>';
}

function formCliente(id){
  if(!can('cadastros')) return;
  var c = id ? DB.clientes[id] : {}, n = id ? empregadosDoCliente(c.nome).length : 0;
  openModal('<div class="modal-title">'+(id ? 'Editar cliente' : 'Novo cliente')+'</div>' + (id ? '<div class="modal-sub">'+n+' colaborador(es) vinculado(s). Ao renomear, o nome também muda no cadastro deles.</div>' : '') +
    '<div class="modal-grid">' + field('Nome', '<input id="c-nome" value="'+esc(c.nome || '')+'" placeholder="Ex.: FEMSA MARILIA">', 'full') +
    field('CNPJ', '<input id="c-cnpj" value="'+esc(c.cnpj || '')+'">') + field('Cidade', '<input id="c-cid" value="'+esc(c.cidade || '')+'">') + '</div>' +
    (id ? '<input type="hidden" id="c-id" value="'+id+'">' : '') +
    modalActions('Salvar', 'salvar-cliente', id && !n && can('admin') ? '<button class="btn btn-danger" data-act="excluir-cliente" data-id="'+id+'" style="margin-right:auto">Excluir</button>' : ''));
}
formHandlers['editar-cliente'] = function(el){ formCliente(el.dataset.id); };
formHandlers['salvar-cliente'] = function(btn){
  var id = ($('#c-id') || {}).value, nome = $('#c-nome').value.trim(); if(!nome) return formError('Informe o nome.');
  var novaKey = cliKey(nome);
  if(novaKey !== id && DB.clientes[novaKey]) return formError('Já existe um cliente com esse nome.');
  var antigo = id ? DB.clientes[id] : null, p = {};
  var rec = {nome: nome, cnpj: $('#c-cnpj').value.trim(), cidade: $('#c-cid').value.trim()};
  p['clientes/' + novaKey] = rec;
  if(antigo && novaKey !== id){
    p['clientes/' + id] = null;
    // renomeia nos colaboradores e mantém as compras apontando para o cliente novo
    empregadosDoCliente(antigo.nome).forEach(function(e){ p['empregados/' + e._id + '/cliente'] = nome; });
    vals(DB.compras).forEach(function(c){ if(c.unidadeId === id) p['compras/' + c._id + '/unidadeId'] = novaKey; });
  }
  busy(btn, true);
  save(p, antigo ? 'Cliente alterado' : 'Cliente criado', (antigo && antigo.nome !== nome ? antigo.nome + ' → ' : '') + nome)
    .then(function(){ closeModal(); toast('Cliente salvo.'); }).catch(function(e){ busy(btn, false); formError(e.message); });
};
formHandlers['excluir-cliente'] = function(el){
  if(!confirmInline(el, 'Confirmar exclusão')) return;
  var p = {}; p['clientes/' + el.dataset.id] = null;
  save(p, 'Cliente excluído', nomeCliente(el.dataset.id)).then(function(){ closeModal(); toast('Cliente excluído.'); });
};
