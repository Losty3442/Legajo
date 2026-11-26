import type { Actor, AuthUser, CommissionScores, DocumentFile, Evaluation, Experience, PromotionCall, Workspace } from "../domain/models";
import type { MeritInput, RubricInput, TeacherInput, VacancyInput } from "../application/service";

export class HttpError extends Error{constructor(public status:number,public code:string,message:string){super(message);}}
export class LegajoHttpClient{
  revision:number|undefined;
  async json<T>(path:string,init:RequestInit={}):Promise<T>{
    const response=await fetch("/api/v1"+path,{credentials:"same-origin",...init,headers:{...(init.body instanceof FormData?{}:{"Content-Type":"application/json"}),...init.headers}});
    if(!response.ok){const error=(await response.json().catch(()=>({}))) as {code?:string;message?:string};if(response.status===401&&typeof window!=="undefined")window.dispatchEvent(new Event("legajo-session-expired"));throw new HttpError(response.status,error.code??"HTTP_ERROR",error.message??"No se pudo completar la operación.");}
    return response.json() as Promise<T>;
  }
  session(){return this.json<{user:AuthUser|null;initialized:boolean}>("/session");}
  async login(email:string,password:string){await this.json("/auth/login",{method:"POST",body:JSON.stringify({email,password})});return this.session();}
  async logout(){await this.json("/auth/logout",{method:"POST",body:"{}"});this.revision=undefined;}
  async initialize(){/* La inicialización de PostgreSQL se realiza únicamente mediante la migración. */}
  async snapshot(_actor?:Actor){const value=await this.json<Workspace>("/workspace");this.revision=value.revision;return value;}
  async mutate<T>(path:string,method:string,body:unknown={},idempotent=false){
    const headers:Record<string,string>={"If-Match":String(this.revision??"")};if(idempotent)headers["Idempotency-Key"]=crypto.randomUUID();
    const response=await this.json<{result:T;revision:number;accounts:{email:string;password:string}[]}>(path,{method,headers,body:body instanceof FormData?body:JSON.stringify(body)});
    this.revision=response.revision;
    if(response.accounts?.length)window.dispatchEvent(new CustomEvent("legajo-new-accounts",{detail:response.accounts}));
    return response.result;
  }
  saveTeacher(_actor:Actor,input:TeacherInput,id?:string){return this.mutate<string>(id?`/teachers/${encodeURIComponent(id)}`:"/teachers",id?"PATCH":"POST",input);}
  saveMerit(_actor:Actor,teacherId:string,input:MeritInput,file?:File,id?:string){const form=new FormData();form.set("payload",JSON.stringify(input));if(file)form.set("file",file);return this.mutate(id?`/merits/${encodeURIComponent(id)}`:`/teachers/${encodeURIComponent(teacherId)}/merits`,id?"PATCH":"POST",form);}
  review(_actor:Actor,id:string,status:"verificado"|"observado",note:string){return this.mutate(`/merits/${encodeURIComponent(id)}/reviews`,"POST",{status,note});}
  saveRequest(_actor:Actor,teacherId:string,vacancyId:string,id?:string,callId?:string){return this.mutate<string>(id?`/applications/${encodeURIComponent(id)}`:"/applications",id?"PATCH":"POST",{teacherId,vacancyId,callId});}
  submit(_actor:Actor,id:string){return this.mutate(`/applications/${encodeURIComponent(id)}/submissions`,"POST");}
  observeRequest(_actor:Actor,id:string,note:string){return this.mutate(`/applications/${encodeURIComponent(id)}/observations`,"POST",{note});}
  evaluationPreview(id:string){return this.json<Omit<Evaluation,"id"|"note">>(`/applications/${encodeURIComponent(id)}/evaluation-preview`);}
  closeEvaluation(_actor:Actor,id:string,note:string,scores?:CommissionScores){return this.mutate<string>(`/applications/${encodeURIComponent(id)}/evaluations`,"POST",{note,scores},true);}
  saveRubric(_actor:Actor,input:RubricInput,id?:string){return this.mutate<string>(id?`/rubrics/${encodeURIComponent(id)}`:"/rubrics",id?"PATCH":"POST",input);}
  approveRubric(_actor:Actor,id:string){return this.mutate(`/rubrics/${encodeURIComponent(id)}/approvals`,"POST");}
  createVacancy(_actor:Actor,input:VacancyInput){return this.mutate<string>("/vacancies","POST",input);}
  saveCall(_actor:Actor,input:Pick<PromotionCall,"name"|"startsOn"|"endsOn"|"vacancyIds">&{rubricId?:string},id?:string){return this.mutate<string>(id?`/calls/${encodeURIComponent(id)}`:"/calls",id?"PATCH":"POST",input);}
  advanceCall(_actor:Actor,id:string){return this.mutate(`/calls/${encodeURIComponent(id)}/phase`,"POST");}
  saveExperience(_actor:Actor,teacherId:string,input:Omit<Experience,"id"|"teacherId"|"updatedAt">,id?:string){return this.mutate(`/teachers/${encodeURIComponent(teacherId)}/experiences`+(id?`/${encodeURIComponent(id)}`:""),id?"PATCH":"POST",input);}
  createProposal(_actor:Actor,requestId:string,report:string){return this.mutate("/proposals","POST",{requestId,report},true);}
  advanceProposal(_actor:Actor,id:string,action:"remitir"|"elevar"|"aprobar"|"denegar",reference:string,note:string){const path=action==="remitir"?"referrals":action==="elevar"?"escalations":"decisions";return this.mutate(`/proposals/${encodeURIComponent(id)}/${path}`,"POST",{action,reference,note},true);}
  async document(_actor:Actor,id:string):Promise<DocumentFile>{const response=await fetch(`/api/v1/files/${encodeURIComponent(id)}`,{credentials:"same-origin"});if(!response.ok){const e=(await response.json().catch(()=>({}))) as {message?:string};throw new Error(e.message??"No se pudo abrir el documento.");}return {id,name:decodeURIComponent(response.headers.get("X-File-Name")??"documento"),type:response.headers.get("Content-Type")??"application/octet-stream",blob:await response.blob()};}
}
