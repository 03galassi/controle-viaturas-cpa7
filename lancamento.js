'use strict';
// Configure this URL after deploying the separate Cloudflare Worker.
const API_BASE = 'CONFIGURE_URL_DO_WORKER';
const TURNSTILE_SITE_KEY = 'CONFIGURE_TURNSTILE_SITE_KEY';
const $ = id => document.getElementById(id);
const form = $('entryForm'), statusBox = $('status'), vehicleSelect = $('vehicle'), submitBtn = $('submit');
const today = new Date(); $('date').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
let vehicles = [];
let turnstileWidgetId = null;
window.__turnstileToken = '';
function setupTurnstile() {
  if (TURNSTILE_SITE_KEY === 'CONFIGURE_TURNSTILE_SITE_KEY') return;
  if (!window.turnstile || turnstileWidgetId !== null) return;
  const container = $('turnstile-container');
  if (!container) return;
  turnstileWidgetId = window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: token => { window.__turnstileToken = token; },
    'expired-callback': () => { window.__turnstileToken = ''; },
    'error-callback': () => { window.__turnstileToken = ''; }
  });
}
window.addEventListener('load', setupTurnstile);
setTimeout(setupTurnstile, 1500);
function status(message, type='') { statusBox.textContent = message; statusBox.className = `status ${type}`; statusBox.hidden = false; }
function showResult(message, type='') { $('result').textContent = message; $('result').className = `result ${type}`; $('result').hidden = false; }
async function request(path, options={}) {
  if (API_BASE === 'CONFIGURE_URL_DO_WORKER') throw new Error('A integração ainda precisa ser configurada pelo administrador.');
  const response = await fetch(`${API_BASE.replace(/\/$/,'')}${path}`, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers||{}) } });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}
async function init() {
  try {
    const data = await request('/vehicles');
    vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    vehicles.sort((a,b)=>String(a.prefix||'').localeCompare(String(b.prefix||''),'pt-BR',{numeric:true}));
    vehicleSelect.innerHTML = '<option value="">Selecione a viatura</option>' + vehicles.map(v=>`<option value="${escapeHtml(v.id)}">${escapeHtml(v.prefix)}${v.unit ? ' — '+escapeHtml(v.unit):''}</option>`).join('');
    if (!vehicles.length) { status('Nenhuma viatura cadastrada no sistema.','error'); return; }
    status('Selecione a viatura e informe a data do serviço.'); form.hidden = false;
  } catch(e) { status(e.message,'error'); }
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
form.addEventListener('submit', async e=>{
  e.preventDefault(); $('result').hidden = true;
  const vehicleId = vehicleSelect.value, date = $('date').value, type = form.querySelector('input[name="type"]:checked')?.value;
  if (!vehicleId || !date || !['Troca de óleo','Manutenção preventiva'].includes(type)) { showResult('Confira a viatura, a data e o tipo de lançamento.','error'); return; }
  if (date > `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`) { showResult('A data não pode ser futura.','error'); return; }
  submitBtn.disabled = true; submitBtn.textContent = 'Registrando…';
  try {
    const turnstileToken = window.__turnstileToken || '';
    if (!turnstileToken) { showResult('Conclua a verificação de segurança antes de enviar.','error'); return; }
    const result = await request('/maintenance', {method:'POST', body:JSON.stringify({vehicleId,date,type,turnstileToken})});
    showResult(result.message || 'Lançamento registrado com sucesso.');
    if (window.turnstile && turnstileWidgetId !== null) { window.turnstile.reset(turnstileWidgetId); window.__turnstileToken = ''; }
    status('Registro concluído.');
    form.reset(); $('date').value = date;
  } catch(err) { showResult(err.message,'error'); }
  finally { submitBtn.disabled = false; submitBtn.textContent = 'Registrar lançamento'; }
});
init();
