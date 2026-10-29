
'use strict';

const API_BASE = 'https://controle-viaturas-lancamentos.03galassi.workers.dev';
const TURNSTILE_SITE_KEY = '0x4AAAAAAFrlSJv_i05OjjYL';

const $ = id => document.getElementById(id);
const form = $('entryForm');
const statusBox = $('status');
const vehicleSelect = $('vehicle');
const submitBtn = $('submit');
const maintenanceFields = $('maintenance-fields');

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
$('date').value = todayStr;
$('date').max = todayStr;

let vehicles = [];
let turnstileWidgetId = null;
window.__turnstileToken = '';

function selectedType() {
  return form.querySelector('input[name="type"]:checked')?.value || '';
}

function updateFields() {
  const isMaintenance = selectedType() === 'Manutenção preventiva';
  maintenanceFields.hidden = !isMaintenance;
  $('km').required = isMaintenance;
  $('maintenance-type').required = isMaintenance;
  $('desc').required = isMaintenance;
}

form.querySelectorAll('input[name="type"]').forEach(radio => {
  radio.addEventListener('change', updateFields);
});
updateFields();

function setupTurnstile() {
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

function status(message, type='') {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  statusBox.hidden = false;
}

function showResult(message, type='') {
  $('result').textContent = message;
  $('result').className = `result ${type}`;
  $('result').hidden = false;
}

async function request(path, options={}) {
  const response = await fetch(`${API_BASE.replace(/\/$/,'')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

async function init() {
  try {
    const data = await request('/vehicles');
    vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    vehicles.sort((a,b) => String(a.prefix || '').localeCompare(
      String(b.prefix || ''), 'pt-BR', {numeric:true}
    ));

    vehicleSelect.innerHTML =
      '<option value="">Selecione a viatura</option>' +
      vehicles.map(v =>
        `<option value="${escapeHtml(v.id)}">${escapeHtml(v.prefix)}${v.unit ? ' — '+escapeHtml(v.unit) : ''}</option>`
      ).join('');

    if (!vehicles.length) {
      status('Nenhuma viatura cadastrada no sistema.', 'error');
      return;
    }

    status('Selecione a viatura e informe os dados do serviço.');
    form.hidden = false;
    updateFields();
  } catch (e) {
    status(e.message, 'error');
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  $('result').hidden = true;

  const vehicleId = vehicleSelect.value;
  const date = $('date').value;
  const type = selectedType();
  const isMaintenance = type === 'Manutenção preventiva';

  if (!vehicleId || !date || date > todayStr) {
    showResult('Confira a viatura e a data. A data não pode ser futura.', 'error');
    return;
  }

  const payload = { vehicleId, date, type };

  if (isMaintenance) {
    const km = Number($('km').value);
    const desc = $('desc').value.trim();
    const value = $('value').value === '' ? 0 : Number($('value').value);
    const maintenanceType = $('maintenance-type').value;

    if ($('km').value === '' || !Number.isFinite(km) || km < 0) {
      showResult('Informe uma quilometragem válida.', 'error');
      return;
    }
    if (!desc || desc.length > 500) {
      showResult('Descreva o serviço realizado (até 500 caracteres).', 'error');
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      showResult('Informe um valor válido.', 'error');
      return;
    }

    payload.type = maintenanceType;
    payload.km = km;
    payload.desc = desc;
    payload.value = value;
    payload.kind = 'Manutenção';
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Registrando…';

  try {
    const turnstileToken = window.__turnstileToken || '';
    if (!turnstileToken) {
      showResult('Conclua a verificação de segurança antes de enviar.', 'error');
      return;
    }

    payload.turnstileToken = turnstileToken;
    const result = await request('/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showResult(result.message || 'Lançamento registrado com sucesso.');
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      window.__turnstileToken = '';
    }

    status('Registro concluído.');
    form.reset();
    $('date').value = todayStr;
    updateFields();
  } catch (err) {
    showResult(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Registrar lançamento';
  }
});

init();
