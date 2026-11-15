import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Términos y Condiciones | JobMatch", description: "Condiciones de uso de la plataforma JobMatch.", alternates: { canonical: "/terminos" } };

export default function TermsPage() {
  return <LegalPage title="Términos y Condiciones de Uso" updated="15 de noviembre de 2026" intro="Estos términos regulan el acceso y uso de JobMatch, una plataforma digital de conexión laboral local para trabajadores y empresas." sections={[
    { title: "Titular y aceptación", paragraphs: ["JobMatch es el nombre comercial bajo el que opera Antonio Meroño Estañ, persona física, NIF 48828072S, con domicilio en Calle Moriones 14 Bajo BIS, 03182 Torrevieja, Alicante, España. El uso de la aplicación implica la aceptación de estos términos y de la Política de Privacidad." ] },
    { title: "Funcionamiento del servicio", paragraphs: ["JobMatch permite crear perfiles profesionales y ofertas de empleo, descubrir perfiles por proximidad aproximada, expresar interés y conversar cuando existe coincidencia. JobMatch facilita el contacto, pero no es una agencia de colocación, empleador ni parte de los acuerdos que puedan alcanzar los usuarios. La plataforma no garantiza la publicación de ofertas, la contratación ni la veracidad de la información aportada por terceros." ] },
    { title: "Uso responsable", paragraphs: ["El usuario se compromete a facilitar información veraz y actualizada, respetar la legislación aplicable y utilizar la plataforma para fines legítimos de empleo. No se permite suplantar identidades, publicar contenido ilícito o discriminatorio, acosar a otros usuarios, recopilar datos sin autorización, distribuir malware ni intentar eludir las medidas de seguridad." ] },
    { title: "Contenido y disponibilidad", paragraphs: ["Cada usuario conserva la responsabilidad sobre el contenido que publica y declara disponer de derechos para compartirlo. JobMatch puede retirar contenido que infrinja estos términos o la ley. El servicio puede cambiar o interrumpirse temporalmente por mantenimiento, seguridad o causas técnicas." ] },
    { title: "Cuenta y eliminación", paragraphs: ["El usuario debe proteger sus credenciales y es responsable del uso de su cuenta. Puede solicitar o iniciar su eliminación desde Perfil y ajustes; la eliminación suprime los datos asociados a la cuenta dentro de JobMatch, sujeto a las obligaciones legales de conservación que resulten aplicables." ] },
    { title: "Contacto y cambios", paragraphs: ["Para consultas sobre el servicio, escribe a soporte@jobmatch.es. JobMatch puede actualizar estos términos para reflejar cambios legales o funcionales; la versión vigente se publicará en esta página con su fecha de actualización." ] },
  ]} />;
}
