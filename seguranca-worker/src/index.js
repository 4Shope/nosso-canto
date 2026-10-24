import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT = 'nosso-canto-5d714';
const FABRICIO = 'PPYyjohwQ5TLEeHSN4F44jWJF5x1';
const MARIA = 'Uj8dsCLH0fSGP2XZfZWCdhdTCHK2';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const encoder = new TextEncoder();
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
function cors(origin,env){
 const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim());
 return allowed.includes(origin)?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'POST,OPTIONS'}:{};
}
async function authorized(req){
 const token=/^Bearer (.+)$/.exec(req.headers.get('Authorization')||'')?.[1];
 if(!token) throw new Error('LOGIN');
 const {payload}=await jwtVerify(token,JWKS,{issuer:'https://securetoken.google.com/'+PROJECT,audience:PROJECT,algorithms:['RS256']});
 if(![FABRICIO,MARIA].includes(payload.sub)) throw new Error('PERMISSION');
 return payload.sub;
}
const bytes = b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
const b64 = b=>btoa(String.fromCharCode(...new Uint8Array(b)));
async function hash(pin,salt,iterations=240000){
 const material=await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);
 return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations,hash:'SHA-256'},material,256));
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export default {
 async fetch(req,env){
  const origin=req.headers.get('Origin')||'';
  const headers=cors(origin,env);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!headers['access-control-allow-origin'])return json({erro:'Origem não permitida'},403);
  if(req.method!=='POST')return json({erro:'Método inválido'},405,headers);
  try{
   if(!env.SECURITY_KV) return json({erro:'KV não configurado'},503,headers);
   const uid=await authorized(req);
   const url=new URL(req.url);
   if(!['/pin/configurar','/pin/verificar','/youtube/buscar','/estado'].includes(url.pathname))return json({erro:'Rota inexistente'},404,headers);
   const body=await req.json().catch(()=>({}));
   if(url.pathname==='/estado'){
    return json({pinConfigurado:!!(await env.SECURITY_KV.get('pin:v1')),youtubeConfigurado:!!env.YOUTUBE_API_KEY},200,headers);
   }
   if(url.pathname==='/pin/configurar'){
    if(uid!==FABRICIO)return json({erro:'Somente Fabricio pode alterar o PIN'},403,headers);
    const pin=String(body.pin||'');
    if(!/^[0-9]{6,8}$/.test(pin))return json({erro:'Use 6 a 8 números'},400,headers);
    const current=await env.SECURITY_KV.get('pin:v1');
    if(current){
     // A troca exige o PIN anterior além do login do proprietário.
     const old=String(body.pinAnterior||'');
     const record=JSON.parse(current);
     if(!old || !equal(await hash(old,record.salt,record.iterations),record.hash))return json({erro:'PIN anterior incorreto'},403,headers);
    }
    const salt=b64(crypto.getRandomValues(new Uint8Array(24)));
    await env.SECURITY_KV.put('pin:v1',JSON.stringify({salt,hash:await hash(pin,salt),iterations:240000}));
    return json({ok:true},200,headers);
   }
   if(url.pathname==='/pin/verificar'){
    const key='tentativas:'+uid;
    const attempts=Number(await env.SECURITY_KV.get(key)||0);
    if(attempts>=5)return json({erro:'Muitas tentativas. Aguarde 15 minutos.'},429,headers);
    const record=JSON.parse(await env.SECURITY_KV.get('pin:v1')||'null');
    if(!record)return json({erro:'PIN ainda não configurado'},409,headers);
    const valid=/^[0-9]{6,8}$/.test(String(body.pin||'')) && equal(await hash(String(body.pin),record.salt,record.iterations),record.hash);
    if(!valid){
     await env.SECURITY_KV.put(key,String(attempts+1),{expirationTtl:900});
     return json({erro:'PIN incorreto'},403,headers);
    }
    await env.SECURITY_KV.delete(key);
    return json({ok:true},200,headers);
   }
   if(url.pathname==='/youtube/buscar'){
    if(!env.YOUTUBE_API_KEY)return json({erro:'Chave do YouTube não configurada'},503,headers);
    const q=String(body.q||'').trim();
    if(q.length<2||q.length>100)return json({erro:'Pesquisa inválida'},400,headers);
    const rateKey='yt:'+uid+':'+Math.floor(Date.now()/60000);
    const count=Number(await env.SECURITY_KV.get(rateKey)||0);
    if(count>=20)return json({erro:'Limite de buscas por minuto'},429,headers);
    await env.SECURITY_KV.put(rateKey,String(count+1),{expirationTtl:120});
    const api=new URL('https://www.googleapis.com/youtube/v3/search');
    for(const [k,v] of Object.entries({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'15',q,key:env.YOUTUBE_API_KEY}))api.searchParams.set(k,v);
    const upstream=await fetch(api.toString());
    const data=await upstream.json();
    if(!upstream.ok)return json({erro:'Busca indisponível',status:upstream.status},502,headers);
    return json({items:(data.items||[]).map(x=>({id:{videoId:x.id?.videoId},snippet:{title:x.snippet?.title,channelTitle:x.snippet?.channelTitle,thumbnails:x.snippet?.thumbnails}}))},200,headers);
   }
  }catch(e){return json({erro:e.message==='LOGIN'?'Faça login primeiro':e.message==='PERMISSION'?'Acesso negado':'Erro ao processar a solicitação'},e.message==='LOGIN'?401:e.message==='PERMISSION'?403:500,headers);}
 }
};
