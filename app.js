/* Controle de Viaturas — CPA-7
   Desenvolvido por ST Galassi. Revisão: navegação estável, menu no celular,
   gravações seguras no Firebase (transação) e validações. */
'use strict';

const KEY = 'cpa7_online_v10';
const FIREBASE_CONFIG = {apiKey:"AIzaSyA2H-sd3gaBArqy6pE1pVcV-1Nz14N-dZE",authDomain:"controle-de-viaturas-cpa-7.firebaseapp.com",projectId:"controle-de-viaturas-cpa-7",storageBucket:"controle-de-viaturas-cpa-7.firebasestorage.app",messagingSenderId:"630650169264",appId:"1:630650169264:web:498aa0a12d48bcb3de9875",measurementId:"G-V4NC72LX2L"};
const ADMIN_EMAIL = '03galassi@gmail.com';
const TCARD_WORKER_URL = 'https://controle-viaturas-tcard-bridge.03galassi.workers.dev';
const ALERT_KM = 1000;
const CREST = 'assets/brasao_pmms.png';
const MAINT_TYPES = ['Manutenção preventiva','Manutenção corretiva','Pneus','Bateria','Freios','Revisão','Outro'];

/* ---------- Estado ---------- */
function normalize(d){
  d = d || {};
  return {
    units: Array.isArray(d.units) ? d.units : [],
    vehicles: Array.isArray(d.vehicles) ? d.vehicles.map(fixVehicle) : [],
    maintenance: Array.isArray(d.maintenance) ? d.maintenance : [],
    drivers: Array.isArray(d.drivers) ? d.drivers.map(x => { const y = {...x}; delete y.password; return y; }) : []
  };
}
function fixVehicle(v){
  const x = {...v};
  x.km = num(x.km); x.last = num(x.last); x.interval = num(x.interval) || 5000;
  x.next = Number.isFinite(Number(x.next)) && x.next !== '' && x.next != null ? num(x.next) : x.last + x.interval;
  return x;
}
function num(n){ const x = Number(n); return Number.isFinite(x) ? x : 0; }

let s = (() => {
  let local = null;
  try { local = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
  return {...normalize(local), session: local?.session ?? null};
})();
function saveLocal(){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e) {} }
function applyData(d){ Object.assign(s, normalize(d)); saveLocal(); }

/* Interface: página atual e filtros (não vai para o Firebase) */
const ui = { page: 'dashboard', vehQuery: '', vehUnit: '', maintVehicle: '', maintQuery: '', histMine: false };

/* ---------- Firebase ---------- */
let firebaseReady = false, stateUnsubscribe = null, auth, db, secondaryApp;
try {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth(); db = firebase.firestore(); firebaseReady = true;
} catch(err) { console.error('Firebase initialization error:', err); }
const stateRef = () => db.collection('app').doc('state');
const payload = d => ({...normalize(d), updatedAt: firebase.firestore.FieldValue.serverTimestamp()});

async function loadRemote(){
  const snap = await stateRef().get();
  if (snap.exists) applyData(snap.data());
  else { await stateRef().set(payload(s)); saveLocal(); }
}
function subscribeRemote(){
  if (stateUnsubscribe) stateUnsubscribe();
  stateUnsubscribe = stateRef().onSnapshot(snap => {
    if (!snap.exists || snap.metadata.hasPendingWrites) return;
    applyData(snap.data());
    if (s.session?.role === 'driver') {
      const d = s.drivers.find(x => x.id === s.session.driverId);
      if (!d || d.active === false) { alert('Seu acesso foi desativado pelo administrador.'); logout(); return; }
    }
    refresh();
  }, err => { console.error(err); toast('Sem sincronização online no momento.', 'error'); });
}

/* Toda alteração passa por aqui: aplica na tela e grava no Firebase dentro de
   uma transação, sobre a versão mais recente — assim um usuário não apaga
   o lançamento feito ao mesmo tempo por outro. */
async function commit(mutator, okMsg){
  mutator(s); saveLocal(); refresh();
  if (!firebaseReady || !auth.currentUser) { if (okMsg) toast(okMsg); return true; }
  try {
    await db.runTransaction(async t => {
      const snap = await t.get(stateRef());
      const fresh = normalize(snap.exists ? snap.data() : s);
      mutator(fresh);
      t.set(stateRef(), payload(fresh));
    });
    if (okMsg) toast(okMsg);
    return true;
  } catch(err) {
    console.error(err);
    alert('Não foi possível salvar online. Verifique a conexão com a internet e tente novamente.');
    try { await loadRemote(); } catch(e) {}
    refresh();
    return false;
  }
}

/* ---------- Utilitários ---------- */
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const kmfmt = n => Number(n || 0).toLocaleString('pt-BR');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function today(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDate(d){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || ''); }
const findV = id => s.vehicles.find(v => v.id === id);
const findUnit = id => s.units.find(u => u.id === id);
const me = () => s.drivers.find(x => x.id === s.session?.driverId);
function vstate(v){
  const rem = v.next - v.km;
  if (rem < 0) return {rem, key:'overdue', label:`VENCIDA ${kmfmt(-rem)} km`};
  if (rem < ALERT_KM) return {rem, key:'alert', label:`FALTAM ${kmfmt(rem)} km`};
  return {rem, key:'ok', label:'OK'};
}
const sortV = arr => arr.slice().sort((a,b) => String(a.unit).localeCompare(String(b.unit),'pt-BR') || String(a.prefix).localeCompare(String(b.prefix),'pt-BR',{numeric:true}));

function toast(msg, type='ok'){
  let box = $('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ---------- Modal ---------- */
let pendingRefresh = false;
function modal(title, html){
  closeModal(true);
  const wrap = document.createElement('div'); wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><small>PMMS • CPA-7</small><h2>${esc(title)}</h2></div><button type="button" class="close" aria-label="Fechar" onclick="closeModal()">×</button></div>${html}</div>`;
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
  setTimeout(() => wrap.querySelector('input:not([disabled]),select,textarea')?.focus(), 30);
  return wrap;
}
function closeModal(silent){
  document.querySelector('.modal-backdrop')?.remove();
  if (!silent && pendingRefresh) { pendingRefresh = false; refresh(); }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function formError(form, msg){
  let el = form.querySelector('.form-error');
  if (!el) { el = document.createElement('div'); el.className = 'form-error full'; form.querySelector('.modal-actions').before(el); }
  el.textContent = msg; return false;
}

/* ---------- Navegação ---------- */
function refresh(){
  if (!s.session) return;
  if (document.querySelector('.modal-backdrop')) { pendingRefresh = true; return; }
  go(ui.page, true);
}
const ADMIN_PAGES = {dashboard, units, vehicles, drivers, maint, tcard: tcardIntegrationPage};
const DRIVER_PAGES = {driverHome, driverHistory};
function go(page, keepScroll){
  const y = keepScroll ? window.scrollY : 0;
  if (s.session?.role === 'admin') {
    if (!ADMIN_PAGES[page]) page = 'dashboard';
    ui.page = page;
    if (!document.querySelector('.admin-layout')) adminShell();
    ADMIN_PAGES[page]();
  } else if (s.session?.role === 'driver') {
    if (!DRIVER_PAGES[page]) page = 'driverHome';
    ui.page = page;
    if (!document.querySelector('.driver-layout')) driverShell();
    if (!DRIVER_PAGES[page]()) return;
  } else { login(); return; }
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle(b.classList.contains('driver-menu-btn') ? 'selected' : 'active', b.dataset.page === page));
  window.scrollTo(0, y);
}
function openUnitVehicles(unitId){ ui.vehUnit = findUnit(unitId)?.name || ''; ui.vehQuery = ''; go('vehicles'); }

/* ---------- Login ---------- */
async function boot(){
  if (!firebaseReady) { login('Não foi possível carregar o sistema online. Verifique a internet e recarregue a página.'); return; }
  auth.onAuthStateChanged(async user => {
    try {
      if (!user) { s.session = null; saveLocal(); login(); return; }
      await loadRemote();
      const email = (user.email || '').toLowerCase();
      if (email === ADMIN_EMAIL) s.session = {role:'admin', uid:user.uid};
      else {
        const d = s.drivers.find(x => x.uid === user.uid || x.email?.toLowerCase() === email);
        if (!d || d.active === false) { s.session = null; saveLocal(); await auth.signOut(); login('Acesso não cadastrado ou inativo. Procure o administrador.'); return; }
        s.session = {role:'driver', driverId:d.id, uid:user.uid, selectedVehicleId: s.session?.driverId === d.id ? (s.session.selectedVehicleId || '') : ''};
      }
      saveLocal(); subscribeRemote();
      document.getElementById('app').innerHTML = '';
      go(s.session.role === 'admin' ? 'dashboard' : 'driverHome');
    } catch(err) {
      console.error(err);
      login('Não foi possível carregar os dados online. Verifique a conexão e tente novamente.');
    }
  });
}

function login(msg=''){
  document.body.className = 'login-body';
  $('app').innerHTML = `<main class="login-screen">
  <div class="login-hero">
    <img src="${CREST}" class="login-crest" alt="Brasão PMMS">
    <div><div class="login-brand">POLÍCIA MILITAR</div><div class="login-state">MATO GROSSO DO SUL</div><div class="login-cpa">CPA-7</div><div class="login-cpa-sub">COMANDO DE POLICIAMENTO DA FRONTEIRA BIOCEÂNICA</div></div>
  </div>
  <form class="login-card" id="loginForm" novalidate>
    <h1>Controle de Viaturas</h1>
    <p>Acesso ao sistema</p>
    <label>E-mail<input id="email" type="email" autocomplete="username" inputmode="email" required></label>
    <label>Senha<input id="pass" type="password" autocomplete="current-password" required></label>
    <button class="primary wide" id="loginBtn" type="submit">ENTRAR</button>
    <button class="text-button" type="button" onclick="resetPassword()">Esqueci minha senha</button>
    <div id="msg">${msg ? `<div class="error">${esc(msg)}</div>` : ''}</div>
    <div class="developer-credit">Desenvolvido por <strong>ST Galassi</strong></div>
  </form>
 </main>`;
  $('loginForm').onsubmit = e => { e.preventDefault(); doLogin(); };
}
async function doLogin(){
  const e = $('email').value.trim().toLowerCase(), p = $('pass').value;
  if (!firebaseReady) { $('msg').innerHTML = '<div class="error">Sistema online não carregado. Verifique a internet.</div>'; return; }
  if (!e || !p) { $('msg').innerHTML = '<div class="error">Informe e-mail e senha.</div>'; return; }
  $('loginBtn').disabled = true;
  $('msg').innerHTML = '<div class="loading">Entrando...</div>';
  try { await auth.signInWithEmailAndPassword(e, p); }
  catch(err) {
    console.error(err);
    const m = {'auth/network-request-failed':'Sem conexão com a internet.','auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.','auth/invalid-email':'E-mail inválido.','auth/user-disabled':'Usuário desativado.'}[err.code] || 'E-mail ou senha incorretos.';
    $('msg').innerHTML = `<div class="error">${m}</div>`;
    if ($('loginBtn')) $('loginBtn').disabled = false;
  }
}
async function resetPassword(){
  let e = ($('email')?.value || '').trim();
  if (!e) e = (prompt('Digite o e-mail cadastrado:') || '').trim();
  if (!e) return;
  try { await auth.sendPasswordResetEmail(e.toLowerCase()); alert('Se o e-mail estiver cadastrado, o link de recuperação foi enviado para ' + e + '.'); }
  catch(err) { console.error(err); alert(err.code === 'auth/invalid-email' ? 'E-mail inválido.' : 'Não foi possível enviar o e-mail de recuperação.'); }
}
async function logout(){
  s.session = null; saveLocal();
  if (stateUnsubscribe) { stateUnsubscribe(); stateUnsubscribe = null; }
  closeModal(true);
  try { if (firebaseReady) await auth.signOut(); } catch(err) { console.error(err); }
  login();
}

function shellHeader(title, subtitle=''){
  return `<header class="topbar">
    <div class="brand-wrap">
      <img src="${CREST}" class="crest" alt="Brasão PMMS">
      <div><div class="brand-small">POLÍCIA MILITAR</div><div class="brand-state">MATO GROSSO DO SUL</div><div class="brand-title">${esc(title)}</div>${subtitle ? `<div class="brand-sub">${esc(subtitle)}</div>` : ''}</div>
    </div>
    <div class="top-actions"><span class="system-label">CONTROLE DE VIATURAS</span><button class="top-exit" onclick="logout()">Sair</button></div>
  </header>`;
}

/* ---------- Administrador ---------- */
function adminShell(){
  document.body.className = 'admin-body';
  const items = [['dashboard','⌂','Painel'],['units','🏢','Unidades'],['vehicles','🚓','Viaturas'],['drivers','👮','Motoristas'],['maint','🔧','Manutenções'],['tcard','🔄','Integração TCard']];
  $('app').innerHTML = `${shellHeader('CPA-7','Comando de Policiamento da Fronteira Bioceânica')}
 <div class="admin-layout">
  <aside class="sidebar">
    <div class="profile"><img src="${CREST}" alt=""><div><b>ADMINISTRADOR</b><span>CPA-7</span></div></div>
    ${items.map(([p,i,l]) => `<button class="nav" data-page="${p}" onclick="go('${p}')">${i} <span>${l}</span></button>`).join('')}
    <button class="nav" onclick="backup()">💾 <span>Backup</span></button>
    <button class="nav bottom" onclick="changeAdminPassword()">🔒 <span>Minha senha</span></button>
  </aside>
  <main class="main-content"><div id="content"></div><div class="app-footer">Desenvolvido por <strong>ST Galassi</strong></div></main>
 </div>
 <nav class="mobile-nav">${items.map(([p,i,l]) => `<button data-page="${p}" onclick="go('${p}')"><i>${i}</i><span>${l}</span></button>`).join('')}<button onclick="adminMore()"><i>☰</i><span>Mais</span></button></nav>`;
}
function adminMore(){
  modal('Mais opções', `<div class="form-grid"><button class="secondary full" onclick="closeModal();backup()">💾 Baixar backup dos dados</button><button class="secondary full" onclick="closeModal();fleetReport()">📄 Emitir relatório da frota</button><button class="secondary full" onclick="changeAdminPassword()">🔒 Alterar minha senha</button><button class="danger-btn full" onclick="logout()">Sair do sistema</button></div>`);
}

function dashboard(){
  const alerts = sortV(s.vehicles.filter(v => vstate(v).key !== 'ok')).sort((a,b) => (a.next-a.km) - (b.next-b.km));
  const overdue = alerts.filter(v => vstate(v).key === 'overdue');
  $('content').innerHTML = `<div class="page-head"><div><div class="eyebrow">PAINEL ADMINISTRATIVO</div><h1>Controle de Viaturas</h1><p>Visão geral da frota do CPA-7</p></div><div class="head-actions"><button class="secondary" onclick="fleetReport()">📄 Relatório da frota</button><button class="primary" onclick="vehicleForm()">+ Nova viatura</button></div></div>
 <div class="stats">
  <button class="stat" onclick="go('units')"><span>Unidades</span><strong>${s.units.length}</strong></button>
  <button class="stat" onclick="ui.vehUnit='';ui.vehQuery='';go('vehicles')"><span>Viaturas</span><strong>${s.vehicles.length}</strong></button>
  <div class="stat alert-stat"><span>Alertas</span><strong>${alerts.length - overdue.length}</strong></div>
  <div class="stat danger-stat"><span>Vencidas</span><strong>${overdue.length}</strong></div>
 </div>
 <div class="section-title"><h2>Viaturas por unidade</h2><button class="secondary" onclick="go('units')">Gerenciar unidades</button></div>
 <div class="unit-grid">${s.units.map(u => {
   const vs = s.vehicles.filter(v => v.unit === u.name), ac = vs.filter(v => vstate(v).key !== 'ok').length;
   return `<article class="unit-card"><div><h3>${esc(u.name)}</h3><span>${vs.length} viatura(s)</span></div><b class="${ac ? 'unit-alert' : ''}">${ac ? `🚨 ${ac} alerta(s)` : '🟢 OK'}</b><button onclick="openUnitVehicles('${u.id}')">Ver viaturas →</button></article>`;
 }).join('') || '<div class="empty-card">Cadastre uma unidade para começar. <br><br><button class="primary" onclick="unitForm()">+ Nova unidade</button></div>'}</div>
 <div class="section-title"><h2>Alertas de troca de óleo</h2></div>
 <div class="alert-list">${alerts.map(vehicleMini).join('') || '<div class="empty-card">Nenhuma viatura em alerta.</div>'}</div>`;
}
function vehicleMini(v){
  const st = vstate(v);
  return `<div class="mini-card ${st.key === 'overdue' ? 'overdue' : ''}"><div class="mini-beacon ${st.key === 'overdue' ? 'red' : ''}"></div><div><b>${esc(v.prefix)}</b><span>${esc(v.unit)} · ${esc(v.model)}</span></div><strong>${st.label}</strong><button class="primary" onclick="oilForm('${v.id}')">Registrar troca</button></div>`;
}

async function crestDataUrl(){
  try {
    const img = document.querySelector('img.crest, img.login-crest, img') || Object.assign(new Image(), {src: CREST});
    if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/png');
  } catch(e) { return new URL(CREST, location.href).href; }
}
async function fleetReport(){
  const w = window.open('', '_blank');
  if (!w) { alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este site.'); return; }
  w.document.write('<p style="font-family:Arial;padding:30px">Gerando relatório...</p>');
  const now = new Date().toLocaleString('pt-BR');
  const crest = await crestDataUrl();
  const list = sortV(s.vehicles);
  const rows = list.map(v => {
    const st = vstate(v), txt = {ok:'OK', alert:'ALERTA', overdue:'VENCIDA'}[st.key];
    return `<tr><td>${esc(v.unit)}</td><td>${esc(v.prefix)}</td><td>${esc(v.plate)}</td><td>${esc(v.brand)} ${esc(v.model)}</td><td>${kmfmt(v.km)}</td><td>${kmfmt(v.next)}</td><td>${kmfmt(st.rem)}</td><td>${esc(fmtDate(v.oilDate))}</td><td class="${st.key}">${txt}</td></tr>`;
  }).join('');
  const nAlert = list.filter(v => vstate(v).key === 'alert').length, nOver = list.filter(v => vstate(v).key === 'overdue').length;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório da Frota — CPA-7</title>
 <style>
 body{font-family:Arial,sans-serif;color:#132b47;margin:35px}
 .head{display:flex;align-items:center;gap:18px;border-bottom:4px solid #0758a9;padding-bottom:15px}
 img{width:70px;height:80px;object-fit:contain}.title{font-size:22px;font-weight:800}.sub{color:#536b84}
 .summary{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}.box{border:1px solid #ccd9e7;border-radius:8px;padding:12px 18px;min-width:130px}.box b{display:block;font-size:22px}
 table{width:100%;border-collapse:collapse;margin-top:18px;font-size:11px}th{background:#0758a9;color:#fff;text-align:left}th,td{border:1px solid #cdd8e4;padding:7px}tr:nth-child(even){background:#f3f6f9}
 th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .ok{color:#08763a;font-weight:800}.alert{color:#b36b00;font-weight:800}.overdue{color:#c21f27;font-weight:800}
 .foot{margin-top:25px;font-size:10px;color:#68798c}.print{margin-top:20px;padding:10px 18px;background:#0758a9;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer}
 @media print{.print{display:none}body{margin:15mm}}
 </style></head><body>
 <div class="head"><img src="${crest}" alt=""><div><div class="title">POLÍCIA MILITAR — MATO GROSSO DO SUL</div><div class="title">CONTROLE DE VIATURAS — CPA-7</div><div class="sub">Relatório geral da frota</div></div></div>
 <div class="summary"><div class="box">Unidades<b>${s.units.length}</b></div><div class="box">Viaturas<b>${list.length}</b></div><div class="box">Alertas<b>${nAlert}</b></div><div class="box">Vencidas<b>${nOver}</b></div></div>
 <table><thead><tr><th>Unidade</th><th>Prefixo</th><th>Placa</th><th>Veículo</th><th>KM atual</th><th>Próxima troca</th><th>Restante</th><th>Última troca</th><th>Situação</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Nenhuma viatura cadastrada.</td></tr>'}</tbody></table>
 <div class="foot">Emitido em ${now} pelo sistema Controle de Viaturas CPA-7.</div>
 <button class="print" onclick="window.print()">Imprimir / Salvar PDF</button>
 <script>setTimeout(()=>window.print(),500)<\/script></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}

function units(){
  $('content').innerHTML = `<div class="page-head"><div><div class="eyebrow">ESTRUTURA</div><h1>Unidades</h1><p>Organização da frota do CPA-7</p></div><button class="primary" onclick="unitForm()">+ Nova unidade</button></div>
 <div class="cards-list">${s.units.map(u => `<div class="list-card"><div><b>${esc(u.name)}</b><span>${s.vehicles.filter(v => v.unit === u.name).length} viatura(s) · ${s.drivers.filter(d => d.unit === u.name).length} motorista(s)</span></div><div class="row-actions"><button class="secondary" onclick="openUnitVehicles('${u.id}')">Viaturas</button><button class="secondary" onclick="unitForm('${u.id}')">Renomear</button><button class="danger-btn" onclick="delUnit('${u.id}')">Excluir</button></div></div>`).join('') || '<div class="empty-card">Nenhuma unidade cadastrada.</div>'}</div>`;
}
function unitForm(id){
  const u = id ? findUnit(id) : null;
  modal(u ? 'Renomear unidade' : 'Nova unidade', `<form id="unitForm" class="form-grid"><label class="full">Nome da unidade<input name="name" placeholder="Ex.: 11º BPM" required maxlength="80" value="${esc(u?.name || '')}"></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar unidade</button></div></form>`);
  $('unitForm').onsubmit = e => {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name')).trim().replace(/\s+/g, ' ');
    if (!name) return formError(e.target, 'Informe o nome da unidade.');
    if (s.units.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return formError(e.target, 'Unidade já cadastrada.');
    closeModal();
    if (!u) { const nu = {id: uid(), name}; commit(st => { st.units.push(nu); }, 'Unidade cadastrada.'); return; }
    const old = u.name;
    commit(st => {
      const x = st.units.find(y => y.id === id); if (!x) return;
      x.name = name;
      st.vehicles.forEach(v => { if (v.unit === old) v.unit = name; });
      st.drivers.forEach(d => { if (d.unit === old) d.unit = name; });
    }, 'Unidade renomeada.');
    if (ui.vehUnit === old) ui.vehUnit = name;
  };
}
function delUnit(id){
  const u = findUnit(id); if (!u) return;
  if (s.vehicles.some(v => v.unit === u.name)) return alert('Não é possível excluir uma unidade que possui viaturas. Transfira ou exclua as viaturas primeiro.');
  if (s.drivers.some(d => d.unit === u.name)) return alert('Não é possível excluir uma unidade que possui motoristas cadastrados.');
  if (confirm(`Excluir a unidade "${u.name}"?`)) commit(st => { st.units = st.units.filter(x => x.id !== id); }, 'Unidade excluída.');
}

function vehicles(){
  if (ui.vehUnit && !s.units.some(u => u.name === ui.vehUnit)) ui.vehUnit = '';
  $('content').innerHTML = `<div class="page-head"><div><div class="eyebrow">FROTA</div><h1>Viaturas</h1><p>${ui.vehUnit ? `Unidade: ${esc(ui.vehUnit)}` : 'Todas as viaturas cadastradas'}</p></div><button class="primary" onclick="vehicleForm()">+ Nova viatura</button></div>
 <div class="toolbar"><input id="searchVehicle" type="search" placeholder="Pesquisar prefixo, placa, modelo ou unidade..." value="${esc(ui.vehQuery)}" oninput="ui.vehQuery=this.value;filterVehicles()"><select id="unitFilter" onchange="ui.vehUnit=this.value;vehicles()"><option value="">Todas as unidades</option>${s.units.map(u => `<option value="${esc(u.name)}" ${u.name === ui.vehUnit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
 <div id="vehicleList"></div>`;
  filterVehicles();
}
function filterVehicles(){
  const q = ui.vehQuery.trim().toLowerCase();
  const list = sortV(s.vehicles.filter(v => (!ui.vehUnit || v.unit === ui.vehUnit) && `${v.prefix} ${v.plate} ${v.brand} ${v.model} ${v.unit}`.toLowerCase().includes(q)));
  $('vehicleList').innerHTML = `<div class="list-count">${list.length} viatura(s)</div>` + vehicleCards(list);
}
function vehicleCards(arr){
  if (!arr.length) return '<div class="empty-card">Nenhuma viatura encontrada.</div>';
  return arr.map(v => {
    const st = vstate(v);
    return `<article class="vehicle-card vehicle-row ${st.key}">
   <div class="vehicle-main vehicle-main-row">
    <div class="vehicle-title vehicle-title-row"><div><h3>${esc(v.prefix)}</h3><span>${esc(v.brand)} ${esc(v.model)}${v.plate ? ' · ' + esc(v.plate) : ''}</span><small>${esc(v.unit)}</small></div></div>
    <div class="vehicle-metrics vehicle-metrics-row">
     <div><span><i class="metric-icon">◴</i> KM atual</span><strong>${kmfmt(v.km)}</strong></div>
     <div><span><i class="metric-icon">🔧</i> Próxima troca</span><strong>${kmfmt(v.next)}</strong></div>
     <div class="vehicle-status-box ${st.key}"><span><i class="status-dot ${st.key}"></i> Situação</span><strong class="${st.key}">${st.label}</strong></div>
    </div>
    <div class="vehicle-actions vehicle-actions-row">
     <button class="secondary" onclick="kmForm('${v.id}')"><span class="btn-icon">⟳</span> Atualizar KM</button>
     <button class="primary" onclick="oilForm('${v.id}')"><span class="btn-icon">💧</span> Troca de óleo</button>
     <button class="orange" onclick="maintForm('${v.id}')"><span class="btn-icon">⚙</span> Manutenção</button>
     <button class="edit-btn" onclick="vehicleForm('${v.id}')"><span class="btn-icon">✎</span> Editar</button>
    </div>
   </div>
  </article>`;
  }).join('');
}
function vehicleForm(editId){
  if (!s.units.length) { alert('Cadastre uma unidade primeiro.'); go('units'); return; }
  const v = editId ? findV(editId) : null;
  const intervals = [1000, 5000, 10000]; const cur = v?.interval || 5000;
  if (!intervals.includes(cur)) intervals.push(cur);
  const defUnit = v?.unit || ui.vehUnit;
  modal(v ? 'Editar viatura' : 'Cadastro de viatura', `<form id="vehicleForm" class="form-grid">
 <label>Unidade<select name="unit" required>${s.units.map(u => `<option value="${esc(u.name)}" ${defUnit === u.name ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
 <label>Prefixo<input name="prefix" required maxlength="30" value="${esc(v?.prefix || '')}"></label>
 <label>Placa<input name="plate" required maxlength="10" value="${esc(v?.plate || '')}" style="text-transform:uppercase"></label>
 <label>Marca<input name="brand" maxlength="40" value="${esc(v?.brand || '')}"></label>
 <label>Modelo<input name="model" required maxlength="50" value="${esc(v?.model || '')}"></label>
 <label>Ano<input name="year" type="number" min="1980" max="2100" value="${esc(v?.year || '')}"></label>
 <label>Cor<input name="color" maxlength="30" value="${esc(v?.color || '')}"></label>
 <label>KM atual<input name="km" type="number" inputmode="numeric" min="0" required value="${v?.km ?? ''}"></label>
 <label>KM da última troca de óleo<input name="last" type="number" inputmode="numeric" min="0" required value="${v?.last ?? ''}"></label>
 <label>Intervalo da troca de óleo<select name="interval">${intervals.map(i => `<option value="${i}" ${i === cur ? 'selected' : ''}>${kmfmt(i)} km</option>`).join('')}</select></label>
 <label>Data da última troca<input name="oilDate" type="date" max="${today()}" value="${esc(v?.oilDate || '')}"></label>
 <label class="full">Observações<textarea name="notes" rows="3">${esc(v?.notes || '')}</textarea></label>
 <div class="modal-actions full">${v ? `<button type="button" class="danger-btn push-left" onclick="delVehicle('${v.id}')">Excluir viatura</button>` : ''}<button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar viatura</button></div>
 </form>`);
  $('vehicleForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), km = Number(f.get('km')), last = Number(f.get('last')), interval = Number(f.get('interval'));
    const prefix = String(f.get('prefix')).trim(), plate = String(f.get('plate')).trim().toUpperCase();
    if (!prefix || !plate || !String(f.get('model')).trim()) return formError(e.target, 'Preencha prefixo, placa e modelo.');
    if (f.get('km') === '' || f.get('last') === '' || km < 0 || last < 0) return formError(e.target, 'Informe o KM atual e o KM da última troca.');
    if (km < last) return formError(e.target, 'O KM atual não pode ser menor que o KM da última troca.');
    if (s.vehicles.some(x => x.id !== editId && x.prefix.toLowerCase() === prefix.toLowerCase())) return formError(e.target, 'Já existe uma viatura com este prefixo.');
    if (s.vehicles.some(x => x.id !== editId && String(x.plate).toUpperCase() === plate)) return formError(e.target, 'Já existe uma viatura com esta placa.');
    const obj = {id: v?.id || uid(), unit: f.get('unit'), prefix, plate, brand: String(f.get('brand')).trim(), model: String(f.get('model')).trim(), year: f.get('year'), color: String(f.get('color')).trim(), km, interval, last, next: last + interval, oilDate: f.get('oilDate'), notes: String(f.get('notes')).trim()};
    closeModal();
    commit(st => {
      const x = st.vehicles.find(y => y.id === obj.id);
      if (x) Object.assign(x, obj); else st.vehicles.push(obj);
    }, v ? 'Viatura atualizada.' : 'Viatura cadastrada.');
  };
}
function delVehicle(id){
  const v = findV(id); if (!v) return;
  if (!confirm(`Excluir a viatura ${v.prefix}? O histórico de manutenções será mantido.`)) return;
  closeModal();
  commit(st => { st.vehicles = st.vehicles.filter(x => x.id !== id); }, 'Viatura excluída.');
}

/* Lançamentos (usados pelo administrador e pelo motorista) */
function author(){
  if (s.session?.role === 'admin') return {source: 'Administrador'};
  const d = me(); return {source: `Motorista: ${d?.name || ''}`, driverId: d?.id || ''};
}
function kmForm(id){
  const v = findV(id); if (!v) return;
  const admin = s.session?.role === 'admin';
  modal(`Atualizar KM — ${v.prefix}`, `<form id="kmForm" class="form-grid"><div class="full info-line">KM registrado: <b>${kmfmt(v.km)} km</b></div><label class="full">Novo KM do hodômetro<input name="km" type="number" inputmode="numeric" min="0" required value="${v.km}"></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="green" type="submit">Salvar KM</button></div></form>`);
  $('kmForm').onsubmit = e => {
    e.preventDefault();
    const raw = new FormData(e.target).get('km'), n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) return formError(e.target, 'Informe um KM válido.');
    if (n < v.km && !admin) return formError(e.target, `O KM não pode ser menor que o atual (${kmfmt(v.km)} km).`);
    if (n < v.km && !confirm(`O KM informado é menor que o registrado (${kmfmt(v.km)}). Corrigir mesmo assim?`)) return;
    if (n - v.km > 20000 && !confirm(`Aumento de ${kmfmt(n - v.km)} km. Confirma o valor?`)) return;
    closeModal();
    commit(st => { const x = st.vehicles.find(y => y.id === id); if (x) x.km = n; }, 'KM atualizado.');
  };
}
function oilForm(id){
  const v = findV(id); if (!v) return;
  modal(`Troca de óleo — ${v.prefix}`, `<form id="oilForm" class="form-grid"><div class="full info-line">Última troca: <b>${kmfmt(v.last)} km</b>${v.oilDate ? ' em ' + esc(fmtDate(v.oilDate)) : ''} · KM atual: <b>${kmfmt(v.km)} km</b></div>
  <label>KM da troca<input name="km" type="number" inputmode="numeric" min="0" required value="${v.km}"></label>
  <label>Data<input name="date" type="date" required max="${today()}" value="${today()}"></label>
  <label>Próxima troca em<select name="interval">${[1000,5000,10000].concat([1000,5000,10000].includes(v.interval) ? [] : [v.interval]).map(i => `<option value="${i}" ${i === v.interval ? 'selected' : ''}>${kmfmt(i)} km</option>`).join('')}</select></label>
  <label>Valor (R$)<input name="value" type="number" min="0" step="0.01" value=""></label>
  <label class="full">Observação<input name="desc" maxlength="200" placeholder="Opcional"></label>
  <div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Registrar troca</button></div></form>`);
  $('oilForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), raw = f.get('km'), n = Number(raw), interval = Number(f.get('interval'));
    if (raw === '' || !Number.isFinite(n) || n < 0) return formError(e.target, 'Informe o KM da troca.');
    if (n < v.last) return formError(e.target, `O KM da troca não pode ser menor que o da última troca (${kmfmt(v.last)} km).`);
    const rec = {id: uid(), date: f.get('date') || today(), vehicle: id, prefix: v.prefix, type: 'Troca de óleo', km: n, desc: String(f.get('desc')).trim(), value: Number(f.get('value')) || 0, ...author()};
    closeModal();
    commit(st => {
      const x = st.vehicles.find(y => y.id === id); if (!x) return;
      x.km = Math.max(x.km, n); x.last = n; x.interval = interval; x.next = n + interval; x.oilDate = rec.date;
      st.maintenance.push(rec);
    }, `Troca registrada. Próxima em ${kmfmt(n + interval)} km.`);
  };
}
function maintForm(id){
  const v = findV(id); if (!v) return;
  modal(`Manutenção — ${v.prefix}`, `<form id="maintForm" class="form-grid"><label>Data<input name="date" type="date" required max="${today()}" value="${today()}"></label><label>KM<input name="km" type="number" inputmode="numeric" min="0" required value="${v.km}"></label><label>Tipo<select name="type">${MAINT_TYPES.map(t => `<option>${t}</option>`).join('')}</select></label><label>Valor (R$)<input name="value" type="number" min="0" step="0.01" value=""></label><label class="full">Descrição<textarea name="desc" rows="4" required maxlength="500"></textarea></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="orange" type="submit">Registrar manutenção</button></div></form>`);
  $('maintForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), km = Number(f.get('km')), desc = String(f.get('desc')).trim();
    if (f.get('km') === '' || !Number.isFinite(km) || km < 0) return formError(e.target, 'Informe o KM.');
    if (!desc) return formError(e.target, 'Descreva o serviço realizado.');
    const rec = {id: uid(), date: f.get('date') || today(), vehicle: id, prefix: v.prefix, type: f.get('type'), km, desc, value: Number(f.get('value')) || 0, ...author()};
    closeModal();
    commit(st => {
      const x = st.vehicles.find(y => y.id === id); if (x) x.km = Math.max(x.km, km);
      st.maintenance.push(rec);
    }, 'Manutenção registrada.');
  };
}

function drivers(){
  const list = s.drivers.slice().sort((a,b) => String(a.name).localeCompare(String(b.name),'pt-BR'));
  $('content').innerHTML = `<div class="page-head"><div><div class="eyebrow">ACESSOS</div><h1>Motoristas</h1><p>Cadastre e controle os acessos dos motoristas</p></div><button class="primary" onclick="driverForm()">+ Novo motorista</button></div>
 <div class="cards-list">${list.map(d => `<div class="list-card driver-row"><div class="driver-info"><div class="avatar">👤</div><div><b>${esc(d.name)}</b><span>${d.matricula ? 'Mat. ' + esc(d.matricula) + ' · ' : ''}${esc(d.email)} · ${esc(d.unit)}</span></div></div><div class="driver-actions-row"><span class="pill ${d.active === false ? 'off' : ''}">${d.active === false ? 'Inativo' : 'Ativo'}</span><button class="secondary" onclick="driverForm('${d.id}')">Editar</button><button class="danger-btn" onclick="delDriver('${d.id}')">Excluir</button></div></div>`).join('') || '<div class="empty-card">Nenhum motorista cadastrado.</div>'}</div>`;
}
function driverForm(id){
  if (!s.units.length) { alert('Cadastre uma unidade primeiro.'); go('units'); return; }
  const d = id ? s.drivers.find(x => x.id === id) : null;
  modal(d ? 'Editar motorista' : 'Novo motorista', `<form id="driverForm" class="form-grid"><label>Nome completo<input name="name" required maxlength="80" value="${esc(d?.name || '')}"></label><label>Matrícula<input name="matricula" maxlength="20" value="${esc(d?.matricula || '')}"></label><label>E-mail<input name="email" type="email" required value="${esc(d?.email || '')}" ${d ? 'disabled' : ''}></label><label>Unidade<select name="unit" required>${s.units.map(u => `<option value="${esc(u.name)}" ${d?.unit === u.name ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>${d ? '' : '<label>Senha inicial<input name="password" type="text" minlength="6" value="000000" required></label>'}<label>Status<select name="active"><option value="true" ${d?.active !== false ? 'selected' : ''}>Ativo</option><option value="false" ${d?.active === false ? 'selected' : ''}>Inativo</option></select></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar motorista</button></div></form>`);
  $('driverForm').onsubmit = async e => {
    e.preventDefault();
    const form = e.target, f = new FormData(form), name = String(f.get('name')).trim();
    const email = (d?.email || String(f.get('email') || '')).trim().toLowerCase();
    if (!name) return formError(form, 'Informe o nome.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return formError(form, 'Informe um e-mail válido.');
    if (email === ADMIN_EMAIL) return formError(form, 'Este e-mail é do administrador.');
    if (s.drivers.some(x => x.email?.toLowerCase() === email && x.id !== id)) return formError(form, 'Este e-mail já está cadastrado.');
    const data = {name, matricula: String(f.get('matricula')).trim(), unit: f.get('unit'), active: f.get('active') === 'true'};
    if (d) { closeModal(); commit(st => { const x = st.drivers.find(y => y.id === id); if (x) Object.assign(x, data); }, 'Motorista atualizado.'); return; }
    const pass = String(f.get('password') || '');
    if (pass.length < 6) return formError(form, 'A senha inicial precisa ter pelo menos 6 caracteres.');
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Cadastrando...';
    try {
      if (!secondaryApp) secondaryApp = firebase.initializeApp(FIREBASE_CONFIG, 'secondary');
      const sec = secondaryApp.auth();
      const cred = await sec.createUserWithEmailAndPassword(email, pass);
      await sec.signOut();
      const nd = {id: uid(), uid: cred.user.uid, email, ...data};
      closeModal();
      await commit(st => { st.drivers.push(nd); });
      alert(`Motorista cadastrado.\nE-mail: ${email}\nSenha inicial: ${pass}`);
    } catch(err) {
      console.error(err);
      btn.disabled = false; btn.textContent = 'Salvar motorista';
      const m = {'auth/email-already-in-use':'Este e-mail já possui uma conta. Peça ao motorista para usar "Esqueci minha senha" depois de cadastrado com outro e-mail, ou use outro e-mail.','auth/invalid-email':'E-mail inválido.','auth/weak-password':'Senha muito fraca (mínimo 6 caracteres).','auth/network-request-failed':'Sem conexão com a internet.'}[err.code] || 'Não foi possível cadastrar o motorista.';
      formError(form, m);
    }
  };
}
function delDriver(id){
  const d = s.drivers.find(x => x.id === id); if (!d) return;
  if (confirm(`Excluir o motorista ${d.name}? Ele perderá o acesso ao sistema.`)) commit(st => { st.drivers = st.drivers.filter(x => x.id !== id); }, 'Motorista excluído.');
}

function maintRow(m, canDelete){
  const v = findV(m.vehicle);
  const value = m.value ? money(m.value) : '—';
  return `<div class="list-card maint-row"><div><b>${esc(v?.prefix || m.prefix || 'Viatura removida')} · ${esc(m.type)}</b><span>${esc(fmtDate(m.date))} · KM ${kmfmt(m.km)}${v ? ' · ' + esc(v.unit) : ''}</span>${m.desc ? `<span>${esc(m.desc)}</span>` : ''}<small>${esc(m.source || '')}</small></div><div class="maint-side"><strong>${value}</strong>${canDelete ? `<button class="danger-btn small" onclick="delMaint('${m.id}')">Excluir</button>` : ''}</div></div>`;
}
function maint(){
  if (ui.maintVehicle && !findV(ui.maintVehicle)) ui.maintVehicle = '';
  $('content').innerHTML = `<div class="page-head"><div><div class="eyebrow">HISTÓRICO</div><h1>Manutenções</h1><p>Registros de óleo e serviços da frota</p></div></div>
 <div class="toolbar"><input type="search" placeholder="Pesquisar tipo, descrição ou responsável..." value="${esc(ui.maintQuery)}" oninput="ui.maintQuery=this.value;maintList()"><select onchange="ui.maintVehicle=this.value;maint()"><option value="">Todas as viaturas</option>${sortV(s.vehicles).map(v => `<option value="${v.id}" ${v.id === ui.maintVehicle ? 'selected' : ''}>${esc(v.prefix)} — ${esc(v.unit)}</option>`).join('')}</select></div>
 <div id="maintList"></div>`;
  maintList();
}
function maintList(){
  const q = ui.maintQuery.trim().toLowerCase();
  const list = s.maintenance.slice().reverse().filter(m => (!ui.maintVehicle || m.vehicle === ui.maintVehicle) && `${m.type} ${m.desc} ${m.source} ${findV(m.vehicle)?.prefix || m.prefix || ''}`.toLowerCase().includes(q));
  const total = list.reduce((a, m) => a + (Number(m.value) || 0), 0);
  $('maintList').innerHTML = `<div class="list-count">${list.length} registro(s) · Total: <b>${money(total)}</b></div><div class="cards-list">${list.map(m => maintRow(m, true)).join('') || '<div class="empty-card">Nenhuma manutenção registrada.</div>'}</div>`;
}
function delMaint(id){
  if (confirm('Excluir este registro do histórico?')) commit(st => { st.maintenance = st.maintenance.filter(x => x.id !== id); }, 'Registro excluído.');
}
function backup(){
  const data = {app: 'Controle de Viaturas CPA-7', exportedAt: new Date().toISOString(), ...normalize(s)};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `backup_cpa7_${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup baixado.');
}
function passwordModal(email){
  modal('Alterar minha senha', `<form id="passwordForm" class="form-grid"><label class="full">Senha atual<input name="old" type="password" autocomplete="current-password" required></label><label>Nova senha<input name="new" type="password" autocomplete="new-password" minlength="6" required></label><label>Confirmar nova senha<input name="confirm" type="password" autocomplete="new-password" minlength="6" required></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Alterar senha</button></div></form>`);
  $('passwordForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), np = String(f.get('new'));
    if (np.length < 6) return formError(e.target, 'A nova senha precisa ter pelo menos 6 caracteres.');
    if (np !== f.get('confirm')) return formError(e.target, 'As novas senhas não coincidem.');
    try {
      const user = auth.currentUser;
      await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(email, f.get('old')));
      await user.updatePassword(np);
      closeModal(); toast('Senha alterada com sucesso.');
    } catch(err) { console.error(err); formError(e.target, err.code === 'auth/network-request-failed' ? 'Sem conexão com a internet.' : 'Senha atual incorreta ou não foi possível alterar.'); }
  };
}
function changeAdminPassword(){ passwordModal(ADMIN_EMAIL); }

/* ---------- Motorista ---------- */
function driverShell(){
  const d = me();
  document.body.className = 'driver-body';
  $('app').innerHTML = `${shellHeader('CPA-7','Área do Motorista')}
 <main class="driver-layout">
  <aside class="driver-side">
   <img src="${CREST}" class="driver-crest" alt="">
   <div class="driver-user"><b id="driverName">${esc(d?.name)}</b><span id="driverUnit">${esc(d?.unit)}</span></div>
   <div class="driver-menu">
    <button class="driver-menu-btn" data-page="driverHome" onclick="go('driverHome')">🚓 Viaturas</button>
    <button class="driver-menu-btn" data-page="driverHistory" onclick="go('driverHistory')">📋 Histórico</button>
    <button class="driver-menu-btn" onclick="editDriverProfile()">👤 Meu cadastro</button>
    <button class="driver-menu-btn" onclick="changeDriverPassword()">🔒 Minha senha</button>
   </div>
  </aside>
  <section class="driver-content" id="driverContent"></section>
 </main>
 <nav class="mobile-nav"><button data-page="driverHome" onclick="go('driverHome')"><i>🚓</i><span>Viaturas</span></button><button data-page="driverHistory" onclick="go('driverHistory')"><i>📋</i><span>Histórico</span></button><button onclick="editDriverProfile()"><i>👤</i><span>Cadastro</span></button><button onclick="changeDriverPassword()"><i>🔒</i><span>Senha</span></button></nav>`;
}
function driverHome(){
  const d = me(); if (!d) { logout(); return false; }
  if ($('driverName')) { $('driverName').textContent = d.name; $('driverUnit').textContent = d.unit; }
  let selected = s.session.selectedVehicleId;
  if (selected && !findV(selected)) selected = s.session.selectedVehicleId = '';
  const v = findV(selected);
  const own = sortV(s.vehicles.filter(x => x.unit === d.unit)), others = sortV(s.vehicles.filter(x => x.unit !== d.unit));
  const opt = x => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(x.prefix)} — ${esc(x.plate)}${x.unit !== d.unit ? ' — ' + esc(x.unit) : ''}</option>`;
  $('driverContent').innerHTML = `<div class="driver-page-head"><div><div class="eyebrow">ÁREA DO MOTORISTA</div><h1>Selecione a viatura</h1><p>Escolha a viatura para registrar KM, óleo ou manutenção.</p></div></div>
   <div class="selector-card"><label for="driverVehicleSelect">Viatura</label><div class="select-wrap"><span>🚓</span><select id="driverVehicleSelect" onchange="driverSelect(this.value)"><option value="">Escolha uma viatura...</option>${own.length ? `<optgroup label="${esc(d.unit)}">${own.map(opt).join('')}</optgroup>` : ''}${others.length ? `<optgroup label="Outras unidades">${others.map(opt).join('')}</optgroup>` : ''}</select></div></div>
   ${v ? driverVehicle(v) : `<div class="empty-driver"><img src="${CREST}" alt=""><h2>Nenhuma viatura selecionada</h2><p>Use a lista acima para escolher uma viatura.</p></div>`}`;
  return true;
}
function driverSelect(id){ s.session.selectedVehicleId = id; saveLocal(); driverHome(); }
function driverVehicle(v){
  const st = vstate(v);
  const msg = {ok: '🟢 VIATURA EM SITUAÇÃO NORMAL — próxima troca em ' + kmfmt(st.rem) + ' km', alert: `🚨 TROCA DE ÓLEO PRÓXIMA — FALTAM ${kmfmt(st.rem)} km`, overdue: `🔴 TROCA DE ÓLEO VENCIDA HÁ ${kmfmt(-st.rem)} km — comunique o responsável`}[st.key];
  return `<div class="driver-status ${st.key}">${msg}</div>
  <div class="selected-driver-grid">
  <div class="driver-vehicle-card"><img src="${CREST}" alt=""><div><span>VIATURA SELECIONADA</span><h2>${esc(v.prefix)}</h2><p>${esc(v.unit)} · ${esc(v.brand)} ${esc(v.model)} · ${esc(v.plate)}</p></div></div>
  <div class="action-card km-card"><div class="action-icon">◉</div><h3>Atualizar KM</h3><span>KM atual</span><strong>${kmfmt(v.km)} km</strong><button class="green" onclick="kmForm('${v.id}')">Registrar KM</button></div>
  <div class="action-card oil-card"><div class="action-icon">🛢</div><h3>Troca de óleo</h3><span>Próxima troca</span><strong>${kmfmt(v.next)} km</strong><button class="blue" onclick="oilForm('${v.id}')">Registrar troca</button></div>
  <div class="action-card maint-card"><div class="action-icon">🔧</div><h3>Manutenção</h3><span>Última troca de óleo</span><strong>${v.oilDate ? esc(fmtDate(v.oilDate)) : kmfmt(v.last) + ' km'}</strong><button class="orange" onclick="maintForm('${v.id}')">Registrar manutenção</button></div>
 </div>`;
}
function driverHistory(){
  const d = me(); if (!d) { logout(); return false; }
  const list = s.maintenance.slice().reverse().filter(m => !ui.histMine || m.driverId === d.id || m.source === `Motorista: ${d.name}`);
  $('driverContent').innerHTML = `<div class="driver-page-head"><div><div class="eyebrow">ÁREA DO MOTORISTA</div><h1>Histórico</h1><p>Trocas de óleo e manutenções registradas.</p></div></div>
 <div class="toolbar"><select onchange="ui.histMine=this.value==='1';driverHistory()"><option value="0">Todos os lançamentos</option><option value="1" ${ui.histMine ? 'selected' : ''}>Somente os meus</option></select></div>
 <div class="cards-list history-panel">${list.map(m => maintRow(m, false)).join('') || '<div class="empty-card">Nenhum lançamento registrado.</div>'}</div>`;
  return true;
}
function editDriverProfile(){
  const d = me(); if (!d) return;
  modal('Meu cadastro', `<form id="profileForm" class="form-grid"><label>Nome completo<input name="name" required maxlength="80" value="${esc(d.name)}"></label><label>Matrícula<input name="matricula" maxlength="20" value="${esc(d.matricula || '')}"></label><label>E-mail<input type="email" value="${esc(d.email)}" disabled></label><label>Unidade<input value="${esc(d.unit)}" disabled></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar cadastro</button></div></form>`);
  $('profileForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), name = String(f.get('name')).trim(), matricula = String(f.get('matricula')).trim();
    if (!name) return formError(e.target, 'Informe o nome.');
    closeModal();
    commit(st => { const x = st.drivers.find(y => y.id === d.id); if (x) { x.name = name; x.matricula = matricula; } }, 'Cadastro atualizado.');
  };
}
function changeDriverPassword(){ const d = me(); if (d) passwordModal(d.email); }
/* ---------- Integração TCard ---------- */
async function tcardWorkerRequest(path, method = 'GET') {
  if (!firebaseReady || !auth?.currentUser) {
    throw new Error('Entre no aplicativo com a conta administradora.');
  }

  const email = String(auth.currentUser.email || '').toLowerCase();

  if (email !== ADMIN_EMAIL) {
    throw new Error('A integração TCard está disponível somente para o administrador.');
  }

  const idToken = await auth.currentUser.getIdToken();

  const response = await fetch(`${TCARD_WORKER_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
    },
    ...(method === 'POST' ? { body: '{}' } : {})
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Erro na integração (HTTP ${response.status}).`);
  }

  return data;
}

function tcardIntegrationPage() {
  $('content').innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">INTEGRAÇÕES</div>
        <h1>TCard Brasil</h1>
        <p>Consulta e atualização da quilometragem das viaturas.</p>
      </div>
    </div>

    <div class="empty-card" style="text-align:left;max-width:900px">
      <p><b>Regras de segurança</b></p>
      <ul>
        <li>Correspondência somente pela placa.</li>
        <li>Nenhuma viatura será cadastrada automaticamente.</li>
        <li>A quilometragem só será atualizada se o valor do TCard não for inferior ao atual.</li>
        <li>Valores inferiores serão tratados como divergências.</li>
        <li>Os demais dados da viatura serão preservados.</li>
      </ul>

      <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="secondary" id="tcardStatusBtn" type="button">
          Verificar status
        </button>
        <button class="primary" id="tcardSyncBtn" type="button">
          Sincronizar agora
        </button>
      </div>

      <pre id="tcardResult" style="white-space:pre-wrap;margin-top:16px"
        aria-live="polite">Clique em “Verificar status” para consultar a integração.</pre>
    </div>
  `;

  $('tcardStatusBtn').onclick = async () => {
    const out = $('tcardResult');
    out.textContent = 'Consultando status...';
    $('tcardStatusBtn').disabled = true;

    try {
      const data = await tcardWorkerRequest('/status');
      out.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      out.textContent = `Falha: ${e.message}`;
    } finally {
      $('tcardStatusBtn').disabled = false;
    }
  };

  $('tcardSyncBtn').onclick = async () => {
    if (!confirm(
      'Executar a sincronização TCard → Firestore agora? ' +
      'A quilometragem será atualizada conforme as regras de segurança.'
    )) return;

    const out = $('tcardResult');
    out.textContent = 'Sincronização em andamento...';
    $('tcardSyncBtn').disabled = true;

    try {
      const data = await tcardWorkerRequest('/sync-now', 'POST');
      out.textContent = JSON.stringify(data, null, 2);
      toast('Solicitação de sincronização concluída.');
    } catch (e) {
      out.textContent = `Falha: ${e.message}`;
    } finally {
      $('tcardSyncBtn').disabled = false;
    }
  };
}
/* ---------- Início ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
