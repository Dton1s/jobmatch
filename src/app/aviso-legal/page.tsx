import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Aviso Legal | Job Match", description: "Información del titular y condiciones legales del sitio Job Match.", alternates: { canonical: "/aviso-legal" } };

export default function LegalNoticePage() {
  return <LegalPage title="Aviso Legal" updated="16 de noviembre de 2026" intro="En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de los datos del titular de este sitio." sections={[
    { title: "Titular del sitio", paragraphs: ["Titular: Antonio Meroño Estañ, persona física autónoma. Marca del servicio: Job Match. Nombre comercial/estudio de gestión: Nebula Digital Studio. NIF: 48828072S. Domicilio: Calle Moriones 14 Bajo BIS, 03182 Torrevieja, Alicante, España. Sitio web: https://job-match.es. Correo de contacto: soporte@job-match.es. Correo de privacidad: privacidad@job-match.es." ] },
    { title: "Objeto", paragraphs: ["Este sitio ofrece información y acceso a la plataforma Job Match, destinada a facilitar conexiones entre trabajadores y empresas. El acceso y la navegación atribuyen la condición de usuario e implican la aceptación de las condiciones publicadas en el sitio." ] },
    { title: "Responsabilidad", paragraphs: ["El titular procura mantener la información actualizada y el servicio disponible, sin garantizar la ausencia de errores o interrupciones. Los enlaces a servicios de terceros se ofrecen como referencia; sus contenidos y políticas corresponden a sus respectivos titulares." ] },
    { title: "Propiedad intelectual", paragraphs: ["Los elementos propios del sitio y de la aplicación están protegidos por la normativa de propiedad intelectual e industrial. No se autoriza su reproducción o explotación fuera de los usos permitidos por la ley sin autorización del titular." ] },
    { title: "Protección de datos", paragraphs: ["El tratamiento de datos personales se describe en la Política de Privacidad. Para ejercer derechos o realizar consultas de privacidad, escribe a privacidad@job-match.es." ] },
  ]} />;
}
