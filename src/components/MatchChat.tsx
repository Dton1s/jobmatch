"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { supabase, type Match, type Profile } from "@/lib/supabase";

type Message = { id: string; match_id: string; sender_id: string; body: string; created_at: string };
const quickReplies = ["¿Puedes pasarte mañana por el local?", "¿Hacemos una llamada rápida hoy o mañana?"];

export function MatchChat({ match, profile, onClose }: { match: Match; profile: Profile; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.from("jobmatch_messages").select("*").eq("match_id", match.id).order("created_at").then(({ data }) => { if (alive) setMessages((data ?? []) as Message[]); });
    const channel = supabase.channel(`jobmatch-chat-${match.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "jobmatch_messages", filter: `match_id=eq.${match.id}` }, (payload) => {
      const next = payload.new as Message;
      setMessages((current) => current.some((message) => message.id === next.id) ? current : [...current, next]);
    }).subscribe();
    return () => { alive = false; void supabase?.removeChannel(channel); };
  }, [match.id]);

  async function send(event?: FormEvent, text = body) {
    event?.preventDefault();
    const content = text.trim();
    if (!content || busy || !supabase) return;
    setBusy(true);
    const { data, error } = await supabase.from("jobmatch_messages").insert({ match_id: match.id, sender_id: profile.id, body: content }).select().single();
    if (!error && data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as Message]);
    if (!error) setBody("");
    setBusy(false);
  }

  return <div className="chat-panel"><header><button className="icon-close" onClick={onClose} aria-label="Volver"><ArrowLeft /></button><div><span className="eyebrow">CONEXIÓN CERCANA</span><strong>Chat de JobMatch</strong></div><i className="online-dot" /></header>
    <div className="chat-messages">{messages.length === 0 && <div className="chat-welcome"><span>✳</span><h3>¡Hay Match!</h3><p>Ya podéis hablar directamente. Un mensaje sencillo abre muchas puertas.</p></div>}{messages.map((message) => <div className={`chat-bubble ${message.sender_id === profile.id ? "mine" : "theirs"}`} key={message.id}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>
    {profile.role === "company" && <div className="quick-replies">{quickReplies.map((reply) => <button key={reply} onClick={() => void send(undefined, reply)}>{reply}</button>)}</div>}
    <form className="chat-composer" onSubmit={(event) => void send(event)}><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escribe un mensaje…" maxLength={2000} /><button className="primary-button" aria-label="Enviar mensaje" disabled={busy || !body.trim()}><Send size={17} /></button></form>
  </div>;
}
