-- Job Match: 200 fichas ficticias de trabajador + 100 ofertas ficticias.
-- No crea usuarios en auth.users ni perfiles propietarios: son datos de muestra
-- para probar descubrimiento y filtros, con is_demo=true y propietarios NULL.
-- Repetible: IDs deterministas y UPSERT. La app debe mantener visibles las
-- etiquetas de muestra y bloquear matches, chat y pagos para estas filas.
-- Para retirar SOLO estas 300 filas, usa el bloque comentado al final.
-- Requiere el esquema JobMatch y sus migraciones de monetización actuales.

begin;

-- ---------------------------------------------------------------------------
-- 200 perfiles de trabajador. Columnas ajustadas a jobmatch_worker_cards.
-- ---------------------------------------------------------------------------
with
worker_catalog(n, sector, position, skills, bio) as (
  values
    (1, 'Hostelería', 'Camarero/a de sala y barra', array['Servicio en sala','TPV','Atención al cliente'], 'Experiencia en servicio de sala, preparación de bebidas y atención cercana. Se desenvuelve bien en turnos de alta actividad.'),
    (2, 'Hostelería', 'Ayudante de cocina', array['Preparación','Higiene alimentaria','Trabajo en equipo'], 'Apoyo en preparación de ingredientes, limpieza de estación y organización de cámaras según las normas de higiene.'),
    (3, 'Hostelería', 'Recepcionista de alojamiento', array['Reservas','Atención telefónica','Inglés'], 'Gestión de reservas, recepción de huéspedes y resolución de consultas. Manejo de herramientas ofimáticas y atención en inglés.'),
    (4, 'Comercio', 'Dependiente/a de tienda', array['Caja','Reposición','Venta asistida'], 'Atención en tienda, reposición de producto y apoyo en caja. Interés por ofrecer una experiencia amable y ordenada.'),
    (5, 'Comercio', 'Cajero/a y reponedor/a', array['Cobro','Control de stock','Atención al público'], 'Experiencia en cobro, reposición y control básico de existencias. Disponible para colaborar con el equipo de tienda.'),
    (6, 'Logística', 'Mozo/a de almacén', array['Preparación de pedidos','Picking','Inventario'], 'Preparación y empaquetado de pedidos, recepción de mercancía y mantenimiento del orden en almacén.'),
    (7, 'Logística', 'Repartidor/a de última milla', array['Reparto','Planificación de rutas','Atención al cliente'], 'Organización de rutas de reparto y entrega puntual. Acostumbrado/a a tratar con clientes y cuidar la mercancía.'),
    (8, 'Limpieza', 'Personal de limpieza', array['Limpieza profesional','Organización','Puntualidad'], 'Limpieza de espacios comerciales y alojamientos, reposición de consumibles y atención a los detalles.'),
    (9, 'Atención al cliente', 'Agente de atención al cliente', array['Comunicación','Resolución de incidencias','Ofimática'], 'Atención de consultas por teléfono y correo, seguimiento de incidencias y registro claro de cada gestión.'),
    (10, 'Administración', 'Auxiliar administrativo/a', array['Excel','Archivo','Facturación'], 'Apoyo administrativo, gestión documental, atención telefónica y actualización de hojas de cálculo.'),
    (11, 'Construcción', 'Oficial de mantenimiento', array['Mantenimiento','Reparaciones','Seguridad'], 'Mantenimiento general y pequeñas reparaciones. Trabaja con orden y sigue los procedimientos de seguridad.'),
    (12, 'Sanidad', 'Auxiliar de clínica', array['Recepción','Citas','Atención al paciente'], 'Recepción de pacientes, gestión de citas y apoyo administrativo en centros de salud.'),
    (13, 'Tecnología', 'Técnico/a de soporte informático', array['Soporte técnico','Windows','Redes básicas'], 'Atención de incidencias de equipos y aplicaciones, instalación de programas y ayuda a usuarios.'),
    (14, 'Otro', 'Auxiliar de servicios', array['Organización','Trabajo en equipo','Atención'], 'Apoyo en tareas operativas y de atención, con buena disposición para aprender procesos nuevos.')
),
locations(n, city, lat, lng) as (
  values
    (1, 'Torrevieja', 37.9786::double precision, -0.6822::double precision),
    (2, 'Orihuela Costa', 37.9292, -0.7354),
    (3, 'Guardamar del Segura', 38.0901, -0.6551),
    (4, 'Orihuela', 38.0840, -0.9440),
    (5, 'Pilar de la Horadada', 37.8659, -0.7926),
    (6, 'Rojales', 38.0875, -0.7250),
    (7, 'Los Montesinos', 38.0280, -0.6465),
    (8, 'San Miguel de Salinas', 37.9797, -0.7890),
    (9, 'Elche', 38.2660, -0.6983),
    (10, 'Alicante', 38.3452, -0.4810)
),
generated as (
  select
    g.i,
    c.sector,
    c.position,
    c.skills,
    c.bio,
    l.city,
    l.lat + (((g.i % 7) - 3) * 0.0010::double precision) as lat,
    l.lng + (((g.i % 9) - 4) * 0.0010::double precision) as lng,
    (20 + (g.i % 33))::smallint as age,
    (g.i % 16)::numeric(4,1) as experience_years,
    (1000 + ((g.i * 37) % 701))::integer as salary_target,
    (array['inmediata','fines_de_semana','media_jornada','completa'])[((g.i - 1) % 4) + 1] as availability,
    (array['Esta semana','Incorporación flexible','A partir del próximo mes','Disponibilidad inmediata'])[((g.i - 1) % 4) + 1] as availability_note
  from generate_series(1, 200) as g(i)
  join worker_catalog c on c.n = ((g.i - 1) % 14) + 1
  join locations l on l.n = ((g.i - 1) % 10) + 1
)
insert into public.jobmatch_worker_cards (
  id, user_id, full_name, age, photo_path, desired_position, sector,
  experience_years, availability, availability_note, skills, bio, city, lat, lng,
  is_active, is_demo, is_featured, is_boosted, boost_expires_at, created_at, updated_at
)
select
  md5('jobmatch-massive-demo-worker-' || i)::uuid,
  null,
  format('%s %s · muestra %s',
    (array['Aina','Leo','Nora','Hugo','Lía','Gael','Vera','Izan','Mara','Enzo','Noa','Eric','Alba','Teo','Inés','Nil','Iris','Joel','Ema','Dario'])[((i - 1) % 20) + 1],
    (array['Brisa','Oliva','Nácar','Azahar','Salina','Mistral','Llevant','Marjal','Duna','Senda'])[((i - 1) % 10) + 1],
    lpad(i::text, 3, '0')),
  age,
  'https://api.dicebear.com/9.x/personas/svg?seed=JobMatch-muestra-trabajador-' || lpad(i::text, 3, '0') || '&backgroundColor=e8f5d0,c0f2d2,d1e9ff',
  position,
  sector,
  experience_years,
  availability::public.jobmatch_availability,
  availability_note,
  skills,
  bio || format(' Perfil ficticio de muestra. Expectativa orientativa: %s €/mes bruto.', salary_target),
  city,
  lat,
  lng,
  true,
  true,
  false,
  false,
  null,
  now() - ((i % 20) || ' days')::interval,
  now()
from generated
on conflict (id) do update set
  user_id = null,
  full_name = excluded.full_name,
  age = excluded.age,
  photo_path = excluded.photo_path,
  desired_position = excluded.desired_position,
  sector = excluded.sector,
  experience_years = excluded.experience_years,
  availability = excluded.availability,
  availability_note = excluded.availability_note,
  skills = excluded.skills,
  bio = excluded.bio,
  city = excluded.city,
  lat = excluded.lat,
  lng = excluded.lng,
  is_active = true,
  is_demo = true,
  is_featured = false,
  is_boosted = false,
  boost_expires_at = null,
  updated_at = now()
where public.jobmatch_worker_cards.is_demo = true;

-- ---------------------------------------------------------------------------
-- 100 ofertas ficticias. Columnas ajustadas a jobmatch_job_offers.
-- company_id NULL: no se atribuyen anuncios a empresas reales.
-- ---------------------------------------------------------------------------
with
offer_catalog(n, sector, position, business_type, description, base_salary) as (
  values
    (1, 'Hostelería', 'Camarero/a de sala', 'cafetería', 'Atención de mesas, preparación de sala y colaboración con el equipo durante el servicio.', 1350),
    (2, 'Hostelería', 'Ayudante de cocina', 'restaurante', 'Preparación de ingredientes, apoyo en partidas y mantenimiento de la limpieza de cocina.', 1400),
    (3, 'Comercio', 'Dependiente/a', 'tienda de barrio', 'Atención al público, reposición, control básico de stock y apoyo en caja.', 1250),
    (4, 'Comercio', 'Cajero/a y reponedor/a', 'comercio de alimentación', 'Cobro en caja, reposición de lineales y revisión de fechas y presentación del producto.', 1300),
    (5, 'Logística', 'Mozo/a de almacén', 'almacén de distribución', 'Recepción y preparación de mercancía, picking y mantenimiento del orden en el almacén.', 1500),
    (6, 'Logística', 'Repartidor/a', 'servicio local de reparto', 'Reparto de pedidos en la zona, planificación de rutas y atención en la entrega.', 1450),
    (7, 'Limpieza', 'Personal de limpieza', 'servicios de limpieza', 'Limpieza y puesta a punto de espacios, reposición de materiales y revisión del resultado.', 1200),
    (8, 'Atención al cliente', 'Agente de atención al cliente', 'servicio de atención', 'Atención de consultas, registro de solicitudes y seguimiento de incidencias.', 1350),
    (9, 'Administración', 'Auxiliar administrativo/a', 'oficina de servicios', 'Apoyo documental, gestión de citas, atención telefónica y tareas administrativas generales.', 1500),
    (10, 'Construcción', 'Operario/a de mantenimiento', 'servicios de mantenimiento', 'Pequeñas reparaciones y mantenimiento preventivo en instalaciones de la zona.', 1650),
    (11, 'Sanidad', 'Recepcionista de clínica', 'centro sanitario', 'Recepción, gestión de agenda y apoyo administrativo con atención cuidadosa al paciente.', 1450),
    (12, 'Tecnología', 'Técnico/a de soporte', 'servicio técnico', 'Resolución de incidencias informáticas de primer nivel y preparación de equipos.', 1750),
    (13, 'Otro', 'Auxiliar de servicios', 'servicio local', 'Apoyo en tareas operativas, organización del espacio y atención a las necesidades del equipo.', 1250)
),
locations(n, city, lat, lng) as (
  values
    (1, 'Torrevieja', 37.9786::double precision, -0.6822::double precision),
    (2, 'Orihuela Costa', 37.9292, -0.7354),
    (3, 'Guardamar del Segura', 38.0901, -0.6551),
    (4, 'Orihuela', 38.0840, -0.9440),
    (5, 'Pilar de la Horadada', 37.8659, -0.7926),
    (6, 'Rojales', 38.0875, -0.7250),
    (7, 'Los Montesinos', 38.0280, -0.6465),
    (8, 'San Miguel de Salinas', 37.9797, -0.7890),
    (9, 'Elche', 38.2660, -0.6983),
    (10, 'Alicante', 38.3452, -0.4810)
),
generated as (
  select
    g.i,
    c.sector,
    c.position,
    c.business_type,
    c.description,
    c.base_salary + ((g.i * 29) % 451) as salary_min,
    c.base_salary + ((g.i * 29) % 451) + 100 + ((g.i * 17) % 351) as salary_max,
    l.city,
    l.lat + (((g.i % 7) - 3) * 0.0010::double precision) as lat,
    l.lng + (((g.i % 9) - 4) * 0.0010::double precision) as lng,
    (array['Jornada completa','Media jornada','Fines de semana','Turnos rotativos'])[((g.i - 1) % 4) + 1] as shift_type,
    (array['Mañana','Tarde','Turnos según cuadrante','Horario a concretar'])[((g.i - 1) % 4) + 1] as schedule
  from generate_series(1, 100) as g(i)
  join offer_catalog c on c.n = ((g.i - 1) % 13) + 1
  join locations l on l.n = ((g.i - 1) % 10) + 1
)
insert into public.jobmatch_job_offers (
  id, company_id, business_name, business_image_path, position, sector,
  salary_text, salary_min, salary_max, salary_amount, salary_frequency,
  salary_kind, salary_period, shift_type, schedule, benefits, description,
  city, address_approx, lat, lng, is_active, is_demo, is_boosted,
  boost_expires_at, expires_at, created_at, updated_at
)
select
  md5('jobmatch-massive-demo-offer-' || i)::uuid,
  null,
  format('Muestra %s · %s de la zona', lpad(i::text, 3, '0'), business_type),
  null,
  position,
  sector,
  format('%s–%s €/mes bruto', salary_min, salary_max),
  salary_min,
  salary_max,
  salary_min,
  'mensual',
  'bruto',
  'mensual',
  shift_type,
  schedule,
  case (i - 1) % 4
    when 0 then array['Incorporación flexible','Equipo cercano']::text[]
    when 1 then array['Formación inicial','Turnos organizados']::text[]
    when 2 then array['Contrato según perfil','Zona bien comunicada']::text[]
    else array['Posibilidad de continuidad','Funciones variadas']::text[]
  end,
  format('%s Perfil de oferta ficticia de muestra para probar la búsqueda y los filtros. Condiciones orientativas, no corresponden a una vacante real.', description),
  city,
  'Zona aproximada de ' || city || ' · ubicación de muestra',
  lat,
  lng,
  true,
  true,
  false,
  null,
  now() + interval '30 days',
  now() - ((i % 14) || ' days')::interval,
  now()
from generated
on conflict (id) do update set
  company_id = null,
  business_name = excluded.business_name,
  business_image_path = null,
  position = excluded.position,
  sector = excluded.sector,
  salary_text = excluded.salary_text,
  salary_min = excluded.salary_min,
  salary_max = excluded.salary_max,
  salary_amount = excluded.salary_amount,
  salary_frequency = excluded.salary_frequency,
  salary_kind = excluded.salary_kind,
  salary_period = excluded.salary_period,
  shift_type = excluded.shift_type,
  schedule = excluded.schedule,
  benefits = excluded.benefits,
  description = excluded.description,
  city = excluded.city,
  address_approx = excluded.address_approx,
  lat = excluded.lat,
  lng = excluded.lng,
  is_active = true,
  is_demo = true,
  is_boosted = false,
  boost_expires_at = null,
  expires_at = excluded.expires_at,
  updated_at = now()
where public.jobmatch_job_offers.is_demo = true;

commit;

-- Retirada selectiva de ESTE seed, sin borrar otros registros de muestra:
-- begin;
-- delete from public.jobmatch_job_offers
-- where is_demo and id in (select md5('jobmatch-massive-demo-offer-' || n)::uuid from generate_series(1,100) n);
-- delete from public.jobmatch_worker_cards
-- where is_demo and id in (select md5('jobmatch-massive-demo-worker-' || n)::uuid from generate_series(1,200) n);
-- commit;
