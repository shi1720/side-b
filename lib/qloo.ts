import { env } from 'cloudflare:workers';
import { AppError } from './errors';
import type { EntityKind, TasteEntity } from './types';

export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const KINDS = new Set(['artist','movie','book','tv_show']);
export type QlooResult = { entity_id: string; name: string; types?: string[]; subtype?: string; disambiguation?: string; properties?: {short_description?:string; description?:string; image?:{url?:string}}; query?: {affinity?:number; explainability?:unknown} };
export type QlooPayload = {success?:boolean; results: QlooResult[] | {entities?:QlooResult[]}; error?: unknown; warnings?: {type?:string; [key:string]:unknown}[]};
export function entitiesFrom(payload: QlooPayload): QlooResult[] {
  const list=Array.isArray(payload.results)?payload.results:payload.results?.entities;
  if(!Array.isArray(list)) throw new AppError('Qloo returned an unexpected response. Please try again.',502);
  return list.filter(e=>UUID.test(e.entity_id) && typeof e.name==='string');
}
export function cleanEntity(entity: QlooResult,kind: EntityKind): TasteEntity {
  const image=entity.properties?.image?.url;
  return {id:entity.entity_id.toUpperCase(),name:entity.name,kind,disambiguation:entity.disambiguation,description:(entity.properties?.short_description??entity.properties?.description??'').replace(/<[^>]+>/g,'').slice(0,240),...(image?.startsWith('https://images.qloo.com/')?{image}:{})};
}

export async function quota(key: string, limit: number, seconds: number) {
  const db=env.DB;
  if(!db) throw new AppError('The workspace database is temporarily unavailable.',503);
  const now=Math.floor(Date.now()/1000);
  const result=await db.prepare(`INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at <= ? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING count`).bind(key,now+seconds,now,now).first<{count:number}>();
  if((result?.count??limit+1)>limit) throw new AppError('The demo has reached its request allowance. Reuse a saved collection or try again later.',429);
}
export async function requestIdentity(request: Request) {
  const ip=request.headers.get('cf-connecting-ip')??'local-preview';
  const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
  return [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
}
export async function qloo(path: '/search'|'/v2/insights',params: Record<string,string>,ttl=86400) {
  const key=path+'?'+new URLSearchParams(Object.entries(params).sort(([a],[b])=>a.localeCompare(b))).toString();
  const db=env.DB;
  const now=Math.floor(Date.now()/1000);
  const cached=await db?.prepare('SELECT value FROM api_cache WHERE key=? AND expires_at>?').bind(key,now).first<{value:string}>();
  if(cached){const data=JSON.parse(cached.value) as QlooPayload; return {data,cached:true,fetchedAt:JSON.parse(cached.value).__fetchedAt as string};}
  const config=env as typeof env & {QLOO_API_KEY?:string;QLOO_API_BASE?:string};
  if(!config.QLOO_API_KEY) throw new AppError('Live Qloo access is not configured. Saved collections remain available.',503);
  const base=config.QLOO_API_BASE??'https://hackathon.api.qloo.com';
  if(!['https://hackathon.api.qloo.com','https://api.qloo.com'].includes(base)) throw new AppError('Qloo server configuration is invalid.',503);
  let response:Response|undefined;
  for(let attempt=0;attempt<2;attempt++) {
    await quota('qloo-day:'+new Date().toISOString().slice(0,10),250,86400);
    try {response=await fetch(base+key,{headers:{'X-Api-Key':config.QLOO_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(16000)});}
    catch {if(attempt===1) throw new AppError('Qloo is taking too long. Your stock and saved collections are safe; try again.',504);}
    if(response?.ok) break;
    if(response && ![429,500,502,503,504].includes(response.status)) break;
    if(attempt===0) await new Promise(r=>setTimeout(r,700));
  }
  if(!response?.ok) throw new AppError(response?.status===429?'Qloo is busy. Please retry shortly.':'Qloo could not complete this cultural analysis. Please try another audience or retry.',response?.status===429?429:502);
  const data=await response.json() as QlooPayload;
  if(data.success===false) throw new AppError('Qloo could not score this audience. Try another cultural anchor.',502);
  entitiesFrom(data);
  const fetchedAt=new Date().toISOString();
  await db?.prepare('INSERT INTO api_cache (key,value,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').bind(key,JSON.stringify({...data,__fetchedAt:fetchedAt}),now+ttl).run();
  return {data,cached:false,fetchedAt};
}
export async function searchEntities(query:string,kind:EntityKind){
  if(!KINDS.has(kind)||query.trim().length<2||query.length>80) throw new AppError('Enter 2–80 characters and choose a supported cultural category.');
  const result=await qloo('/search',{query:query.trim(),types:'urn:entity:'+kind,take:'8'},604800);
  return {...result,entities:entitiesFrom(result.data).map(e=>cleanEntity(e,kind))};
}
