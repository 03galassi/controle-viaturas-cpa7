// Worker independente para lançamentos públicos. Lê app/state e grava somente em publicMaintenance.
// GET /maintenance exige Firebase ID token válido; POST exige Turnstile válido.
// Variáveis: FIREBASE_PROJECT_ID, FIREBASE_API_KEY, ALLOWED_ORIGIN, FIREBASE_SERVICE_ACCOUNT_JSON (SECRET), TURNSTILE_SECRET_KEY (SECRET).
const DOC_PATH = 'app/state';
const COLLECTION = 'publicMaintenance';
const ALLOWED_TYPES = new Set(['Manutenção preventiva','Manutenção corretiva','Pneus','Bateria','Freios','Revisão','Outro']);
const cors = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Vary': 'Origin'
});
const json = (data,status,origin) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...cors(origin)}});
function decodeValue(v){if(!v)return null;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return Number(v.doubleValue);if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;if('arrayValue'in v)return (v.arrayValue.values||[]).map(decodeValue);if('mapValue'in v)return decodeFields(v.mapValue.fields||{});return null;}
function decodeFields(fields){const o={};for(const [k,v] of Object.entries(fields||{}))o[k]=decodeValue(v);return o;}
function encodeValue(v){if(v===null||v===undefined)return {nullValue:null};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(encodeValue)}};if(typeof v==='object')return {mapValue:{fields:encodeFields(v)}};return {nullValue:null};}
function encodeFields(o){const f={};for(const [k,v] of Object.entries(o))f[k]=encodeValue(v);return f;}
function b64url(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64text(s){return b64url(new TextEncoder().encode(s));}
async function accessToken(env){
  const sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);const now=Math.floor(Date.now()/1000);
  const h=b64text(JSON.stringify({alg:'RS256',typ:'JWT'}));const c=b64text(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=`${h}.${c}`;const pem=sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const keyBytes=Uint8Array.from(atob(pem),x=>x.charCodeAt(0));const key=await crypto.subtle.importKey('pkcs8',keyBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));const assertion=`${unsigned}.${b64url(sig)}`;
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const d=await r.json();if(!r.ok)throw new Error('Falha na autenticação da conta de serviço.');return d.access_token;
}
async function readState(env,token){const url=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${DOC_PATH}`;const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Não foi possível consultar o cadastro de viaturas.');const d=await r.json();return decodeFields(d.fields||{});}
async function verifyTurnstile(request,env,body){
  if(!env.TURNSTILE_SECRET_KEY)return {ok:false,reason:'O servidor não está configurado com a chave secreta do Turnstile.'};
  if(!body.turnstileToken)return {ok:false,reason:'O formulário não enviou o token de segurança. Refaça a verificação.'};
  const params={secret:env.TURNSTILE_SECRET_KEY,response:body.turnstileToken};const ip=request.headers.get('CF-Connecting-IP');if(ip)params.remoteip=ip;
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const d=await r.json().catch(()=>({}));
  if(d.success===true){if(d.hostname && d.hostname!=='03galassi.github.io')return {ok:false,reason:'O domínio retornado pelo Turnstile não corresponde ao site autorizado.'};return {ok:true};}
  const codes=Array.isArray(d['error-codes'])?d['error-codes']:[];
  return {ok:false,reason:`Cloudflare recusou a verificação (${codes.join(', ')||'resposta inválida'}). Confira se a Site Key e a Secret Key pertencem ao mesmo widget e se o domínio está autorizado.`};
}
async function verifyFirebaseUser(request,env){
  const auth=request.headers.get('Authorization')||'';const match=auth.match(/^Bearer\s+(.+)$/i);if(!match)return false;
  if(!env.FIREBASE_API_KEY)return false;
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:match[1]})});
  if(!r.ok)return false;const d=await r.json().catch(()=>({}));return Array.isArray(d.users)&&d.users.length>0;
}
async function listPublicMaintenance(env,token){
  const base=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;
  let pageToken='',records=[];
  do {const url=new URL(base);url.searchParams.set('pageSize','100');if(pageToken)url.searchParams.set('pageToken',pageToken);
    const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Não foi possível consultar os lançamentos públicos.');
    const d=await r.json();for(const doc of d.documents||[]){const record=decodeFields(doc.fields||{});record.id=doc.name.split('/').pop();records.push(record);}pageToken=d.nextPageToken||'';
  } while(pageToken && records.length<1000);
  records.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  return records;
}
function localToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Campo_Grande',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};for(const p of parts)o[p.type]=p.value;return `${o.year}-${o.month}-${o.day}`;}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin')||'';const allowed=env.ALLOWED_ORIGIN;
  if(!allowed||origin!==allowed)return new Response('Origem não permitida',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors(allowed),'Access-Control-Max-Age':'86400'}});
  const u=new URL(request.url);if(!['/vehicles','/maintenance'].includes(u.pathname))return json({error:'Rota não encontrada.'},404,allowed);
  if((u.pathname==='/vehicles'&&request.method!=='GET')||(u.pathname==='/maintenance'&&!['GET','POST'].includes(request.method)))return json({error:'Método não permitido.'},405,allowed);
  try {
    if(u.pathname==='/maintenance'&&request.method==='GET'){
      if(!await verifyFirebaseUser(request,env))return json({error:'Acesso não autorizado. Entre novamente no sistema.'},401,allowed);
      const token=await accessToken(env);const records=await listPublicMaintenance(env,token);return json({records},200,allowed);
    }
    const token=await accessToken(env);const data=await readState(env,token);
    if(u.pathname==='/vehicles'){
      const vehicles=(data.vehicles||[]).filter(v=>v&&v.id&&v.prefix&&v.active!==false).map(v=>({id:String(v.id),prefix:String(v.prefix),unit:String(v.unit||'')}));
      return json({vehicles},200,allowed);
    }
    let body;try{body=await request.json();}catch{return json({error:'Corpo da solicitação inválido.'},400,allowed);}
    const challenge=await verifyTurnstile(request,env,body||{});if(!challenge.ok)return json({error:challenge.reason},403,allowed);
    if(!body||typeof body.vehicleId!=='string'||!body.vehicleId||!/^\d{4}-\d{2}-\d{2}$/.test(body.date))return json({error:'Informe viatura e data válidas.'},400,allowed);
    const [y,m,d]=body.date.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return json({error:'Data inválida.'},400,allowed);
    if(body.date>localToday())return json({error:'A data não pode ser futura.'},400,allowed);
    const v=(data.vehicles||[]).find(x=>String(x.id)===body.vehicleId&&x.active!==false);if(!v)return json({error:'Viatura não encontrada ou inativa.'},404,allowed);
    const isOil=body.type==='Troca de óleo';const maintenanceType=String(body.maintenanceType||'');
    if(!isOil&&!ALLOWED_TYPES.has(maintenanceType))return json({error:'Selecione um tipo de manutenção válido.'},400,allowed);
    const km=Number(body.km);if(!Number.isFinite(km)||km<0)return json({error:'Informe uma quilometragem válida.'},400,allowed);
    const value=Number(body.value??0);if(!Number.isFinite(value)||value<0)return json({error:'Informe um valor válido.'},400,allowed);
    const desc=isOil?String(body.desc||'').trim():String(body.desc||'').trim();if(desc.length>500)return json({error:'A descrição deve ter até 500 caracteres.'},400,allowed);
    if(!isOil&&!desc)return json({error:'Descreva o serviço realizado.'},400,allowed);
    const id=crypto.randomUUID();const record={date:body.date,vehicle:String(v.id),prefix:String(v.prefix||''),type:isOil?'Troca de óleo':maintenanceType,km,desc:desc||(isOil?'Troca de óleo registrada pelo formulário público':''),value,source:'Lançamento público',publicRecord:true,createdAt:new Date().toISOString()};
    const restUrl=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${COLLECTION}?documentId=${encodeURIComponent(id)}`;
    const saved=await fetch(restUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({fields:encodeFields(record)})});
    if(!saved.ok){const details=await saved.text();return json({error:saved.status===403?'O Firestore recusou a gravação. Verifique se a conta de serviço possui permissão de criação na coleção publicMaintenance.':'Não foi possível gravar o lançamento.'},500,allowed);}
    return json({message:'Lançamento registrado no histórico adicional da viatura.'},201,allowed);
  } catch(e){return json({error:'Falha na integração com Firebase/Cloudflare. Confira as variáveis e as permissões do Worker.'},500,allowed);}
}};
