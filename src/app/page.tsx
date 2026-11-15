"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppWindow, BriefcaseBusiness, ChevronDown, Compass, Filter, LogOut, MessageCircle, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { CardEditor } from "@/components/CardEditor";
import { MatchChat } from "@/components/MatchChat";
import { MatchedProfileSheet } from "@/components/MatchedProfileSheet";
import { Avatar } from "@/components/Avatar";
import { ProfileBaseEditor } from "@/components/ProfileBaseEditor";
import { SwipeDeck, type DeckCard } from "@/components/SwipeDeck";
import { supabase, type JobOffer, type Match, type Profile, type Role, type SwipeDirection, type WorkerCard } from "@/lib/supabase";

type View = "discover" | "matches";
type SwipeUndo = { id: string; card: DeckCard };
type Stats = { views: number; likes: number; matches: number };

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2-lat1), dLng = rad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(a));
}

export default function HomePage() {
  const [user,setUser] = useState<{id:string;email?:string}|null>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [workerCard,setWorkerCard] = useState<WorkerCard|null>(null);
  const [offers,setOffers] = useState<JobOffer[]>([]);
  const [selectedOfferId,setSelectedOfferId] = useState("");
  const [cards,setCards] = useState<DeckCard[]>([]);
  const [matches,setMatches] = useState<Match[]>([]);
  const [view,setView] = useState<View>("discover");
  const [editing,setEditing] = useState(false);
  const [activeMatch,setActiveMatch] = useState<Match|null>(null);
  const [profileMatch,setProfileMatch] = useState<Match|null>(null);
  const [profileBaseOpen,setProfileBaseOpen] = useState(false);
  const [newMatch,setNewMatch] = useState<Match|null>(null);
  const [loading,setLoading] = useState(true);
  const [booting,setBooting] = useState(true);
  const [notice,setNotice] = useState("");
  const [successToast,setSuccessToast] = useState("");
  const successToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [distance,setDistance] = useState(25);
  const [sector,setSector] = useState("Todos los sectores");
  const [minSalary,setMinSalary] = useState(0);
  const [availability,setAvailability] = useState("Todas las disponibilidades");
  const [undo,setUndo] = useState<SwipeUndo|null>(null);
  const [stats,setStats] = useState<Stats>({views:0,likes:0,matches:0});
  const swipeInProgress = useRef(false);
  const swipeSequence = useRef(0);
  const [realtimeRecoveryKey,setRealtimeRecoveryKey] = useState(0);

  function showSuccessToast(message:string){
    if(successToastTimer.current)clearTimeout(successToastTimer.current);
    setSuccessToast(message);
    successToastTimer.current=setTimeout(()=>setSuccessToast(""),3000);
  }

  useEffect(()=>()=>{if(successToastTimer.current)clearTimeout(successToastTimer.current);},[]);

  useEffect(()=>{
    const demoReadyMessage="Perfiles de ejemplo listos para volver a probar.";
    if(notice!==demoReadyMessage)return;
    const timer=setTimeout(()=>setNotice((current)=>current===demoReadyMessage?"":current),2500);
    return()=>clearTimeout(timer);
  },[notice]);

  const selectedOffer = offers.find((offer)=>offer.id===selectedOfferId && offer.is_active) ?? null;
  const activeIdentityName = profile?.role === "worker"
    ? profile.full_name || workerCard?.full_name || "Trabajador"
    : profile?.role === "company"
      ? profile.company_name || offers.find((offer)=>offer.company_id===profile.id)?.business_name || "Mi empresa"
      : "Mi perfil";
  const activeIdentityAvatar = profile?.role === "worker" ? profile.avatar_url : profile?.role === "company" ? profile.company_logo_url : null;

  const loadAccount = useCallback(async (userId:string) => {
    if (!supabase) { setBooting(false); return; }
    const {data:profileData,error:profileError} = await supabase.from("jobmatch_profiles").select("*").eq("id",userId).maybeSingle();
    if (profileError) { setNotice(profileError.message); setBooting(false); return; }
    if (!profileData) { setProfile(null); setWorkerCard(null); setOffers([]); setBooting(false); return; }
    setProfile(profileData as Profile);
    const [workerResult,offerResult] = await Promise.all([
      supabase.from("jobmatch_worker_cards").select("*").eq("user_id",userId).maybeSingle(),
      supabase.from("jobmatch_job_offers").select("*").eq("company_id",userId).order("created_at",{ascending:false}),
    ]);
    setWorkerCard(workerResult.data as WorkerCard|null);
    const nextOffers=(offerResult.data??[]) as JobOffer[];
    setOffers(nextOffers);
    setSelectedOfferId((current)=>nextOffers.some((offer)=>offer.id===current && offer.is_active)?current:nextOffers.find((offer)=>offer.is_active)?.id??"");
    setBooting(false);
  },[]);

  useEffect(()=>{
    if (!supabase) { setBooting(false); return; }
    let cancelled=false;
    void supabase.auth.getSession().then(({data})=>{
      if(cancelled)return;
      const current=data.session?.user;
      setUser(current?{id:current.id,email:current.email}:null);
      if(current)void loadAccount(current.id); else setBooting(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const current=session?.user;
      setUser(current?{id:current.id,email:current.email}:null);
      if(current)void loadAccount(current.id); else {setProfile(null);setWorkerCard(null);setOffers([]);setBooting(false);}
    });
    let removeAppListener:(()=>void)|undefined;
    if(Capacitor.isNativePlatform()) void import("@capacitor/app").then(({App})=>App.addListener("appUrlOpen",async({url})=>{
      if(!url.includes("auth/callback") || !supabase)return;
      const parsed=new URL(url), params=new URLSearchParams(parsed.hash.slice(1));
      const accessToken=params.get("access_token"),refreshToken=params.get("refresh_token"),code=parsed.searchParams.get("code");
      if(accessToken && refreshToken) await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
      else if(code) await supabase.auth.exchangeCodeForSession(code);
      const {Browser}=await import("@capacitor/browser"); await Browser.close();
    }).then((listener)=>{removeAppListener=()=>{void listener.remove();};}));
    return ()=>{cancelled=true;subscription.unsubscribe();removeAppListener?.();};
  },[loadAccount]);

  const hydrateMatch=useCallback(async(match:Match):Promise<Match>=>{
    if(!supabase||!profile)return match;
    const [workerResult,offerResult,messageResult]=await Promise.all([
      supabase.from("jobmatch_worker_cards").select("full_name,photo_path,desired_position").eq("id",match.worker_card_id).maybeSingle(),
      supabase.from("jobmatch_job_offers").select("business_name,business_image_path,position").eq("id",match.job_offer_id).maybeSingle(),
      supabase.from("jobmatch_messages").select("body,created_at,sender_id").eq("match_id",match.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    const otherName=profile.role==="worker"?offerResult.data?.business_name:workerResult.data?.full_name;
    const otherPhoto=profile.role==="worker"?offerResult.data?.business_image_path:workerResult.data?.photo_path;
    const readAt=profile.role==="worker"?match.last_read_at_worker:match.last_read_at_company;
    const last=messageResult.data;
    return {...match,other_name:otherName??"Contacto",other_photo:otherPhoto??null,position:offerResult.data?.position??workerResult.data?.desired_position??"Puesto",preview:last?.body??"¡Hay Match! Ya podéis hablar.",preview_at:last?.created_at??match.created_at,unread:Boolean(last&&last.sender_id!==profile.id&&(!readAt||new Date(last.created_at)>new Date(readAt)))};
  },[profile]);

  const loadMatches=useCallback(async()=>{
    if(!supabase||!profile)return;
    const column=profile.role==="worker"?"worker_id":"company_id";
    const {data}=await supabase.from("jobmatch_matches").select("*").eq(column,profile.id).order("created_at",{ascending:false});
    const enriched=await Promise.all(((data??[]) as Match[]).map(hydrateMatch));
    setMatches(enriched);setStats((current)=>({...current,matches:enriched.length}));
  },[profile,hydrateMatch]);
  const refreshMatches=useCallback(()=>{void loadMatches();},[loadMatches]);
  useEffect(()=>{void loadMatches();},[loadMatches]);
  useEffect(()=>{
    if(!supabase||!profile)return;
    const channel=supabase.channel(`jobmatch-match-feed-${profile.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"jobmatch_matches"},async(payload)=>{
      const match=payload.new as Match;if(match.worker_id!==profile.id&&match.company_id!==profile.id)return;
      const enriched=await hydrateMatch(match);setMatches((current)=>current.some((item)=>item.id===match.id)?current:[enriched,...current]);setNewMatch(enriched);
    }).subscribe();
    return()=>{void supabase?.removeChannel(channel);};
  },[profile,hydrateMatch,realtimeRecoveryKey]);

  const loadDeck=useCallback(async()=>{
    if(!profile?.role||!supabase)return;
    if(profile.role==="company"&&!selectedOffer){setCards([]);setLoading(false);return;}
    if(profile.role==="worker"&&!workerCard){setCards([]);setLoading(false);return;}
    setLoading(true);
    try{
      if(profile.role==="company"){
        const offer=selectedOffer!;
        const [{data:rows},{data:prior},{data:interests}]=await Promise.all([
          supabase.from("jobmatch_worker_cards").select("*").eq("is_active",true).limit(160),
          supabase.from("jobmatch_swipes").select("worker_card_id").eq("actor_id",profile.id).eq("job_offer_id",offer.id),
          supabase.from("jobmatch_swipes").select("worker_card_id").eq("actor_role","worker").eq("job_offer_id",offer.id).eq("direction","right"),
        ]);
        const seen=new Set((prior??[]).map((row)=>row.worker_card_id)), interested=new Set((interests??[]).map((row)=>row.worker_card_id));
        const centerLat=profile.lat??offer.lat,centerLng=profile.lng??offer.lng;
        const candidates=((rows??[]) as WorkerCard[]).filter((item)=>item.user_id!==profile.id&&!seen.has(item.id)).map((item)=>({...item,distanceKm:distanceKm(centerLat,centerLng,item.lat,item.lng),interested:interested.has(item.id)})).filter((item)=>item.distanceKm!<=distance&&(sector==="Todos los sectores"||item.sector===sector)&&(availability==="Todas las disponibilidades"||item.availability===availability));
        candidates.sort((a,b)=>Number(b.is_demo)-Number(a.is_demo)||Number(b.is_featured)-Number(a.is_featured)||a.distanceKm!-b.distanceKm!);
        setCards(candidates);
        if(candidates.length)void supabase.from("jobmatch_card_views").insert({viewer_id:profile.id,worker_card_id:candidates[0].id,job_offer_id:null});
      }else{
        const ownCard=workerCard!;
        const [{data:rows},{data:prior}]=await Promise.all([
          supabase.from("jobmatch_job_offers").select("*").eq("is_active",true).gt("expires_at",new Date().toISOString()).limit(180),
          supabase.from("jobmatch_swipes").select("job_offer_id").eq("actor_id",profile.id).eq("worker_card_id",ownCard.id),
        ]);
        const seen=new Set((prior??[]).map((row)=>row.job_offer_id));
        const candidates=((rows??[]) as JobOffer[]).filter((item)=>item.company_id!==profile.id&&!seen.has(item.id)&&(sector==="Todos los sectores"||item.sector===sector)&&(item.salary_amount??0)>=minSalary).map((item)=>({...item,distanceKm:distanceKm(profile.lat??ownCard.lat,profile.lng??ownCard.lng,item.lat,item.lng)})).filter((item)=>item.distanceKm!<=distance&&(availability==="Todas las disponibilidades"||item.shift_type===availability));
        candidates.sort((a,b)=>Number(b.is_demo)-Number(a.is_demo)||a.distanceKm!-b.distanceKm!);setCards(candidates);
        if(candidates.length)void supabase.from("jobmatch_card_views").insert({viewer_id:profile.id,worker_card_id:null,job_offer_id:candidates[0].id});
      }
    }catch(cause){setNotice(cause instanceof Error?cause.message:"No se pudieron cargar las tarjetas.");setCards([]);}
    finally{setLoading(false);}
  },[profile,selectedOffer,workerCard,distance,sector,minSalary,availability]);
  useEffect(()=>{void loadDeck();},[loadDeck]);

  const loadStats=useCallback(async()=>{
    if(!supabase||!profile)return;
    const column=profile.role==="worker"?"worker_id":"company_id";
    const matchPromise=supabase.from("jobmatch_matches").select("id",{count:"exact",head:true}).eq(column,profile.id);
    const target=profile.role==="worker"?workerCard?.id:offers.filter((offer)=>offer.company_id===profile.id).map((offer)=>offer.id);
    if(!target||Array.isArray(target)&&!target.length){const {count}=await matchPromise;setStats({views:0,likes:0,matches:count??0});return;}
    const viewsPromise=profile.role==="worker"
      ?supabase.from("jobmatch_card_views").select("id",{count:"exact",head:true}).eq("worker_card_id",target as string)
      :supabase.from("jobmatch_card_views").select("id",{count:"exact",head:true}).in("job_offer_id",target as string[]);
    const likesPromise=profile.role==="worker"
      ?supabase.from("jobmatch_swipes").select("id",{count:"exact",head:true}).eq("actor_role","company").eq("worker_card_id",target as string).in("direction",["right","super"])
      :supabase.from("jobmatch_swipes").select("id",{count:"exact",head:true}).eq("actor_role","worker").in("job_offer_id",target as string[]).eq("direction","right");
    const [viewResult,likeResult,matchResult]=await Promise.all([viewsPromise,likesPromise,matchPromise]);
    setStats({views:viewResult.count??0,likes:likeResult.count??0,matches:matchResult.count??0});
  },[profile,workerCard,offers]);
  useEffect(()=>{if(settingsOpen)void loadStats();},[settingsOpen,loadStats]);

  async function decide(card:DeckCard,direction:SwipeDirection){
    if(!supabase||!profile?.role||swipeInProgress.current)return;
    const company=profile.role==="company";
    const row={actor_id:profile.id,actor_role:profile.role,worker_card_id:company?card.id:workerCard?.id,job_offer_id:company?selectedOffer?.id:card.id,direction};
    if(!row.worker_card_id||!row.job_offer_id)return;
    swipeInProgress.current=true;
    const operation=++swipeSequence.current;
    setUndo(null);
    setCards((current)=>current.filter((item)=>item.id!==card.id));
    try {
      const {swipeId,match,matchError}=await withTimeout((async()=>{
        const {data,error}=await supabase.from("jobmatch_swipes").upsert(row,{onConflict:"actor_id,worker_card_id,job_offer_id",ignoreDuplicates:true}).select("id").maybeSingle();
        if(error)throw error;
        let insertedId=data?.id;
        if(!insertedId){const existing=await supabase.from("jobmatch_swipes").select("id").eq("actor_id",profile.id).eq("worker_card_id",row.worker_card_id!).eq("job_offer_id",row.job_offer_id!).maybeSingle();if(existing.error)throw existing.error;insertedId=existing.data?.id;}
        if(!insertedId)throw new Error("No se pudo confirmar el swipe guardado.");
        const matchResult=await supabase.from("jobmatch_matches").select("id").eq("worker_card_id",row.worker_card_id!).eq("job_offer_id",row.job_offer_id!).maybeSingle();
        return {swipeId:insertedId,match:matchResult.data,matchError:matchResult.error};
      })(),6000,"La conexión tardó demasiado. El mazo se ha desbloqueado; vuelve a intentarlo.");
      if(operation!==swipeSequence.current)return;
      if(matchError)setNotice(matchError.message);
      setUndo(match?null:{id:swipeId,card});
      if(match)void loadMatches();
    } catch(cause) {
      if(operation===swipeSequence.current){setCards((current)=>current.some((item)=>item.id===card.id)?current:[card,...current]);setNotice(cause instanceof Error?cause.message:"No se pudo guardar el swipe. La tarjeta se ha restaurado.");}
    } finally { if(operation===swipeSequence.current)swipeInProgress.current=false; }
  }

  const recoverAfterResume=useCallback(()=>{
    swipeSequence.current+=1;swipeInProgress.current=false;
    try{supabase?.realtime.connect();}catch(error){console.warn("JobMatch: no se pudo solicitar la reconexión de Realtime",error);}
    setRealtimeRecoveryKey((value)=>value+1);
    if(view==="discover")void loadDeck();
  },[loadDeck,view]);

function withTimeout<T>(request:PromiseLike<T>,milliseconds:number,message:string):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  return Promise.race([Promise.resolve(request),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]).finally(()=>clearTimeout(timer!));
}

  async function undoLast(){
    if(!supabase||!user||!undo)return;
    const {error}=await supabase.from("jobmatch_swipes").delete().eq("id",undo.id).eq("actor_id",user.id);
    if(error){setNotice(error.message);return;}
    setCards((current)=>[undo.card,...current]);setUndo(null);
  }
  async function resetDemoSwipes(){
    if(!supabase||!profile)return;
    setLoading(true);
    try {
      if(profile.role==="worker"){
        if(!workerCard){setNotice("Completa primero tu ficha de trabajador.");setLoading(false);return;}
        const {data:demos,error:demoError}=await supabase.from("jobmatch_job_offers").select("id").eq("is_demo",true);
        if(demoError)throw demoError;
        const ids=(demos??[]).map((item)=>item.id);
        if(ids.length){const {error}=await supabase.from("jobmatch_swipes").delete().eq("actor_id",profile.id).eq("actor_role","worker").eq("worker_card_id",workerCard.id).in("job_offer_id",ids);if(error)throw error;}
      }else{
        const {data:demos,error:demoError}=await supabase.from("jobmatch_worker_cards").select("id").eq("is_demo",true);
        if(demoError)throw demoError;
        const ids=(demos??[]).map((item)=>item.id);
        if(ids.length){const {error}=await supabase.from("jobmatch_swipes").delete().eq("actor_id",profile.id).eq("actor_role","company").in("worker_card_id",ids);if(error)throw error;}
      }
      setUndo(null);setNotice("Perfiles de ejemplo listos para volver a probar.");await loadDeck();
    }catch(cause){setNotice(cause instanceof Error?cause.message:"No se pudieron reiniciar los perfiles de ejemplo.");setLoading(false);}
  }
  async function signIn(){
    if(!supabase)return;
    if(Capacitor.isNativePlatform()){
      const [{Browser}]=await Promise.all([import("@capacitor/browser")]);
      const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:"es.nebuladigitalstudio.jobmatch://auth/callback",skipBrowserRedirect:true}});
      if(error){setNotice(error.message);return;}if(data.url)await Browser.open({url:data.url});return;
    }
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/`}});
    if(error)setNotice(error.message);
  }
  async function chooseRole(role:Role){
    if(!supabase||!user)return;
    const {error}=await supabase.from("jobmatch_profiles").upsert({id:user.id,role,display_name:user.email?.split("@")[0]??"",onboarding_complete:false},{onConflict:"id"});
    if(error){setNotice(error.message);return;}await loadAccount(user.id);setEditing(true);
  }
  async function changeRole(role:Role){
    if(!supabase||!profile||profile.role===role)return;
    setLoading(true);setCards([]);setUndo(null);
    const {error}=await supabase.from("jobmatch_profiles").update({role}).eq("id",profile.id);
    if(error){setNotice(error.message);setLoading(false);return;}
    setSelectedOfferId(role==="company"?offers.find((offer)=>offer.is_active)?.id??"":"");
    setDistance(25);setSector("Todos los sectores");setMinSalary(0);setAvailability("Todas las disponibilidades");
    setMatches((current)=>current.filter((match)=>role==="worker"?match.worker_id===profile.id:match.company_id===profile.id));
    setProfile({...profile,role});setActiveMatch(null);setProfileMatch(null);
  }
  async function toggleOffer(offer:JobOffer){
    if(!supabase||!profile)return;
    const {error}=await supabase.from("jobmatch_job_offers").update({is_active:!offer.is_active,expires_at:!offer.is_active?new Date(Date.now()+14*86400000).toISOString():offer.expires_at}).eq("id",offer.id).eq("company_id",profile.id);
    if(error){setNotice(error.message);return;}
    const next=offers.map((item)=>item.id===offer.id?{...item,is_active:!offer.is_active}:item);setOffers(next);
    if(offer.is_active&&selectedOfferId===offer.id)setSelectedOfferId(next.find((item)=>item.is_active&&item.id!==offer.id)?.id??"");
    else if(!offer.is_active)setSelectedOfferId(offer.id);
  }
  async function markMatchRead(match:Match){
    if(!supabase)return;
    const {error}=await supabase.rpc("jobmatch_mark_match_read",{p_match_id:match.id});
    if(error)setNotice(error.message);
    const updated={...match,last_read_at_worker:profile?.role==="worker"?new Date().toISOString():match.last_read_at_worker,last_read_at_company:profile?.role==="company"?new Date().toISOString():match.last_read_at_company,unread:false};
    setActiveMatch(updated);setMatches((current)=>current.map((item)=>item.id===match.id?updated:item));
  }
  async function signOut(){await supabase?.auth.signOut();setUser(null);setProfile(null);setView("discover");setSettingsOpen(false);}

  if(!supabase)return <main className="splash"><div className="brand-mark">j.</div><h1>Conecta Supabase</h1><p>Copia <code>.env.example</code> a <code>.env.local</code> y añade las variables públicas del proyecto.</p></main>;
  if(booting)return <main className="splash"><div className="brand-mark">j.</div><div className="loader"/><p>Preparando JobMatch…</p></main>;
  if(!user)return <main className="auth-screen"><section className="auth-card"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><div className="auth-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="center-spark">✳</div><span className="float-tag tag-one">Talento cerca</span><span className="float-tag tag-two">Trabajo real</span></div><span className="eyebrow">EMPLEO QUE EMPIEZA CERCA</span><h1>El próximo match<br/>puede ser <em>aquí.</em></h1><p>Conexiones laborales de verdad, a pocos kilómetros. Un gesto para descubrir, otro para conectar.</p>{notice&&<div className="form-error" role="alert">{notice}</div>}<button className="google-button" onClick={()=>void signIn()}><GoogleMark/> Continuar con Google</button><small className="auth-terms">Tu perfil profesional solo se comparte con usuarios registrados.</small></section><div className="auth-side-note"><Sparkles size={15}/> Hecho para el empleo local.</div></main>;
  if(!profile?.role)return <main className="role-screen"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><div className="role-copy"><span className="eyebrow">UNA APP · DOS CAMINOS</span><h1>¿Qué te trae<br/>por aquí, <em>{user.email?.split("@")[0]}?</em></h1><p>Elige cómo quieres empezar. Puedes cambiar de modo cuando lo necesites.</p></div><div className="role-cards"><button onClick={()=>void chooseRole("worker")} className="role-card worker-role"><span className="role-icon"><UserRound/></span><span className="eyebrow">BUSCO TRABAJO</span><strong>Soy trabajador/a</strong><p>Descubre ofertas con salario claro y cerca de ti.</p><span className="role-arrow">↗</span></button><button onClick={()=>void chooseRole("company")} className="role-card company-role"><span className="role-icon"><BriefcaseBusiness/></span><span className="eyebrow">BUSCO TALENTO</span><strong>Soy empresa</strong><p>Encuentra talento local y conecta sin intermediarios.</p><span className="role-arrow">↗</span></button></div>{notice&&<p className="form-error">{notice}</p>}</main>;
  const needsSetup=!profile.onboarding_complete||(profile.role==="worker"&&!workerCard);
  if(editing||needsSetup)return <main className="editor-screen"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><CardEditor key={`${profile.role}-${selectedOfferId||"new"}`} profile={profile} existingWorker={workerCard} existingOffer={selectedOffer} offers={offers} onSelectOffer={setSelectedOfferId} onToggleOffer={(offer)=>void toggleOffer(offer)} onCancel={()=>setEditing(false)} onSaved={async()=>{await loadAccount(profile.id);setEditing(false);showSuccessToast(profile.role==="worker"?"Ficha guardada correctamente":"Oferta guardada correctamente");}}/></main>;
  return <main className="app-shell">
    <header className="product-header"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><div className="mode-switch" role="group" aria-label="Modo de uso"><motion.span className="mode-indicator" layout transition={{type:"spring",stiffness:440,damping:33}} style={{left:profile.role==="worker"?4:"50%"}}/><button className={profile.role==="worker"?"selected":""} onClick={()=>void changeRole("worker")}><UserRound size={14}/> Trabajador</button><button className={profile.role==="company"?"selected":""} onClick={()=>void changeRole("company")}><BriefcaseBusiness size={14}/> Empresa</button></div><div className="header-tools"><button className="header-tool" onClick={()=>setFiltersOpen(true)} aria-label="Abrir filtros"><Filter size={18}/><span>Filtros</span></button><button className="profile-tool" onClick={()=>setSettingsOpen(true)} aria-label="Perfil y ajustes"><Avatar className="profile-tool-avatar" src={activeIdentityAvatar} name={activeIdentityName}/><span className="profile-tool-name">{activeIdentityName}</span><ChevronDown size={13}/></button></div></header>
    <div className="app-main">
      {view==="discover"?<SwipeDeck role={profile.role} offer={selectedOffer} distance={distance} cards={cards} loading={loading} undoAvailable={Boolean(undo)} pausedOffer={offers.find((item)=>!item.is_active)??null} onActivateOffer={(offer)=>void toggleOffer(offer)} onUndo={()=>void undoLast()} onSwipe={(card,direction)=>void decide(card,direction)} onCreateOffer={()=>{setSelectedOfferId("");setEditing(true);}} onShowFilters={()=>setFiltersOpen(true)} onResetDemo={()=>void resetDemoSwipes()} onRecover={recoverAfterResume}/>:activeMatch?<MatchChat match={activeMatch} profile={profile} onClose={()=>setActiveMatch(null)} onActivity={refreshMatches} onViewProfile={()=>setProfileMatch(activeMatch)}/>:<MatchesView matches={matches} profile={profile} onOpen={(match)=>void markMatchRead(match)} onViewProfile={setProfileMatch}/>}
    </div>
    <nav className="mobile-bottom-nav"><button className={view==="discover"?"active":""} onClick={()=>{setView("discover");setActiveMatch(null);}}><Compass/><span>Descubrir</span></button><button className={view==="matches"?"active":""} onClick={()=>{setView("matches");setActiveMatch(null);}}><MessageCircle/><span>Conexiones</span>{matches.some((match)=>match.unread)&&<i/>}</button><button onClick={()=>setSettingsOpen(true)}><UserRound/><span>Mi perfil</span></button></nav>
    <AnimatePresence>{filtersOpen&&<motion.div className="drawer-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setFiltersOpen(false)}><motion.aside className="filter-drawer" initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",damping:30,stiffness:280}} onClick={(event)=>event.stopPropagation()}><div className="drawer-heading"><div><span className="eyebrow">DESCUBRIR MEJOR</span><h2>Filtros</h2></div><button className="icon-close" onClick={()=>setFiltersOpen(false)} aria-label="Cerrar filtros"><X/></button></div><div className="distance-presets" role="group" aria-label="Rango de distancia"><button className={distance<=10?"selected":""} onClick={()=>setDistance(10)}>Cerca<small>Hasta 10 km</small></button><button className={distance>10&&distance<=25?"selected":""} onClick={()=>setDistance(25)}>Media<small>10–25 km</small></button><button className={distance>25?"selected":""} onClick={()=>setDistance(50)}>Lejos<small>Más de 25 km</small></button></div><label className="filter-control"><span>Distancia máxima <b>{distance} km</b></span><input type="range" min="1" max="50" step="1" value={distance} onChange={(event)=>setDistance(Number(event.target.value))}/><small>Afina el radio desde 1 hasta 50 km.</small></label><label className="filter-control">Sector<select value={sector} onChange={(event)=>setSector(event.target.value)}><option>Todos los sectores</option>{["Hostelería","Comercio","Logística","Atención al cliente","Limpieza","Administración","Construcción","Sanidad","Tecnología","Otro"].map((item)=><option key={item}>{item}</option>)}</select></label>{profile.role==="worker"?<label className="filter-control">Salario mínimo mensual<input type="number" min="0" step="50" value={minSalary} onChange={(event)=>setMinSalary(Number(event.target.value))} placeholder="Sin mínimo"/></label>:<label className="filter-control">Disponibilidad<select value={availability} onChange={(event)=>setAvailability(event.target.value)}><option>Todas las disponibilidades</option><option value="inmediata">Incorporación inmediata</option><option value="fines_de_semana">Fines de semana</option><option value="media_jornada">Media jornada</option><option value="completa">Jornada completa</option></select></label>}{profile.role==="worker"&&<label className="filter-control">Jornada<select value={availability} onChange={(event)=>setAvailability(event.target.value)}><option>Todas las disponibilidades</option><option>Jornada completa</option><option>Media jornada</option><option>Fines de semana</option><option>Turnos rotativos</option></select></label>}<button className="primary-button drawer-apply" onClick={()=>setFiltersOpen(false)}><SlidersHorizontal size={16}/> Ver resultados</button><button className="quiet-button drawer-clear" onClick={()=>{setDistance(25);setSector("Todos los sectores");setMinSalary(0);setAvailability("Todas las disponibilidades");}}>Limpiar filtros</button></motion.aside></motion.div>}</AnimatePresence>
    <AnimatePresence>{settingsOpen&&<motion.div className="drawer-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSettingsOpen(false)}><motion.aside className="profile-drawer" initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",damping:30,stiffness:280}} onClick={(event)=>event.stopPropagation()}><div className="drawer-heading"><div><span className="eyebrow">TU CUENTA</span><h2>Perfil y ajustes</h2></div><button className="icon-close" onClick={()=>setSettingsOpen(false)} aria-label="Cerrar ajustes"><X/></button></div><div className="settings-role-switch mode-switch" role="group" aria-label="Cambiar identidad activa"><motion.span className="mode-indicator" layout transition={{type:"spring",stiffness:440,damping:33}} style={{left:profile.role==="worker"?4:"50%"}}/><button className={profile.role==="worker"?"selected":""} onClick={()=>void changeRole("worker")}><UserRound size={14}/> Trabajador</button><button className={profile.role==="company"?"selected":""} onClick={()=>void changeRole("company")}><BriefcaseBusiness size={14}/> Empresa</button></div><div className="settings-identity"><Avatar className="settings-avatar" src={activeIdentityAvatar} name={activeIdentityName}/><div><b>{activeIdentityName}</b><small>{user.email}</small></div></div><div className="stats-grid"><div><b>{stats.views}</b><span>Vistas recibidas</span></div><div><b>{stats.likes}</b><span>Likes</span></div><div><b>{stats.matches}</b><span>Matches activos</span></div></div><button className="settings-action" onClick={()=>{setSettingsOpen(false);setProfileBaseOpen(true);}}><UserRound size={17}/> Editar Perfil Base <ChevronDown size={15}/></button><button className="settings-action" onClick={()=>setEditing(true)}><BriefcaseBusiness size={17}/> {profile.role==="worker"?"Editar mi ficha de trabajador":"Gestionar mis ofertas de empleo"} <ChevronDown size={15}/></button>{profile.role==="company"&&<div className="settings-offers"><span className="eyebrow">OFERTAS ACTIVAS · {offers.filter((item)=>item.is_active).length}</span>{offers.map((offer)=><div key={offer.id}><span className={`status-dot ${offer.is_active?"online":"offline"}`}/><span>{offer.position}<small>{offer.is_active?"Activa":"Pausada"}</small></span><button onClick={()=>void toggleOffer(offer)}>{offer.is_active?"Pausar":"Reactivar"}</button></div>)}<button className="text-action" onClick={()=>{setSelectedOfferId("");setEditing(true);}}>+ Añadir oferta</button></div>}<button className="settings-action signout-action" onClick={()=>void signOut()}><LogOut size={17}/> Cerrar sesión</button></motion.aside></motion.div>}</AnimatePresence>
    {profileBaseOpen&&<ProfileBaseEditor profile={profile} onClose={()=>setProfileBaseOpen(false)} onSaved={(updated)=>{setProfile((current)=>current?{...current,...updated}:current);setProfileBaseOpen(false);showSuccessToast("Perfil guardado correctamente");void loadAccount(profile.id);}}/>}
    {profileMatch&&<MatchedProfileSheet profileId={profile.role==="worker"?profileMatch.company_id:profileMatch.worker_id} matchId={profileMatch.id} viewerRole={profile.role} onClose={()=>setProfileMatch(null)}/>}
    <AnimatePresence>{newMatch&&<motion.div className="match-modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="match-modal" initial={{scale:.84,y:20}} animate={{scale:1,y:0}} exit={{scale:.92}}><span className="match-burst">✳</span><span className="eyebrow">DOS CAMINOS SE CRUZAN</span><h2>¡Hay <em>Match!</em></h2><div className="match-faces"><span>{profile.display_name?.slice(0,1)||"J"}</span><span>✳</span><span>{newMatch.other_name?.slice(0,1)||"M"}</span></div><b>{newMatch.other_name}</b><p>Match por: {newMatch.position}</p><button className="primary-button" onClick={()=>{setNewMatch(null);setView("matches");void markMatchRead(newMatch);}}><MessageCircle size={16}/> Enviar mensaje ahora</button><button className="quiet-button" onClick={()=>setNewMatch(null)}>Seguir descubriendo</button></motion.div></motion.div>}</AnimatePresence>
    {notice&&<button className="toast" onClick={()=>setNotice("")}>{notice} ×</button>}
    <AnimatePresence>{successToast&&<motion.div className="success-toast" role="status" initial={{opacity:0,y:16,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12}}><span>✓</span>{successToast}</motion.div>}</AnimatePresence>
  </main>;
}

function MatchesView({matches,profile,onOpen,onViewProfile}:{matches:Match[];profile:Profile;onOpen:(match:Match)=>void;onViewProfile:(match:Match)=>void}){
  return <section className="matches-page"><div className="matches-title"><span className="eyebrow">CONEXIONES CON RECIPROCIDAD</span><h1>Lo mejor empieza con un hola.</h1><p>Personas y oportunidades que se eligieron mutuamente.</p></div>{matches.length? <div className="matches-list">{matches.map((match)=><article className="match-row" key={match.id}><button className="match-profile-button" onClick={()=>onViewProfile(match)} aria-label={`Ver perfil ampliado de ${match.other_name}`}><span className="match-contact-avatar" style={match.other_photo?{backgroundImage:`url(${match.other_photo})`}:undefined}>{match.other_photo?null:match.other_name?.slice(0,1)}</span></button><button className="match-copy" onClick={()=>onViewProfile(match)}><b>{match.other_name}</b><small>Match por: {match.position}</small><span>{match.preview}</span></button><div className="match-side"><div className="match-time">{relativeTime(match.preview_at??match.created_at)}{match.unread&&<i/>}</div><button className="match-open-button" onClick={()=>onOpen(match)}><MessageCircle size={14}/> Abrir chat</button></div></article>)}</div>:<div className="empty-matches"><div>✳</div><h2>Las conexiones aparecen aquí</h2><p>Desliza con intención. Cuando el interés es mutuo, empieza la conversación.</p><small>Tu modo actual: {profile.role==="worker"?"Trabajador/a":"Empresa"}</small></div>}</section>;
}
function relativeTime(value:string){const elapsed=Math.max(0,Date.now()-new Date(value).getTime()),minutes=Math.floor(elapsed/60000);if(minutes<1)return"Ahora";if(minutes<60)return`Hace ${minutes} min`;const hours=Math.floor(minutes/60);if(hours<24)return`Hace ${hours} h`;return new Date(value).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});}
function GoogleMark(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4 6.2v5h6.5c3.8-3.5 6.1-8.7 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.5-5c-1.8 1.2-4.1 2-7 2-5.4 0-10-3.6-11.6-8.5H5.7v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.4 27.7a12 12 0 0 1 0-7.4v-5.2H5.7a20 20 0 0 0 0 17.8l6.7-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.7 15.1l6.7 5.2c1.6-4.9 6.2-8.5 11.6-8.5Z"/></svg>}
