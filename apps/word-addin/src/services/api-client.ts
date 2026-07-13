import { supabase } from './supabase-client'; import type { HistoryItem,LexheroRequest,LexheroResponse,ThinkingResponse,WebhookJobStart,WebhookJobStatus } from '../types';
const base=import.meta.env.VITE_API_BASE_URL||'http://localhost:3000';
async function request<T>(path:string, init?:RequestInit):Promise<T>{const {data}=await supabase.auth.getSession(); const token=data.session?.access_token;if(!token)throw new Error('Sessione scaduta. Accedi di nuovo.');const res=await fetch(`${base}${path}`,{...init,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...init?.headers}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(Array.isArray(body.message)?body.message.join(', '):body.message||`Errore ${res.status}`);return body;}
const delay=(ms:number)=>new Promise<void>((resolve)=>setTimeout(resolve,ms));
async function webhook(payload:LexheroRequest):Promise<LexheroResponse>{
  const job=await request<WebhookJobStart>('/api/webhooks/jobs',{method:'POST',body:JSON.stringify(payload)});
  const deadline=Date.now()+10*60_000;
  while(Date.now()<deadline){
    await delay(2_000);
    const result=await request<WebhookJobStatus>(`/api/webhooks/jobs/${encodeURIComponent(job.jobId)}`);
    if(result.status==='completed'&&result.response)return result.response;
    if(result.status==='failed')throw new Error(result.error||'Analisi non riuscita');
  }
  throw new Error('Il workflow sta impiegando troppo tempo. Riprova tra poco.');
}
export const api={webhook,thinking:(payload:{action:LexheroRequest['action'];request:string})=>request<ThinkingResponse>('/api/webhooks/thinking',{method:'POST',body:JSON.stringify(payload)}),history:()=>request<HistoryItem[]>('/api/history')};
