// =====================================================================
// IMPRESSÃO — Termo de recebimento e Ficha de controle de EPI (NR-6)
// =====================================================================
function prHead(titulo){
  return '<div class="pr-head"><img src="'+LOGO_SRC+'" alt=""><div class="pr-title">'+esc(titulo)+'<div style="font-size:11px;font-weight:normal">'+esc(cfg('empresaTermo', 'Grupo Login Serv'))+'</div></div></div>';
}
function prEmpInfo(e){
  return '<div class="pr-info"><div><b>Empregado</b>'+esc(e.nome)+'</div><div><b>Matrícula</b>'+esc(e.matricula || '—')+'</div><div><b>CPF</b>'+esc(e.cpf || '—')+'</div>' +
    '<div><b>Empresa / unidade</b>'+esc(nomeEmpresa(e.empresaId))+'</div><div><b>Cargo</b>'+esc(nomeCargo(e.cargoId))+'</div><div><b>Setor</b>'+esc(e.setor || '—')+'</div></div>';
}
var TEXTO_NR6 = 'Declaro ter recebido gratuitamente da empresa os Equipamentos de Proteção Individual (EPI) e/ou uniformes relacionados abaixo, em perfeito estado de conservação e funcionamento, ' +
  'e ter sido orientado(a) e treinado(a) sobre o uso adequado, a guarda e a conservação. Comprometo-me, conforme a NR-6 e o art. 158 da CLT, a: (a) usá-los apenas para a finalidade a que se destinam; ' +
  '(b) responsabilizar-me pela guarda e conservação; (c) comunicar ao empregador qualquer alteração que os torne impróprios para uso; (d) cumprir as determinações do empregador sobre o uso adequado; ' +
  '(e) devolvê-los ao término do contrato ou quando solicitado. Estou ciente de que a recusa injustificada ao uso do EPI constitui ato faltoso.';

function termoHtml(entId){
  var en = DB.entregas[entId]; if(!en) return '';
  var e = DB.empregados[en.empregadoId] || {};
  return prHead('Termo de Recebimento de EPI') + prEmpInfo(e) +
    '<div class="pr-text">' + TEXTO_NR6 + '</div>' +
    '<table class="pr-table"><thead><tr><th>Qtd</th><th>Descrição</th><th>Tam.</th><th>CA</th><th>Validade CA</th><th>Próxima troca</th></tr></thead><tbody>' +
    (en.itens || []).map(function(i){ return '<tr><td>'+i.qtd+'</td><td>'+esc(nomeProd(i.pid))+'</td><td>'+esc(tamLabel(i.tk))+'</td><td>'+esc(i.ca || '—')+'</td><td>'+fmtD(i.validadeCA)+'</td><td>'+fmtD(i.proximaTroca)+'</td></tr>'; }).join('') +
    '</tbody></table><div><b>Data da entrega:</b> '+fmtD(en.data)+' &nbsp; <b>Motivo:</b> '+esc(en.motivo || '')+(en.obs ? ' &nbsp; <b>Obs.:</b> ' + esc(en.obs) : '')+'</div>' +
    '<div class="pr-sign"><div>'+(en.assinatura ? '<img src="'+en.assinatura+'" alt="">' : '<br><br>')+esc(e.nome)+'<br>Empregado</div><div><br><br>'+esc(en.usuario || '')+'<br>Responsável pela entrega</div></div>';
}
function fichaHtml(empId, de, ate){
  var e = DB.empregados[empId] || {};
  var ents = vals(DB.entregas).filter(function(en){ return en.empregadoId === empId && !en.cancelada && (!de || en.data >= de) && (!ate || en.data <= ate); }).sort(function(a, b){ return a.data < b.data ? -1 : 1; });
  var linhas = [];
  ents.forEach(function(en){ (en.itens || []).forEach(function(i){ linhas.push({en:en, i:i}); }); });
  var devols = vals(DB.movimentos).filter(function(m){ return m.empregadoId === empId && (m.tipo === 'devolucao' || m.tipo === 'devol_descarte'); });
  return prHead('Ficha de Controle de EPI') + prEmpInfo(e) +
    '<div class="pr-info"><div><b>Admissão</b>'+fmtD(e.admissao)+'</div><div><b>Período</b>'+(de || ate ? fmtD(de) + ' a ' + fmtD(ate) : 'Todo o histórico')+'</div><div><b>Emitida em</b>'+fmtD(today())+'</div></div>' +
    '<div class="pr-text">' + TEXTO_NR6 + '</div>' +
    '<table class="pr-table"><thead><tr><th>Data</th><th>Qtd</th><th>Descrição</th><th>Tam.</th><th>CA</th><th>Motivo</th><th>Devolução</th><th style="width:150px">Assinatura</th></tr></thead><tbody>' +
    (linhas.length ? linhas.map(function(l){
      var dv = devols.filter(function(m){ return m.entregaId === l.en._id && m.pid === l.i.pid; }).map(function(m){ return fmtD(m.data) + ' (' + m.qtd + ')'; }).join(', ');
      return '<tr><td>'+fmtD(l.en.data)+'</td><td>'+l.i.qtd+'</td><td>'+esc(nomeProd(l.i.pid))+'</td><td>'+esc(tamLabel(l.i.tk))+'</td><td>'+esc(l.i.ca || '—')+'</td><td>'+esc(l.en.motivo || '')+'</td><td>'+(dv || '')+'</td><td style="height:34px">'+(l.en.assinatura ? '<img src="'+l.en.assinatura+'" style="max-height:30px">' : '')+'</td></tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center">Nenhuma entrega no período.</td></tr>') +
    '</tbody></table><div class="pr-sign"><div><br>'+esc(e.nome)+'<br>Empregado</div><div><br>Responsável — '+esc(cfg('empresaTermo', 'Grupo Login Serv'))+'</div></div>';
}
function doPrint(html){
  $('#print-area').innerHTML = html;
  var imgs = $$('#print-area img'), pend = imgs.filter(function(i){ return !i.complete; });
  var done = false, go = function(){ if(done) return; done = true; setTimeout(function(){ window.print(); }, 60); };
  if(!pend.length) go(); else { var n = pend.length; pend.forEach(function(i){ i.onload = i.onerror = function(){ if(--n === 0) go(); }; }); setTimeout(go, 1500); }
}
function printTermo(entId){ doPrint(termoHtml(entId)); }
function printFicha(empId, de, ate){ doPrint(fichaHtml(empId, de, ate)); }
function printRelatorio(){
  if(!relData || !relData.rows || !relData.rows.length){ toast('Nada para imprimir.', 'err'); return; }
  var cols = Object.keys(relData.rows[0]);
  doPrint(prHead({consumo:'Consumo de EPI por período', 'consumo-por-empresa':'Consumo de EPI por empresa'}[relData.nome] || 'Relatório') +
    '<div class="pr-info"><div><b>Período</b>'+fmtD($('#rel-de').value)+' a '+fmtD($('#rel-ate').value)+'</div><div><b>Empresa</b>'+esc($('#rel-empresa').value ? nomeEmpresa($('#rel-empresa').value) : 'Todas')+'</div><div><b>Emitido em</b>'+fmtDT(nowTs())+'</div></div>' +
    '<table class="pr-table"><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('')+'</tr></thead><tbody>' +
    relData.rows.map(function(r){ return '<tr>'+cols.map(function(c){ var v = r[c]; return '<td>'+esc(typeof v === 'number' && /valor/i.test(c) ? fmtR(v) : v)+'</td>'; }).join('')+'</tr>'; }).join('') + '</tbody></table>');
}

// =====================================================================
// EXPORTAÇÃO EXCEL (SheetJS, mesma biblioteca do Painel DP)
// =====================================================================
function exportXlsx(nome, rows){
  if(!rows || !rows.length){ toast('Nada para exportar.', 'err'); return; }
  if(typeof XLSX === 'undefined'){ toast('Biblioteca de planilhas não carregou.', 'err'); return; }
  var ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(function(k){ var w = Math.max(k.length, ...rows.slice(0, 300).map(function(r){ return String(r[k] == null ? '' : r[k]).length; })); return {wch: Math.min(Math.max(w + 2, 8), 60)}; });
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
  XLSX.writeFile(wb, nome + '-' + today() + '.xlsx');
}
function exportEstoque(){
  var loc = $('#est-local').value, rows = [];
  vals(DB.produtos).filter(function(p){ return p.ativo !== false; }).sort(byName).forEach(function(p){
    tamanhosProduto(p._id).forEach(function(k){
      var s = saldoDe(p._id, k, loc); if(!s && !$('#est-zerados').checked) return;
      rows.push({Produto:p.nome, Categoria:p.categoria, CA:p.ca || '', 'Validade CA':fmtD(p.validadeCA), Tamanho:tamLabel(k), Local:loc ? nomeLocal(loc) : 'Todos', Quantidade:s, 'Custo medio':p.custo || 0, Valor:Math.round(s * (+p.custo || 0) * 100) / 100});
    });
  });
  exportXlsx('posicao-estoque', rows);
}
function exportEntregas(){
  var rows = [];
  filtroEntregas().forEach(function(en){
    var e = DB.empregados[en.empregadoId] || {};
    (en.itens || []).forEach(function(i){ rows.push({Data:fmtD(en.data), Empregado:e.nome, Matricula:e.matricula || '', Empresa:nomeEmpresa(e.empresaId), Cargo:nomeCargo(e.cargoId), Produto:nomeProd(i.pid), Tamanho:tamLabel(i.tk), Quantidade:i.qtd, CA:i.ca || '', 'Proxima troca':fmtD(i.proximaTroca), Devolvido:i.devolvido || 0, Motivo:en.motivo || '', Assinado:en.assinatura ? 'Sim' : 'Não', Responsavel:en.usuario || ''}); });
  });
  exportXlsx('entregas-epi', rows);
}
