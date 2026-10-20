// =====================================================================
// PAINEL ESTOQUE — Grupo Login Serv
// Single-file no mesmo padrão dos painéis RH/DP: Firebase Auth + Realtime Database.
// =====================================================================

// ---------------------------------------------------------------------
// 1) CONFIGURAÇÃO DO FIREBASE
// Cole aqui a configuração do projeto (Console Firebase > Configurações do projeto > Seus apps > Web).
// Enquanto apiKey estiver como "COLE_AQUI", o painel roda em MODO DEMONSTRAÇÃO (dados só no navegador).
// ---------------------------------------------------------------------
var firebaseConfig = {
  apiKey: "AIzaSyASEKuo1T7TQFgTaELGdFoE1qpPiqHEf8M",
  authDomain: "painel-estoque-9ecf0.firebaseapp.com",
  databaseURL: "https://painel-estoque-9ecf0-default-rtdb.firebaseio.com",
  projectId: "painel-estoque-9ecf0",
  storageBucket: "painel-estoque-9ecf0.firebasestorage.app",
  messagingSenderId: "532805330196",
  appId: "1:532805330196:web:576eb1fdc83c11abab4e01",
  measurementId: "G-QZ67BYWN2N"
};
var DB_ROOT = 'painel-estoque';

// ---------------------------------------------------------------------
// 2) PERFIS E USUÁRIOS
// O usuário digita o nome; o sistema troca pelo e-mail cadastrado no Firebase Authentication.
// As senhas NÃO ficam aqui — são validadas pelo Firebase.
// ---------------------------------------------------------------------
var rolePermissions = {
  administrador: {label:'Administrador', initials:'AD', movimentar:true,  entregar:true,  produtos:true,  empregados:true,  cadastros:true,  solicitar:true,  comprar:true,  aprovar:true,  admin:true},
  almoxarife:    {label:'Almoxarife',    initials:'AL', movimentar:true,  entregar:true,  produtos:true,  empregados:true,  cadastros:true,  solicitar:true,  comprar:false, aprovar:false, admin:false},
  tecnico_sst:   {label:'Técnico de SST',initials:'TS', movimentar:false, entregar:true,  produtos:false, empregados:true,  cadastros:true,  solicitar:true,  comprar:false, aprovar:false, admin:false},
  comprador:     {label:'Comprador',     initials:'CP', movimentar:true,  entregar:false, produtos:true,  empregados:false, cadastros:true,  solicitar:true,  comprar:true,  aprovar:false, admin:false},
  aprovador:     {label:'Aprovador',     initials:'AP', movimentar:false, entregar:false, produtos:false, empregados:false, cadastros:false, solicitar:true,  comprar:false, aprovar:true,  admin:false},
  consulta:      {label:'Consulta',      initials:'CO', movimentar:false, entregar:false, produtos:false, empregados:false, cadastros:false, solicitar:false, comprar:false, aprovar:false, admin:false}
};
var USER_ROLES = [
  {user:'gabriel', email:'gabriel@loginserv.com.br', name:'Gabriel', role:'administrador'},
  {user:'carol',   email:'carol@loginserv.com.br',   name:'Carol',   role:'administrador'}
  // Exemplo: {user:'joao', email:'almoxarifado@loginserv.com.br', name:'João', role:'almoxarife'},
];

// =====================================================================
// HELPERS
// =====================================================================
var FB_ON = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== 'COLE_AQUI' && firebaseConfig.databaseURL);
var COLS = ['produtos','saldos','movimentos','entregas','empregados','empresas','cargos','locais','compras','config','logs'];
var DB = {}; COLS.forEach(function(c){ DB[c] = {}; });

function $(s, el){ return (el||document).querySelector(s); }
function $$(s, el){ return Array.prototype.slice.call((el||document).querySelectorAll(s)); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function pad(n){ return (n < 10 ? '0' : '') + n; }
function today(){ var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function nowTs(){ return Date.now(); }
function fmtD(iso){ return iso ? iso.slice(8,10) + '/' + iso.slice(5,7) + '/' + iso.slice(0,4) : '—'; }
function fmtDT(ts){ if(!ts) return '—'; var d = new Date(ts); return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes()); }
function addDays(iso, n){ var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function daysUntil(iso){ if(!iso) return null; return Math.round((new Date(iso + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5); }
function fmtN(n){ return Number(n || 0).toLocaleString('pt-BR'); }
function fmtR(n){ return Number(n || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); }
function num(v){ if(typeof v === 'number') return v; v = String(v || '').replace(/\./g,'').replace(',', '.'); var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function norm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim(); }
function tamKey(t){ t = String(t || '').trim().toUpperCase(); return t ? t.replace(/[.#$\[\]\/]/g, '_') : 'UN'; }
function tamLabel(k){ return !k || k === 'UN' ? '—' : k; }
function vals(o){ return Object.keys(o || {}).map(function(k){ var v = o[k]; if(v && typeof v === 'object') v._id = k; return v; }); }
function byName(a, b){ return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); }
function cfg(k, d){ var v = (DB.config || {})[k]; return v == null || v === '' ? d : v; }

function toast(msg, kind){
  var t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || 'ok');
  clearTimeout(toast._t); toast._t = setTimeout(function(){ t.className = 'toast'; }, 3200);
}

// Rótulos dos tipos de movimento
var MOV_TIPOS = {
  entrada:       {label:'Entrada',       cls:'teal',  sinal: 1},
  entrega:       {label:'Entrega',       cls:'blue',  sinal:-1},
  devolucao:     {label:'Devolução',     cls:'teal',  sinal: 1},
  ajuste_mais:   {label:'Ajuste (+)',    cls:'amber', sinal: 1},
  ajuste_menos:  {label:'Ajuste (−)',    cls:'amber', sinal:-1},
  transf_saida:  {label:'Transf. saída', cls:'gray',  sinal:-1},
  transf_entrada:{label:'Transf. entrada',cls:'gray', sinal: 1},
  baixa:         {label:'Baixa',         cls:'red',   sinal:-1},
  devol_descarte:{label:'Devolução (descarte)', cls:'gray', sinal:0},
  carga_inicial: {label:'Saldo inicial', cls:'gray',  sinal: 1}
};
var MOTIVOS_ENTREGA = ['Primeira entrega (admissão)','Troca por desgaste','Troca por vencimento da vida útil','Perda / extravio','Dano / quebra','Mudança de função','Outros'];
var MOTIVOS_BAIXA = ['CA vencido','Produto danificado','Perda / extravio','Descarte de devolução','Validade do produto vencida','Outros'];
var MOTIVOS_AJUSTE = ['Inventário / contagem','Correção de lançamento','Outros'];

// =====================================================================
// CAMADA DE DADOS (Firebase Realtime Database ou modo local)
// =====================================================================
var store = null;

function firebaseStore(){
  var root = firebase.database().ref(DB_ROOT);
  var listeners = [];
  return {
    start: function(){
      COLS.forEach(function(c){
        var ref = c === 'logs' ? root.child(c).limitToLast(300) : root.child(c);
        var fn = function(snap){ DB[c] = snap.val() || {}; scheduleRender(); };
        ref.on('value', fn, function(err){ console.error(c, err); setSync('err', 'Erro de acesso'); });
        listeners.push([ref, fn]);
      });
      var con = firebase.database().ref('.info/connected');
      var cf = function(s){ setSync(s.val() ? 'ok' : 'syncing', s.val() ? 'Sincronizado' : 'Reconectando...'); };
      con.on('value', cf); listeners.push([con, cf]);
    },
    stop: function(){ listeners.forEach(function(l){ l[0].off('value', l[1]); }); listeners = []; COLS.forEach(function(c){ DB[c] = {}; }); },
    key: function(){ return root.push().key; },
    update: function(paths){
      setSync('syncing', 'Salvando...');
      return root.update(paths).then(function(){ setSync('ok', 'Sincronizado'); }, function(e){ setSync('err', 'Erro ao salvar'); throw e; });
    },
    txn: function(path, fn){
      return root.child(path).transaction(fn).then(function(r){ return {committed: r.committed, value: r.snapshot.val()}; });
    }
  };
}

function localStore(){
  var K = 'painelestoque_demo_v1';
  function save(){ try{ localStorage.setItem(K, JSON.stringify(DB)); }catch(e){ toast('Armazenamento local cheio', 'err'); } }
  function walk(path, create){
    var parts = path.split('/'), o = DB;
    for(var i = 0; i < parts.length - 1; i++){
      if(!o[parts[i]] || typeof o[parts[i]] !== 'object'){ if(!create) return [null, null]; o[parts[i]] = {}; }
      o = o[parts[i]];
    }
    return [o, parts[parts.length - 1]];
  }
  function setPath(path, val){
    var w = walk(path, val !== null); if(!w[0]) return;
    if(val === null || val === undefined) delete w[0][w[1]]; else w[0][w[1]] = JSON.parse(JSON.stringify(val));
  }
  function getPath(path){ var w = walk(path, false); return w[0] ? w[0][w[1]] : undefined; }
  return {
    start: function(){
      try{ var s = JSON.parse(localStorage.getItem(K) || 'null'); if(s) COLS.forEach(function(c){ DB[c] = s[c] || {}; }); }catch(e){}
      setSync('syncing', 'Modo local'); scheduleRender();
    },
    stop: function(){},
    key: function(){ return '-L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); },
    update: function(paths){ Object.keys(paths).forEach(function(p){ setPath(p, paths[p]); }); save(); scheduleRender(); return Promise.resolve(); },
    txn: function(path, fn){
      var cur = getPath(path); var nv = fn(cur === undefined ? null : cur);
      if(nv === undefined) return Promise.resolve({committed:false, value:cur});
      setPath(path, nv); save(); scheduleRender(); return Promise.resolve({committed:true, value:nv});
    }
  };
}

function setSync(state, label){
  var p = $('#sync-pill'); if(!p) return;
  p.className = 'sync-pill' + (state === 'ok' ? '' : ' ' + state);
  $('#sync-label').textContent = label || '';
}

// ---------------------------------------------------------------------
// SALDOS — sempre via transação, um item por vez. Se algum item falhar
// (saldo insuficiente), os anteriores são desfeitos.
// ops: [{pid, tk, loc, delta}]
// ---------------------------------------------------------------------
function applyStock(ops){
  var done = [];
  function undo(){
    return done.reduce(function(p, d){
      return p.then(function(){ return store.txn('saldos/'+d.pid+'/'+d.tk+'/'+d.loc, function(cur){ var n = (+cur || 0) - d.delta; return n === 0 ? null : n; }); });
    }, Promise.resolve());
  }
  return ops.reduce(function(p, op){
    return p.then(function(){
      return store.txn('saldos/'+op.pid+'/'+op.tk+'/'+op.loc, function(cur){
        var n = (+cur || 0) + op.delta;
        if(n < 0) return; // aborta
        return n === 0 ? null : n;
      }).then(function(r){
        if(!r.committed){
          var pr = DB.produtos[op.pid] || {};
          var disp = saldoDe(op.pid, op.tk, op.loc);
          var err = new Error('Saldo insuficiente: ' + (pr.nome || op.pid) + (op.tk !== 'UN' ? ' (' + op.tk + ')' : '') + ' — disponível ' + disp + ', pedido ' + (-op.delta) + '.');
          return undo().then(function(){ throw err; });
        }
        done.push(op);
      });
    });
  }, Promise.resolve());
}

function saldoDe(pid, tk, loc){
  var t = (DB.saldos[pid] || {})[tk] || {};
  if(loc) return +t[loc] || 0;
  return Object.keys(t).reduce(function(s, l){ return s + (+t[l] || 0); }, 0);
}
function saldoProduto(pid, loc){
  var t = DB.saldos[pid] || {};
  return Object.keys(t).reduce(function(s, tk){ return s + saldoDe(pid, tk, loc); }, 0);
}
function tamanhosProduto(pid){
  var p = DB.produtos[pid] || {};
  var list = (p.tamanhos || []).map(tamKey);
  Object.keys(DB.saldos[pid] || {}).forEach(function(k){ if(list.indexOf(k) === -1) list.push(k); });
  if(!list.length) list = ['UN'];
  return list;
}
function movRecord(o){
  var r = {data: o.data || today(), ts: nowTs(), tipo: o.tipo, pid: o.pid, tk: o.tk || 'UN', loc: o.loc, qtd: Math.abs(o.qtd), usuario: currentUser ? currentUser.name : ''};
  ['locDest','custoUnit','empregadoId','entregaId','motivo','doc','fornecedor','obs'].forEach(function(k){ if(o[k] !== undefined && o[k] !== '') r[k] = o[k]; });
  return r;
}
function logPaths(paths, acao, detalhe){
  paths['logs/' + store.key()] = {ts: nowTs(), usuario: currentUser ? currentUser.name : '', acao: acao, detalhe: detalhe || ''};
  return paths;
}
function save(paths, acao, detalhe){ return store.update(logPaths(paths, acao, detalhe)); }

// =====================================================================
// LOGIN
// =====================================================================
var currentUser = null, currentRole = null, firebaseAuth = null;
function can(p){ return !!(currentRole && currentRole[p]); }

function findUserRoleByUsername(u){ var k = norm(u); return USER_ROLES.find(function(x){ return norm(x.user) === k; }); }
function findUserRoleByEmail(e){ e = String(e || '').toLowerCase(); return USER_ROLES.find(function(x){ return x.email.toLowerCase() === e; }); }

function completeLogin(ur){
  currentUser = ur; currentRole = rolePermissions[ur.role] || rolePermissions.consulta;
  $('#role-avatar').textContent = currentRole.initials;
  $('#role-name').textContent = ur.name;
  $('#role-pill-label').textContent = currentRole.label;
  $('#login-screen').style.display = 'none';
  $('#app-shell').classList.add('visible');
  applyRolePermissions();
  store.start();
  var nav = ''; try{ nav = localStorage.getItem('painelestoque_nav') || ''; }catch(e){}
  showModule(nav.split('/')[0] || 'inicio', nav.split('/')[1]);
}
function applyRolePermissions(){
  $$('[data-somente-admin]').forEach(function(el){ el.style.display = can('admin') ? '' : 'none'; });
  ['movimentar','entregar','produtos','empregados','cadastros','solicitar','comprar','aprovar'].forEach(function(p){
    $$('.need-' + p).forEach(function(b){ b.disabled = !can(p); b.title = can(p) ? '' : 'Seu perfil não permite esta ação.'; });
  });
}
function initAuth(){
  if(!FB_ON){
    document.body.classList.add('demo');
    store = localStore();
    try{ var u = sessionStorage.getItem('painelestoque_demo_user'); if(u){ var ur = findUserRoleByUsername(u); if(ur) completeLogin(ur); } }catch(e){}
    return;
  }
  firebase.initializeApp(firebaseConfig);
  firebaseAuth = firebase.auth();
  store = firebaseStore();
  firebaseAuth.onAuthStateChanged(function(user){
    var btn = $('#login-form button[type=submit]'); btn.disabled = false;
    if(user){
      var ur = findUserRoleByEmail(user.email);
      if(!ur){ firebaseAuth.signOut(); loginError('Usuário sem perfil neste painel.'); return; }
      completeLogin(ur);
    }
  });
}
function loginError(m){ var e = $('#login-error'); e.textContent = m || 'Usuário ou senha inválidos.'; e.style.display = 'block'; }

document.addEventListener('DOMContentLoaded', function(){
  $('#login-form').addEventListener('submit', function(e){
    e.preventDefault();
    var u = $('#login-user').value.trim(), pass = $('#login-pass').value;
    var ur = findUserRoleByUsername(u);
    if(!ur || !pass){ loginError(); return; }
    $('#login-error').style.display = 'none';
    if(!FB_ON){
      if(pass !== 'demo'){ loginError('No modo demonstração a senha é "demo".'); return; }
      try{ sessionStorage.setItem('painelestoque_demo_user', ur.user); }catch(err){}
      completeLogin(ur); return;
    }
    var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
    firebaseAuth.signInWithEmailAndPassword(ur.email, pass).catch(function(err){ console.error(err); btn.disabled = false; loginError(); });
  });
  $('#btn-logout').addEventListener('click', function(){
    store.stop(); currentUser = null; currentRole = null;
    try{ sessionStorage.removeItem('painelestoque_demo_user'); }catch(e){}
    if(FB_ON) firebaseAuth.signOut();
    $('#app-shell').classList.remove('visible');
    $('#login-screen').style.display = 'flex';
    $('#login-form').reset();
  });
  initUI();
  initAuth();
});
