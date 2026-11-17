import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Aviso Legal | Job Match", description: "Identificación del titular y condiciones de acceso al sitio Job Match.", alternates: { canonical: "/aviso-legal" } };

export default function LegalNoticePage() {
  return <LegalPage title="Aviso Legal" updated="17 de noviembre de 2026" intro="Este aviso identifica al titular de job-match.es y describe las condiciones generales de acceso al sitio, conforme a la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico." sections={[
    { title: "Titular del sitio", paragraphs: ["Titular: Antonio Meroño Estañ, trabajador autónomo. Servicio y marca: Job Match. Nombre comercial: Nebula Digital Studio. NIF: 48828072S. Domicilio: Calle Moriones 14 Bajo BIS, 03182 Torrevieja, Alicante, España. Sitio web: https://job-match.es. Contacto: soporte@job-match.es. Privacidad y protección de datos: privacidad@job-match.es."] },
    { title: "Objeto y condiciones de acceso", paragraphs: ["Este sitio ofrece información y acceso a Job Match, una plataforma que facilita el contacto entre personas que buscan empleo y empresas. La navegación debe realizarse de forma lícita y respetando este aviso, los Términos y Condiciones y la Política de Privacidad. Las funciones que requieren cuenta están sujetas además a las condiciones de uso de la plataforma."] },
    { title: "Responsabilidad y enlaces externos", paragraphs: ["El titular procura mantener la información actualizada y el sitio disponible, pero pueden producirse errores, tareas de mantenimiento o interrupciones por causas técnicas o ajenas a su control. Los enlaces a sitios de terceros se facilitan para comodidad del usuario; sus contenidos, disponibilidad y políticas son responsabilidad de sus respectivos titulares."] },
    { title: "Propiedad intelectual e industrial", paragraphs: ["Los contenidos, diseños, textos, elementos gráficos, logotipos y demás materiales propios de Job Match están protegidos por la normativa de propiedad intelectual e industrial. No se permite su reproducción, distribución o explotación fuera de los usos autorizados por la ley sin autorización previa del titular."] },
    { title: "Protección de datos", paragraphs: ["El tratamiento de datos personales se explica en la Política de Privacidad. Para ejercer derechos o realizar consultas relacionadas con privacidad, escribe a privacidad@job-match.es."] },
  ]} />;
}
