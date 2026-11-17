import Link from "next/link";

type LegalSection = { title: string; paragraphs: string[]; bullets?: string[] };

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return <main className="legal-screen"><article className="legal-document"><Link href="/" className="legal-back">← Volver a Job Match</Link><Link href="/" className="brand-lockup legal-brand" aria-label="Job Match, inicio"><img className="brand-logo" src="/branding/jobmatch-logo.png" alt="Job Match" width={156} height={52}/></Link><span className="eyebrow">INFORMACIÓN LEGAL</span><h1>{title}</h1><p className="legal-updated">Última actualización: {updated}</p><p className="legal-intro">{intro}</p>{sections.map((section)=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}{section.bullets&&<ul>{section.bullets.map((item)=><li key={item}>{item}</li>)}</ul>}</section>)}<footer><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos</Link><Link href="/aviso-legal">Aviso legal</Link><Link href="/eliminar-cuenta">Eliminar cuenta</Link></footer></article></main>;
}
