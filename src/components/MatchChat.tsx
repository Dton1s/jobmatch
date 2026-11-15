"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarDays, CalendarPlus, Check, CheckCheck, Clock3, MapPin, Send, Video, X } from "lucide-react";
import { supabase, type Match, type Message, type Profile } from "@/lib/supabase";

const companyReplies=["¿Cuándo podrías hacer una prueba?","¿Tienes disponibilidad inmediata?","Te llamo hoy a las…"];
const workerReplies=["¡Hola! Me interesa mucho el puesto","Tengo disponibilidad inmediata","¿Cuál es el horario exacto?"];
type InterviewDraft={date:string;time:string;place:string};

export function MatchChat({match,profile,onClose,onActivity,onViewProfile}:{match:Match;profile:Profile;onClose:()=>void;onActivity:()=>void;onViewProfile:()=>void}){
  const [messages,setMessages]=useState<Message[]>([]);
  const [body,setBody]=useState("");
  const [busy,setBusy]=useState(false);
  const [online,setOnline]=useState(false);
  const [inviteOpen,setInviteOpen]=useState(false);
  const [rescheduleMessage,setRescheduleMessage]=useState<Message|null>(null);
  const [invite,setInvite]=useState<InterviewDraft>({date:"",time:"",place:""});
  const [error,setError]=useState("");
  const replies=profile.role==="company"?companyReplies:workerReplies;
  const grouped=useMemo(()=>messages.map((message,index)=>({message,showTime:index===0||new Date(messages[index-1].created_at).getHours()!==new Date(message.created_at).getHours()||new Date(messages[index-1].created_at).getDate()!==new Date(message.created_at).getDate()})),[messages]);
  const interviewReplies=useMemo(()=>new Map(messages.filter((message)=>message.message_type==="interview_reply"&&typeof message.metadata.interview_message_id==="string").map((message)=>[String(message.metadata.interview_message_id),message])),[messages]);

  useEffect(()=>{
    if(!supabase)return;
    let alive=true;
    void supabase.from("jobmatch_messages").select("*").eq("match_id",match.id).order("created_at").then(({data})=>{if(alive)setMessages((data??[]) as Message[]);});
    void supabase.rpc("jobmatch_mark_match_read",{p_match_id:match.id});
    const channel=supabase.channel(`jobmatch-chat-${match.id}`,{config:{presence:{key:profile.id}}})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"jobmatch_messages",filter:`match_id=eq.${match.id}`},(payload)=>{
        const next=payload.new as Message;setMessages((current)=>current.some((message)=>message.id===next.id)?current:[...current,next]);
        if(next.sender_id!==profile.id)void supabase?.rpc("jobmatch_mark_match_read",{p_match_id:match.id});
        onActivity();
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"jobmatch_messages",filter:`match_id=eq.${match.id}`},(payload)=>{
        const next=payload.new as Message;setMessages((current)=>current.map((message)=>message.id===next.id?next:message));
      })
      .on("presence",{event:"sync"},()=>setOnline(Object.keys(channel.presenceState()).length>1))
      .subscribe(async(status)=>{if(status==="SUBSCRIBED")await channel.track({online_at:new Date().toISOString()});});
    return()=>{alive=false;void supabase?.removeChannel(channel);};
  },[match.id,profile.id,onActivity]);

  async function send(event?:FormEvent,text=body,type:Message["message_type"]="text",metadata:Record<string,unknown>={}){
    event?.preventDefault();const content=text.trim();if(!content||busy||!supabase)return;
    setBusy(true);setError("");
    const {data,error:sendError}=await supabase.from("jobmatch_messages").insert({match_id:match.id,sender_id:profile.id,body:content,message_type:type,metadata}).select().single();
    if(sendError)setError(sendError.message);else if(data){setMessages((current)=>current.some((item)=>item.id===data.id)?current:[...current,data as Message]);setBody("");setInviteOpen(false);onActivity();}
    setBusy(false);
  }

  function sendInterview(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!invite.date||!invite.time||!invite.place){setError("Completa día, hora y dirección o teléfono.");return;}
    const dateLabel=new Date(`${invite.date}T${invite.time}`).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});
    if(rescheduleMessage){
      void send(undefined,`Propongo otra hora: ${dateLabel} a las ${invite.time} · ${invite.place}`,"interview_reply",{...invite,status:"reschedule",interview_message_id:rescheduleMessage.id});
      setRescheduleMessage(null);
    }else void send(undefined,`Propuesta de entrevista · ${dateLabel} a las ${invite.time} · ${invite.place}`,"interview",{...invite,status:"proposed"});
  }

  function replyToInterview(message:Message,status:"confirmed"|"reschedule",respondedTo:Message=message){
    const label=status==="confirmed"?"Confirmo la asistencia":"Me gustaría proponer otra hora";
    void send(undefined,label,"interview_reply",{interview_message_id:message.id,responded_to_id:respondedTo.id,status});
  }

  return <section className="chat-panel">
    <header className="chat-header"><button className="chat-back" onClick={onClose} aria-label="Volver a conexiones"><ArrowLeft size={18}/></button><button className="chat-profile-trigger" onClick={onViewProfile} aria-label={`Ver perfil de ${match.other_name}`}><span className="chat-avatar" style={match.other_photo?{backgroundImage:`url(${match.other_photo})`}:undefined}>{match.other_photo?null:match.other_name?.slice(0,1)}</span></button><div className="chat-contact"><button className="chat-name-trigger" onClick={onViewProfile}>{match.other_name}</button><button onClick={()=>setError(`Puesto del match: ${match.position}`)}>{match.position} <span>· vinculado</span></button></div><span className={`presence-pill ${online?"live":""}`}><i/>{online?"En línea":"Disponible"}</span></header>
    <div className="chat-context"><span><Check size={13}/> Match profesional</span><b>{match.position}</b></div>
    <div className="chat-messages" aria-live="polite">{messages.length===0&&<div className="chat-welcome"><span>✳</span><h3>¡Ya estáis conectados!</h3><p>Saluda, comparte tu disponibilidad o proponed un momento para hablar.</p></div>}{grouped.map(({message,showTime})=><div className="message-group" key={message.id}>{showTime&&<div className="chat-time-divider">{new Date(message.created_at).toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"})} · {new Date(message.created_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</div>}<article className={`chat-bubble ${message.sender_id===profile.id?"mine":"theirs"}`}>
      {message.message_type==="interview"?<InterviewCard message={message} response={interviewReplies.get(message.id)} userId={profile.id} onConfirm={(target)=>replyToInterview(message,"confirmed",target)} onReschedule={(target)=>{const meta=target.metadata as InterviewDraft;setRescheduleMessage(message);setInvite({...meta});setInviteOpen(true);}}/>:message.message_type==="interview_reply"?<div className="interview-reply"><CalendarPlus size={15}/><span>{message.body}</span></div>:<p>{message.body}</p>}
      <time>{new Date(message.created_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}{message.sender_id===profile.id&&<span className="message-check">{message.read_at?<><CheckCheck size={13}/> Leído</>:<><CheckCheck size={13}/> Enviado</>}</span>}</time>
    </article></div>)}</div>
    {profile.role==="company"&&<div className="quick-replies">{replies.map((reply)=><button key={reply} onClick={()=>void send(undefined,reply)}>{reply}</button>)}</div>}
    {profile.role==="worker"&&<div className="quick-replies">{replies.map((reply)=><button key={reply} onClick={()=>void send(undefined,reply)}>{reply}</button>)}</div>}
    {error&&<p className="chat-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Cerrar aviso"><X size={13}/></button></p>}
    {inviteOpen&&<form className="interview-form" onSubmit={sendInterview}><div className="interview-form-title"><span><CalendarPlus size={17}/> {rescheduleMessage?"Proponer otra hora":"Proponer entrevista"}</span><button type="button" onClick={()=>{setInviteOpen(false);setRescheduleMessage(null);}} aria-label="Cerrar"><X size={16}/></button></div><div className="form-two"><label>Día<input type="date" min={new Date().toISOString().slice(0,10)} value={invite.date} onChange={(event)=>setInvite({...invite,date:event.target.value})} required/></label><label>Hora<input type="time" value={invite.time} onChange={(event)=>setInvite({...invite,time:event.target.value})} required/></label></div><label>Dirección o teléfono<input value={invite.place} onChange={(event)=>setInvite({...invite,place:event.target.value})} placeholder="Calle, local o teléfono" required/></label><button className="primary-button" disabled={busy}><Send size={14}/> {rescheduleMessage?"Enviar nueva hora":"Enviar propuesta"}</button></form>}
    <div className="chat-compose"><button className="interview-launch" onClick={()=>setInviteOpen(!inviteOpen)} aria-label="Proponer entrevista"><CalendarDays size={16}/><span>Cita</span></button><form onSubmit={(event)=>void send(event)}><input value={body} onChange={(event)=>setBody(event.target.value)} placeholder="Escribe un mensaje…" maxLength={2000}/><button aria-label="Enviar mensaje" disabled={busy||!body.trim()}><Send size={17}/></button></form></div>
  </section>;
}

function InterviewCard({message,response,userId,onConfirm,onReschedule}:{message:Message;response?:Message;userId:string;onConfirm:(message:Message)=>void;onReschedule:(message:Message)=>void}){
  const meta=message.metadata as InterviewDraft & {status?:string};
  const responseMeta=response?.metadata as (InterviewDraft & {status?:string})|undefined;
  const date=meta.date?new Date(`${meta.date}T${meta.time||"12:00"}`).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}):"Fecha por confirmar";
  const sentByCurrentUser = message.sender_id === userId;
  const canRespond = !sentByCurrentUser && (!response || response.sender_id !== userId);
  return <div className="interview-card"><span className="interview-tag"><CalendarPlus size={14}/> PROPUESTA DE ENTREVISTA</span><h4>Nos vemos para hablar del puesto</h4><p><Clock3 size={14}/>{responseMeta?.status==="reschedule"&&responseMeta.date?new Date(`${responseMeta.date}T${responseMeta.time||"12:00"}`).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}):date} · {responseMeta?.status==="reschedule"?responseMeta.time:meta.time}</p><p><MapPin size={14}/>{responseMeta?.status==="reschedule"?responseMeta.place:meta.place}</p>{responseMeta?.status==="confirmed"?<div className="interview-status"><Check size={15}/> Asistencia confirmada</div>:sentByCurrentUser||!canRespond?<div className="interview-pending">⏳ Pendiente de confirmación</div>:<div className="interview-actions"><button onClick={()=>onConfirm(response?.metadata.status==="reschedule"?response:message)}><Check size={14}/> {responseMeta?.status==="reschedule"?"Confirmar hora":"Confirmar asistencia"}</button><button onClick={()=>onReschedule(response?.metadata.status==="reschedule"?response:message)}>Proponer otra hora</button></div>}</div>;
}
