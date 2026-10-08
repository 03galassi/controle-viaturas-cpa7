
const KEY='cpa7_offline_v5';
const defaults={
  adminEmail:'03galassi@gmail.com',
  adminPassword:'725120',
  units:[],
  vehicles:[],
  maintenance:[],
  drivers:[],
  session:null
};
let s=JSON.parse(localStorage.getItem(KEY)||'null')||structuredClone(defaults);
s.units ||= []; s.vehicles ||= []; s.maintenance ||= []; s.drivers ||= []; s.session ??= null;
save();

const $ = id => document.getElementById(id);
const esc = x => String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function save(){localStorage.setItem(KEY,JSON.stringify(s));}
function money(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function kmfmt(n){return Number(n||0).toLocaleString('pt-BR');}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function alertCount(){return s.vehicles.filter(v=>(v.next-v.km)<1000).length;}

function shellHeader(title, subtitle=''){
  return `<header class="topbar">
    <div class="brand-wrap">
      <img src="assets/brasao_pmms.png" class="crest" alt="Brasão PMMS">
      <div><div class="brand-small">POLÍCIA MILITAR</div><div class="brand-state">MATO GROSSO DO SUL</div><div class="brand-title">${esc(title)}</div>${subtitle?`<div class="brand-sub">${esc(subtitle)}</div>`:''}</div>
    </div>
    <div class="top-actions"><span class="system-label">CONTROLE DE VIATURAS</span><button class="top-exit" onclick="logout()">Sair</button></div>
  </header>`;
}

function login(){
 document.body.className='login-body';
 $('app').innerHTML=`<main class="login-screen">
  <div class="login-hero">
    <img src="assets/brasao_pmms.png" class="login-crest">
    <div><div class="login-brand">POLÍCIA MILITAR</div><div class="login-state">MATO GROSSO DO SUL</div><div class="login-cpa">CPA-7</div><div class="login-cpa-sub">COMANDO DE POLICIAMENTO DA FRONTEIRA BIOCEÂNICA</div></div>
  </div>
  <section class="login-card">
    <h1>Controle de Viaturas</h1>
    <p>Acesso ao sistema</p>
    <label>E-mail<input id="email" type="email" autocomplete="username"></label>
    <label>Senha<input id="pass" type="password" autocomplete="current-password"></label>
    <button class="primary wide" onclick="doLogin()">ENTRAR</button>
    <button class="text-button" onclick="resetPassword()">Esqueci minha senha</button>
    <div id="msg"></div>
    <div class="developer-credit">Desenvolvido por <strong>ST Galassi</strong></div>
  </section>
 </main><div class="app-footer driver-footer">Desenvolvido por <strong>ST Galassi</strong></div>`;
}
function doLogin(){
 const e=$('email').value.trim().toLowerCase(), p=$('pass').value;
 if(e===s.adminEmail.toLowerCase() && p===s.adminPassword){s.session={role:'admin'};save();renderAdmin();return;}
 const d=s.drivers.find(x=>x.email.toLowerCase()===e && x.password===p && x.active!==false);
 if(d){s.session={role:'driver',driverId:d.id,selectedVehicleId:s.session?.selectedVehicleId||''};save();renderDriver();return;}
 $('msg').innerHTML='<div class="error">E-mail ou senha incorretos.</div>';
}
function resetPassword(){
 const e=prompt('Digite o e-mail cadastrado:');
 if(!e)return;
 if(e.trim().toLowerCase()===s.adminEmail.toLowerCase()){alert('Nesta versão offline, a recuperação por e-mail será habilitada quando o sistema for conectado à internet.');return;}
 const d=s.drivers.find(x=>x.email.toLowerCase()===e.trim().toLowerCase());
 alert(d?'Nesta versão offline, a recuperação por e-mail será habilitada quando o sistema for conectado à internet.':'E-mail não encontrado.');
}
function logout(){s.session=null;save();login();}

function renderAdmin(){
 document.body.className='';
 const alerts=alertCount();
 $('app').innerHTML=`${shellHeader('CPA-7','Comando de Policiamento da Fronteira Bioceânica')}
 <div class="admin-layout">
  <aside class="sidebar">
    <div class="profile"><img src="assets/brasao_pmms.png"><div><b>ADMINISTRADOR</b><span>CPA-7</span></div></div>
    <button class="nav active" onclick="dashboard()">⌂ <span>Painel</span></button>
    <button class="nav" onclick="units()">🏢 <span>Unidades</span></button>
    <button class="nav" onclick="vehicles()">🚓 <span>Viaturas</span></button>
    <button class="nav" onclick="drivers()">👨‍✈️ <span>Motoristas</span></button>
    <button class="nav" onclick="maint()">🔧 <span>Manutenções</span></button>
    <button class="nav" onclick="backup()">💾 <span>Backup</span></button>
    <button class="nav bottom" onclick="changeAdminPassword()">🔒 <span>Minha senha</span></button>
  </aside>
  <main class="main-content"><div id="content"></div></main>
 </div>`;
 dashboard();
}
function setActiveNav(label){
 document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active'));
 [...document.querySelectorAll('.nav')].find(b=>b.innerText.includes(label))?.classList.add('active');
}
function dashboard(){
 setActiveNav('Painel');
 const alerts=s.vehicles.filter(v=>(v.next-v.km)<1000);
 const overdue=s.vehicles.filter(v=>(v.next-v.km)<0);
 $('content').innerHTML=`<div class="page-head"><div><div class="eyebrow">PAINEL ADMINISTRATIVO</div><h1>Controle de Viaturas</h1><p>Visão geral da frota do CPA-7</p></div><div class="head-actions"><button class="secondary" onclick="fleetReport()">📄 Emitir relatório da frota</button><button class="primary" onclick="newVehicle()">+ Nova viatura</button></div></div>
 <div class="stats">
  <div class="stat"><span>Unidades</span><strong>${s.units.length}</strong></div>
  <div class="stat"><span>Viaturas</span><strong>${s.vehicles.length}</strong></div>
  <div class="stat alert-stat"><span>Alertas</span><strong>${alerts.length}</strong></div>
  <div class="stat danger-stat"><span>Vencidas</span><strong>${overdue.length}</strong></div>
 </div>
 <div class="section-title"><h2>Viaturas por unidade</h2><button class="secondary" onclick="units()">Gerenciar unidades</button></div>
 <div class="unit-grid">${s.units.map(u=>{let vs=s.vehicles.filter(v=>v.unit===u.name);let ac=vs.filter(v=>v.next-v.km<1000).length;return `<article class="unit-card"><div><h3>${esc(u.name)}</h3><span>${vs.length} viatura(s)</span></div><b class="${ac?'unit-alert':''}">${ac?`🚨 ${ac} alerta(s)`:'🟢 OK'}</b><button onclick="vehicles('${encodeURIComponent(u.name)}')">Ver viaturas →</button></article>`}).join('')||'<div class="empty-card">Cadastre uma unidade para começar.</div>'}</div>
 <div class="section-title"><h2>Alertas de troca de óleo</h2></div>
 <div class="alert-list">${alerts.map(v=>vehicleMini(v)).join('')||'<div class="empty-card">Nenhuma viatura em alerta.</div>'}</div>`;
}
function vehicleMini(v){
 const rem=v.next-v.km;
 return `<div class="mini-card ${rem<0?'overdue':''}"><div class="mini-beacon ${rem<0?'red':''}"></div><div><b>${esc(v.prefix)}</b><span>${esc(v.unit)} · ${esc(v.model)}</span></div><strong>${rem<0?`VENCIDA ${kmfmt(Math.abs(rem))} km`:`FALTAM ${kmfmt(rem)} km`}</strong></div>`;
}


function fleetReport(){
 const now=new Date().toLocaleString('pt-BR');
 const rows=s.vehicles.map(v=>{
   const rem=v.next-v.km;
   const status=rem<0?'VENCIDA':rem<1000?'ALERTA':'OK';
   return `<tr><td>${esc(v.unit)}</td><td>${esc(v.prefix)}</td><td>${esc(v.plate)}</td><td>${esc(v.brand)} ${esc(v.model)}</td><td>${kmfmt(v.km)}</td><td>${kmfmt(v.next)}</td><td>${kmfmt(rem)}</td><td class="${status.toLowerCase()}">${status}</td></tr>`;
 }).join('');
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório da Frota — CPA-7</title>
 <style>
 body{font-family:Arial,sans-serif;color:#132b47;margin:35px}
 .head{display:flex;align-items:center;gap:18px;border-bottom:4px solid #0758a9;padding-bottom:15px}
 img{width:70px;height:80px;object-fit:contain}.title{font-size:24px;font-weight:800}.sub{color:#536b84}
 .summary{display:flex;gap:12px;margin:20px 0}.box{border:1px solid #ccd9e7;border-radius:8px;padding:12px 18px;min-width:130px}.box b{display:block;font-size:22px}
 table{width:100%;border-collapse:collapse;margin-top:18px;font-size:11px}th{background:#0758a9;color:#fff;text-align:left}th,td{border:1px solid #cdd8e4;padding:7px}tr:nth-child(even){background:#f3f6f9}
 .ok{color:#08763a;font-weight:800}.alert{color:#b36b00;font-weight:800}.vencida{color:#c21f27;font-weight:800}
 .foot{margin-top:25px;font-size:10px;color:#68798c}
 @media print{button{display:none}}
 </style></head><body>
 <div class="head"><img src="assets/brasao_pmms.png"><div><div class="title">POLÍCIA MILITAR — MATO GROSSO DO SUL</div><div class="title">CONTROLE DE VIATURAS — CPA-7</div><div class="sub">Relatório geral da frota</div></div></div>
 <div class="summary"><div class="box">Unidades<b>${s.units.length}</b></div><div class="box">Viaturas<b>${s.vehicles.length}</b></div><div class="box">Alertas<b>${s.vehicles.filter(v=>v.next-v.km<1000).length}</b></div><div class="box">Vencidas<b>${s.vehicles.filter(v=>v.next-v.km<0).length}</b></div></div>
 <table><thead><tr><th>Unidade</th><th>Prefixo</th><th>Placa</th><th>Veículo</th><th>KM atual</th><th>Próxima troca</th><th>Restante</th><th>Situação</th></tr></thead><tbody>${rows||'<tr><td colspan="8">Nenhuma viatura cadastrada.</td></tr>'}</tbody></table>
 <div class="foot">Emitido em ${now} pelo sistema Controle de Viaturas CPA-7.</div>
 <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
 const w=window.open('','_blank');
 if(!w){alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este site.');return;}
 w.document.write(html);w.document.close();
}

function units(){
 setActiveNav('Unidades');
 $('content').innerHTML=`<div class="page-head"><div><div class="eyebrow">ESTRUTURA</div><h1>Unidades</h1><p>Organização da frota do CPA-7</p></div><button class="primary" onclick="newUnit()">+ Nova unidade</button></div>
 <div class="cards-list">${s.units.map((u,i)=>`<div class="list-card"><div><b>${esc(u.name)}</b><span>${s.vehicles.filter(v=>v.unit===u.name).length} viatura(s)</span></div><div><button class="secondary" onclick="vehicles('${encodeURIComponent(u.name)}')">Viaturas</button><button class="danger-btn" onclick="delUnit(${i})">Excluir</button></div></div>`).join('')||'<div class="empty-card">Nenhuma unidade cadastrada.</div>'}</div>`;
}
function newUnit(){
 const m=modal('Nova unidade',`<form id="unitForm" class="form-grid"><label class="full">Nome da unidade<input name="name" placeholder="Ex.: 11º BPM" required></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar unidade</button></div></form>`);
 $('unitForm').onsubmit=e=>{e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name)return;if(s.units.some(u=>u.name.toLowerCase()===name.toLowerCase()))return alert('Unidade já cadastrada.');s.units.push({id:uid(),name});save();closeModal();units();};
}
function delUnit(i){const u=s.units[i];if(s.vehicles.some(v=>v.unit===u.name))return alert('Não é possível excluir uma unidade que possui viaturas.');if(confirm('Excluir esta unidade?')){s.units.splice(i,1);save();units();}}

function vehicles(encodedUnit=''){
 setActiveNav('Viaturas');
 const unit=encodedUnit?decodeURIComponent(encodedUnit):'';
 $('content').innerHTML=`<div class="page-head"><div><div class="eyebrow">FROTA</div><h1>Viaturas</h1><p>${unit?`Unidade: ${esc(unit)}`:'Todas as viaturas cadastradas'}</p></div><button class="primary" onclick="newVehicle()">+ Nova viatura</button></div>
 <div class="toolbar"><input id="searchVehicle" placeholder="Pesquisar prefixo, placa, modelo ou unidade..." oninput="filterVehicles('${encodeURIComponent(unit)}')"><select id="unitFilter" onchange="filterVehicles('${encodeURIComponent(unit)}')"><option value="">Todas as unidades</option>${s.units.map(u=>`<option ${u.name===unit?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div>
 <div id="vehicleList">${vehicleCards(s.vehicles.filter(v=>!unit||v.unit===unit))}</div>`;
}
function filterVehicles(encodedUnit=''){
 const base=encodedUnit?decodeURIComponent(encodedUnit):'';
 const q=($('searchVehicle')?.value||'').toLowerCase();
 const uf=$('unitFilter')?.value||base;
 $('vehicleList').innerHTML=vehicleCards(s.vehicles.filter(v=>(!uf||v.unit===uf)&&(`${v.prefix} ${v.plate} ${v.model} ${v.unit}`).toLowerCase().includes(q)));
}
function vehicleCards(arr){
 if(!arr.length)return '<div class="empty-card">Nenhuma viatura encontrada.</div>';
 return arr.map(v=>{
  const rem=v.next-v.km, state=rem<0?'overdue':rem<1000?'alert':'ok';
  return `<article class="vehicle-card ${state}">
   ${rem<1000?`<div class="big-beacon ${rem<0?'red':''}"><i></i><span>ALERTA</span></div>`:''}
   <div class="vehicle-main"><div class="vehicle-title"><div><h3>${esc(v.prefix)}</h3><span>${esc(v.plate)} · ${esc(v.brand)} ${esc(v.model)}</span></div><b>${esc(v.unit)}</b></div>
   <div class="vehicle-metrics"><div><span>KM atual</span><strong>${kmfmt(v.km)}</strong></div><div><span>Próxima troca</span><strong>${kmfmt(v.next)}</strong></div><div><span>Intervalo</span><strong>${kmfmt(v.interval)} km</strong></div><div><span>Situação</span><strong class="${state}">${state==='ok'?'OK':state==='alert'?(rem<0?'VENCIDA':`FALTAM ${kmfmt(rem)} km`):`VENCIDA ${kmfmt(Math.abs(rem))} km`}</strong></div></div>
   <div class="vehicle-actions"><button class="secondary" onclick="kmAdmin('${v.id}')">Atualizar KM</button><button class="primary" onclick="oilAdmin('${v.id}')">Troca de óleo</button><button class="orange" onclick="maintenanceAdmin('${v.id}')">Manutenção</button><button class="danger-btn" onclick="editVehicle('${v.id}')">Editar</button></div>
   </div></article>`;
 }).join('');
}
function newVehicle(editId=null){
 if(!s.units.length)return alert('Cadastre uma unidade primeiro.');
 const v=editId?s.vehicles.find(x=>x.id===editId):null;
 const m=modal(v?'Editar viatura':'Cadastro de Viatura',`<form id="vehicleForm" class="form-grid">
 <label>Unidade<select name="unit" required>${s.units.map(u=>`<option ${v?.unit===u.name?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
 <label>Prefixo<input name="prefix" required value="${esc(v?.prefix||'')}"></label>
 <label>Placa<input name="plate" required value="${esc(v?.plate||'')}"></label>
 <label>Marca<input name="brand" value="${esc(v?.brand||'')}"></label>
 <label>Modelo<input name="model" required value="${esc(v?.model||'')}"></label>
 <label>Ano<input name="year" type="number" min="1900" max="2100" value="${esc(v?.year||'')}"></label>
 <label>Cor<input name="color" value="${esc(v?.color||'')}"></label>
 <label>KM atual<input name="km" type="number" min="0" required value="${v?.km??0}"></label>
 <label>KM da última troca de óleo<input name="last" type="number" min="0" required value="${v?.last??0}"></label>
 <label>Intervalo da troca de óleo<select name="interval"><option value="1000" ${v?.interval===1000?'selected':''}>1.000 km</option><option value="5000" ${!v||v?.interval===5000?'selected':''}>5.000 km</option><option value="10000" ${v?.interval===10000?'selected':''}>10.000 km</option></select></label>
 <label>Data da última troca<input name="oilDate" type="date" value="${esc(v?.oilDate||'')}"></label>
 <label class="full">Observações<textarea name="notes" rows="3">${esc(v?.notes||'')}</textarea></label>
 <div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar viatura</button></div>
 </form>`);
 $('vehicleForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target), km=Number(f.get('km')),last=Number(f.get('last')),interval=Number(f.get('interval'));if(km<last)return alert('O KM atual não pode ser menor que o KM da última troca.');const obj={id:v?.id||uid(),unit:f.get('unit'),prefix:f.get('prefix').trim(),plate:f.get('plate').trim().toUpperCase(),brand:f.get('brand').trim(),model:f.get('model').trim(),year:f.get('year'),color:f.get('color').trim(),km,interval,last,next:last+interval,oilDate:f.get('oilDate'),notes:f.get('notes').trim()};if(v)Object.assign(v,obj);else s.vehicles.push(obj);save();closeModal();vehicles();};
}
function editVehicle(id){newVehicle(id)}
function findV(id){return s.vehicles.find(v=>v.id===id)}
function kmAdmin(id){const v=findV(id);const n=Number(prompt('Informe o KM atual:',v.km));if(Number.isFinite(n)&&n>=v.km){v.km=n;save();vehicles();}else alert('Informe um KM válido, igual ou maior que o atual.');}
function oilAdmin(id){const v=findV(id);const n=Number(prompt('KM da troca de óleo:',v.km));if(!Number.isFinite(n))return;v.km=Math.max(v.km,n);v.last=n;v.next=n+v.interval;v.oilDate=new Date().toISOString().slice(0,10);s.maintenance.push({id:uid(),date:new Date().toLocaleString('pt-BR'),vehicle:v.id,type:'Troca de óleo',km:n,desc:'',value:0,source:'Administrador'});save();vehicles();}
function maintenanceAdmin(id){const v=findV(id);const m=modal('Registrar manutenção',`<form id="maintForm" class="form-grid"><label>Data<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>KM<input name="km" type="number" value="${v.km}"></label><label>Tipo<select name="type"><option>Manutenção preventiva</option><option>Manutenção corretiva</option><option>Pneus</option><option>Bateria</option><option>Revisão</option><option>Outro</option></select></label><label>Valor (R$)<input name="value" type="number" min="0" step="0.01" value="0"></label><label class="full">Descrição<textarea name="desc" rows="4" required></textarea></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="orange" type="submit">Registrar manutenção</button></div></form>`);$('maintForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);s.maintenance.push({id:uid(),date:f.get('date'),vehicle:v.id,type:f.get('type'),km:Number(f.get('km')),desc:f.get('desc'),value:Number(f.get('value')),source:'Administrador'});save();closeModal();maint();};}

function drivers(){
 setActiveNav('Motoristas');
 $('content').innerHTML=`<div class="page-head"><div><div class="eyebrow">ACESSOS</div><h1>Motoristas</h1><p>Cadastre e controle os acessos secundários</p></div><button class="primary" onclick="newDriver()">+ Novo motorista</button></div>
 <div class="cards-list">${s.drivers.map((d,i)=>`<div class="list-card driver-row"><div class="driver-info"><div class="avatar">👤</div><div><b>${esc(d.name)}</b><span>${esc(d.email)} · ${esc(d.unit)}</span></div></div><div class="driver-actions-row"><span class="pill ${d.active===false?'off':''}">${d.active===false?'Inativo':'Ativo'}</span><button class="secondary" onclick="editDriver(${i})">Editar</button><button class="danger-btn" onclick="delDriver(${i})">Excluir</button></div></div>`).join('')||'<div class="empty-card">Nenhum motorista cadastrado.</div>'}</div>`;
}
function newDriver(existingIndex=null){
 const d=existingIndex===null?null:s.drivers[existingIndex];
 const m=modal(d?'Editar motorista':'Novo motorista',`<form id="driverForm" class="form-grid">
 <label>Nome completo<input name="name" required value="${esc(d?.name||'')}"></label>
 <label>Matrícula<input name="matricula" value="${esc(d?.matricula||'')}"></label>
 <label>E-mail<input name="email" type="email" required value="${esc(d?.email||'')}"></label>
 <label>Unidade<select name="unit" required>${s.units.map(u=>`<option ${d?.unit===u.name?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
 <label class="full">Senha ${d?'(deixe vazia para manter)':'inicial'}<input name="password" type="password" placeholder="${d?'Manter atual':'000000'}"></label>
 <label>Status<select name="active"><option value="true" ${d?.active!==false?'selected':''}>Ativo</option><option value="false" ${d?.active===false?'selected':''}>Inativo</option></select></label>
 <div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar motorista</button></div>
 </form>`);
 $('driverForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),email=f.get('email').trim().toLowerCase();if(s.drivers.some((x,i)=>x.email.toLowerCase()===email&&i!==existingIndex))return alert('Este e-mail já está cadastrado.');const obj={id:d?.id||uid(),name:f.get('name').trim(),matricula:f.get('matricula').trim(),email,unit:f.get('unit'),active:f.get('active')==='true',password:f.get('password')||d?.password||'000000'};if(existingIndex===null)s.drivers.push(obj);else s.drivers[existingIndex]=obj;save();closeModal();drivers();};
}
function editDriver(i){newDriver(i)}
function delDriver(i){if(confirm('Excluir este motorista?')){s.drivers.splice(i,1);save();drivers();}}

function maint(){
 setActiveNav('Manutenções');
 $('content').innerHTML=`<div class="page-head"><div><div class="eyebrow">HISTÓRICO</div><h1>Manutenções</h1><p>Registros de óleo e serviços da frota</p></div></div>
 <div class="cards-list">${s.maintenance.slice().reverse().map(m=>{const v=findV(m.vehicle);return `<div class="list-card"><div><b>${esc(v?.prefix||'Viatura removida')}</b><span>${esc(m.type)} · ${esc(m.desc||'')} · KM ${kmfmt(m.km)}</span></div><strong>${esc(m.date)}<br>${money(m.value)}</strong></div>`}).join('')||'<div class="empty-card">Nenhuma manutenção registrada.</div>'}</div>`;
}
function backup(){const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup_cpa7_offline.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function changeAdminPassword(){const old=prompt('Senha atual:'),np=prompt('Nova senha:');if(old===s.adminPassword&&np){s.adminPassword=np;save();alert('Senha alterada.');}else alert('Não foi possível alterar a senha.');}

function renderDriver(){
 document.body.className='driver-body';
 const d=s.drivers.find(x=>x.id===s.session.driverId);
 if(!d){logout();return;}
 let selected=s.session.selectedVehicleId;
 if(selected&&!s.vehicles.some(v=>v.id===selected))selected='';
 const v=s.vehicles.find(x=>x.id===selected);
 $('app').innerHTML=`${shellHeader('CPA-7','Área do Motorista')}
 <main class="driver-layout">
  <aside class="driver-side">
   <img src="assets/brasao_pmms.png" class="driver-crest">
   <div class="driver-user"><b>${esc(d.name)}</b><span>${esc(d.unit)}</span></div>
   <div class="driver-menu">
    <button class="driver-menu-btn selected" onclick="renderDriver()">🚓 Viaturas</button>
    <button class="driver-menu-btn" onclick="driverHistory()">📋 Histórico</button>
    <button class="driver-menu-btn" onclick="editDriverProfile()">👤 Meu cadastro</button>
    <button class="driver-menu-btn" onclick="changeDriverPassword()">🔒 Minha senha</button>
   </div>
  </aside>
  <section class="driver-content">
   <div class="driver-page-head"><div><div class="eyebrow">ÁREA DO MOTORISTA</div><h1>Selecione a Viatura</h1><p>Escolha a viatura para registrar KM, óleo ou manutenção.</p></div></div>
   <div class="selector-card"><label>Viatura</label><div class="select-wrap"><span>🚓</span><select id="driverVehicleSelect" onchange="driverSelect(this.value)"><option value="">Escolha uma viatura...</option>${s.vehicles.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.prefix)} — ${esc(x.unit)}${x.plate?' — '+esc(x.plate):''}</option>`).join('')}</select></div></div>
   ${v?driverVehicle(v):`<div class="empty-driver"><img src="assets/brasao_pmms.png"><h2>Nenhuma viatura selecionada</h2><p>Use a lista acima para escolher uma viatura.</p></div>`}
  </section>
 </main>`;
}
function driverSelect(id){s.session.selectedVehicleId=id;save();renderDriver();}
function driverVehicle(v){
 const rem=v.next-v.km, state=rem<0?'overdue':rem<1000?'alert':'ok';
 return `<div class="selected-driver-grid">
  <div class="driver-vehicle-card"><img src="assets/brasao_pmms.png"><div><span>VIATURA SELECIONADA</span><h2>${esc(v.prefix)}</h2><p>${esc(v.unit)} · ${esc(v.model)} · ${esc(v.plate)}</p></div></div>
  <div class="action-card km-card"><div class="action-icon">◉</div><h3>Atualizar KM</h3><span>KM atual</span><strong>${kmfmt(v.km)} km</strong><button class="green" onclick="driverKm('${v.id}')">Registrar KM</button></div>
  <div class="action-card oil-card"><div class="action-icon">🛢</div><h3>Troca de Óleo</h3><span>Próxima troca</span><strong>${kmfmt(v.next)} km</strong><button class="blue" onclick="driverOil('${v.id}')">Registrar troca</button></div>
  <div class="action-card maint-card"><div class="action-icon">🔧</div><h3>Manutenção</h3><span>KM atual</span><strong>${kmfmt(v.km)} km</strong><button class="orange" onclick="driverMaint('${v.id}')">Registrar manutenção</button></div>
 </div>
 <div class="driver-status ${state}">${state==='ok'?'🟢 VIATURA EM SITUAÇÃO NORMAL':state==='alert'?(rem<0?`🔴 TROCA VENCIDA — ${kmfmt(Math.abs(rem))} km`:`🚨 TROCA PRÓXIMA — FALTAM ${kmfmt(rem)} km`):''}</div>`;
}


function driverHistory(){
 const d=s.drivers.find(x=>x.id===s.session.driverId);
 if(!d)return;
 const mine=s.maintenance.slice().reverse();
 $('driver-content-placeholder')?.remove();
 const section=document.querySelector('.driver-content');
 if(!section)return;
 section.innerHTML=`<div class="driver-page-head"><div><div class="eyebrow">ÁREA DO MOTORISTA</div><h1>Histórico</h1><p>Registros realizados no sistema.</p></div></div>
 <div class="selector-card history-panel">
  ${mine.map(m=>{const v=currentV(m.vehicle);return `<div class="history-row"><div><b>${esc(v?.prefix||'Viatura')}</b><span>${esc(v?.unit||'')} · ${esc(m.type)}</span><small>${esc(m.date)} · KM ${kmfmt(m.km)}</small></div><strong>${money(m.value)}</strong></div>`}).join('')||'<div class="empty-card">Nenhum lançamento registrado.</div>'}
 </div>`;
 document.querySelectorAll('.driver-menu-btn,.driver-menu div').forEach(x=>x.classList.remove('selected'));
 const h=[...document.querySelectorAll('.driver-menu-btn')].find(x=>x.innerText.includes('Histórico'));
 if(h)h.classList.add('selected');
}

function editDriverProfile(){
 const d=s.drivers.find(x=>x.id===s.session.driverId);
 if(!d)return;
 modal('Meu cadastro',`<form id="profileForm" class="form-grid">
  <label>Nome completo<input name="name" required value="${esc(d.name)}"></label>
  <label>Matrícula<input name="matricula" value="${esc(d.matricula||'')}"></label>
  <label>E-mail<input name="email" type="email" required value="${esc(d.email)}"></label>
  <label>Unidade<input value="${esc(d.unit)}" disabled></label>
  <div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Salvar cadastro</button></div>
 </form>`);
 $('profileForm').onsubmit=e=>{
  e.preventDefault();
  const f=new FormData(e.target), email=f.get('email').trim().toLowerCase();
  if(s.drivers.some(x=>x.id!==d.id && x.email.toLowerCase()===email)) return alert('Este e-mail já está cadastrado.');
  d.name=f.get('name').trim(); d.matricula=f.get('matricula').trim(); d.email=email;
  save(); closeModal(); renderDriver();
 };
}
function changeDriverPassword(){
 const d=s.drivers.find(x=>x.id===s.session.driverId);
 if(!d)return;
 modal('Alterar minha senha',`<form id="passwordForm" class="form-grid">
  <label class="full">Senha atual<input name="old" type="password" required></label>
  <label>Nova senha<input name="new" type="password" minlength="6" required></label>
  <label>Confirmar nova senha<input name="confirm" type="password" minlength="6" required></label>
  <div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Alterar senha</button></div>
 </form>`);
 $('passwordForm').onsubmit=e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  if(f.get('old')!==d.password) return alert('Senha atual incorreta.');
  if(f.get('new')!==f.get('confirm')) return alert('As novas senhas não coincidem.');
  d.password=f.get('new'); save(); closeModal(); alert('Senha alterada com sucesso.');
 };
}

function currentV(id){return s.vehicles.find(v=>v.id===id);}
function driverKm(id){const v=currentV(id),n=Number(prompt('Informe o KM atual:',v.km));if(Number.isFinite(n)&&n>=v.km){v.km=n;save();renderDriver();}else alert('Informe um KM válido, igual ou maior que o atual.');}
function driverOil(id){const v=currentV(id),n=Number(prompt('KM da troca de óleo:',v.km));if(!Number.isFinite(n))return;v.km=Math.max(v.km,n);v.last=n;v.next=n+v.interval;v.oilDate=new Date().toISOString().slice(0,10);s.maintenance.push({id:uid(),date:new Date().toLocaleString('pt-BR'),vehicle:v.id,type:'Troca de óleo',km:n,desc:'Lançada pelo motorista',value:0,source:'Motorista'});save();renderDriver();}
function driverMaint(id){const v=currentV(id);const m=modal('Registrar manutenção',`<form id="dMaint" class="form-grid"><label>Data<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>KM<input name="km" type="number" value="${v.km}"></label><label>Tipo<select name="type"><option>Manutenção preventiva</option><option>Manutenção corretiva</option><option>Pneus</option><option>Bateria</option><option>Revisão</option><option>Outro</option></select></label><label>Valor (R$)<input name="value" type="number" min="0" step="0.01" value="0"></label><label class="full">Descrição<textarea name="desc" rows="4" required></textarea></label><div class="modal-actions full"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="orange" type="submit">Registrar manutenção</button></div></form>`);$('dMaint').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),d=s.drivers.find(x=>x.id===s.session.driverId);s.maintenance.push({id:uid(),date:f.get('date'),vehicle:v.id,type:f.get('type'),km:Number(f.get('km')),desc:f.get('desc'),value:Number(f.get('value')),source:`Motorista: ${d.name}`});save();closeModal();renderDriver();};}

function modal(title,html){
 const old=document.querySelector('.modal-backdrop');if(old)old.remove();
 const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><div class="modal-head"><div><small>PMMS • CPA-7</small><h2>${esc(title)}</h2></div><button class="close" onclick="closeModal()">×</button></div>${html}</div>`;document.body.appendChild(wrap);return wrap;
}
function closeModal(){document.querySelector('.modal-backdrop')?.remove();}

if(s.session?.role==='admin')renderAdmin(); else if(s.session?.role==='driver')renderDriver(); else login();
