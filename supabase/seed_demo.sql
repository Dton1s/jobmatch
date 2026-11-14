-- Datos de muestra del área Torrevieja/Alicante. Seguro de volver a ejecutar.
-- Se insertan fichas huérfanas de autenticación, marcadas is_demo=true;
-- no crean usuarios en auth.users ni pueden generar matches/cupones reales.
begin;

insert into public.jobmatch_worker_cards
  (id,user_id,full_name,age,photo_path,desired_position,sector,experience_years,availability,availability_note,skills,bio,city,lat,lng,intro_audio_path,is_active,is_featured,is_demo)
values
('d2000000-0000-4000-8000-000000000001',null,'Lucía Martínez',24,null,'Camarera de sala','Hostelería',3,'inmediata','Incorporación inmediata',array['Bandeja','TPV','Inglés B2'],'Ágil en servicio de terraza y sala. Busco un equipo estable con buen ambiente.','Torrevieja',37.9789,-0.6813,null,true,false,true),
('d2000000-0000-4000-8000-000000000002',null,'Mario Sánchez',31,null,'Dependiente de tienda','Comercio',6,'completa','Disponible esta semana',array['Caja','Reposición','Atención al cliente'],'Experiencia en comercio de barrio y gestión de caja.','Torrevieja',37.9811,-0.6798,null,true,false,true),
('d2000000-0000-4000-8000-000000000003',null,'Nadia Benali',27,null,'Moza de almacén','Logística',4,'fines_de_semana','Disponibilidad fines de semana',array['Carretilla','Picking','Carnet B'],'Organizada, puntual y con experiencia preparando pedidos.','Torrevieja',37.9754,-0.6851,null,true,false,true),
('d2000000-0000-4000-8000-000000000004',null,'Álvaro Pérez',22,null,'Atención al cliente','Atención al cliente',2,'inmediata','Incorporación inmediata',array['Inglés C1','Informática','Teléfono'],'Me gusta resolver dudas y tratar con personas. Inglés fluido.','Torrevieja',37.9824,-0.6834,null,true,false,true),
('d2000000-0000-4000-8000-000000000005',null,'Sara Molina',35,null,'Ayudante de cocina','Hostelería',8,'media_jornada','Disponible en 15 días',array['Preparación','APPCC','Plancha'],'Cocina mediterránea, limpieza y preparación de mise en place.','Guardamar del Segura',38.0901,-0.6551,null,true,false,true),
('d2000000-0000-4000-8000-000000000006',null,'Héctor Ruiz',29,null,'Repartidor','Logística',5,'completa','Disponible esta semana',array['Carnet B','Furgoneta','Rutas'],'Conozco bien la Vega Baja y tengo experiencia en reparto urbano.','Orihuela Costa',37.9292,-0.7354,null,true,false,true),
('d2000000-0000-4000-8000-000000000007',null,'Inés Navarro',26,null,'Asesora de ventas','Comercio',4,'inmediata','Incorporación inmediata',array['Escaparatismo','TPV','Valenciano'],'Atención cercana, venta asesorada y organización de escaparates.','La Mata',38.0267,-0.6541,null,true,false,true),
('d2000000-0000-4000-8000-000000000008',null,'Pablo Costa',32,null,'Recepcionista','Atención al cliente',7,'completa','Disponible en 15 días',array['Reservas','Inglés B2','Excel'],'Experiencia en recepción turística, reservas y resolución de incidencias.','Alicante',38.3452,-0.4810,null,true,false,true)
on conflict (id) do update set full_name=excluded.full_name, age=excluded.age, desired_position=excluded.desired_position,
  sector=excluded.sector, experience_years=excluded.experience_years, availability=excluded.availability,
  availability_note=excluded.availability_note, skills=excluded.skills, bio=excluded.bio, city=excluded.city,
  lat=excluded.lat, lng=excluded.lng, is_active=true, is_demo=true;

insert into public.jobmatch_job_offers
  (id,company_id,business_name,business_image_path,position,sector,salary_text,salary_amount,salary_frequency,salary_kind,salary_min,salary_period,shift_type,schedule,benefits,description,city,lat,lng,address_approx,is_active,expires_at,is_demo)
values
('d1000000-0000-4000-8000-000000000001',null,'Café del Puerto',null,'Camarero/a de terraza','Hostelería','1.350 €/mes netos',1350,'mensual','neto',1350,'mensual','Jornada completa','Mañanas y fines de semana',array['Propinas','Comida incluida','Incorporación inmediata'],'Buscamos una persona dinámica para atender terraza y barra en un café familiar junto al puerto.','Torrevieja',37.9782,-0.6805,'Zona puerto',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000002',null,'Mercado La Plasa',null,'Dependiente/a de tienda','Comercio','10,50 €/hora brutos',10.50,'hora','bruto',10.50,'hora','Media jornada','Turno de tarde',array['Contrato indefinido','Formación pagada'],'Atención al público, reposición y caja en pequeño comercio del centro.','Torrevieja',37.9795,-0.6819,'Centro, junto al mercado',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000003',null,'Logística Vega Baja',null,'Preparador/a de pedidos','Logística','1.480 €/mes brutos',1480,'mensual','bruto',1480,'mensual','Jornada completa','Turnos rotativos de mañana y tarde',array['Plus de transporte','Formación de carretilla'],'Preparación de pedidos, etiquetado y organización de mercancía en almacén.','Torrevieja',37.9701,-0.6992,'Polígono industrial',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000004',null,'Hotel Brisa Marina',null,'Recepcionista de noche','Atención al cliente','1.600 €/mes netos',1600,'mensual','neto',1600,'mensual','Jornada completa','Turno fijo de noche',array['Alojamiento','Contrato de temporada'],'Recepción, check-in y atención a huéspedes. Se valora inglés y experiencia con reservas.','Torrevieja',37.9846,-0.6740,'Paseo marítimo',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000005',null,'Restaurante Sal y Sol',null,'Ayudante de cocina','Hostelería','75 €/jornada netos',75,'jornada','neto',75,'jornada','Fines de semana','Viernes noche y sábados/domingo',array['Comida incluida','Propinas'],'Apoyo en preparación y emplatado para servicio de fin de semana. Equipo pequeño y estable.','Guardamar del Segura',38.0885,-0.6537,'Zona centro',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000006',null,'Repartos Costa Blanca',null,'Repartidor/a con carnet B','Logística','11 €/hora brutos',11,'hora','bruto',11,'hora','Jornada completa','Lunes a viernes, 8:00–16:00',array['Vehículo de empresa','Dietas'],'Reparto de paquetería por Orihuela Costa y urbanizaciones próximas.','Orihuela Costa',37.9278,-0.7325,'La Zenia',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000007',null,'Boutique Arena',null,'Asesor/a de ventas','Comercio','1.250 €/mes netos',1250,'mensual','neto',1250,'mensual','Media jornada','Turnos de mañana o tarde',array['Comisiones','Descuento de empleado'],'Asesoramiento a clientes, caja y cuidado de producto en boutique de moda.','La Mata',38.0254,-0.6529,'Avenida principal',true,now()+interval '14 days',true),
('d1000000-0000-4000-8000-000000000008',null,'Clínica Familiar Alicante',null,'Recepcionista de clínica','Atención al cliente','1.550 €/mes brutos',1550,'mensual','bruto',1550,'mensual','Jornada completa','Lunes a jueves 9–18 h, viernes intensivo',array['Seguro médico','Estabilidad'],'Gestión de citas, recepción de pacientes y soporte administrativo básico.','Alicante',38.3461,-0.4834,'Centro, zona Ensanche',true,now()+interval '14 days',true)
on conflict (id) do update set business_name=excluded.business_name, position=excluded.position,
  sector=excluded.sector, salary_text=excluded.salary_text, salary_amount=excluded.salary_amount,
  salary_frequency=excluded.salary_frequency, salary_kind=excluded.salary_kind, shift_type=excluded.shift_type,
  schedule=excluded.schedule, benefits=excluded.benefits, description=excluded.description,
  city=excluded.city, lat=excluded.lat, lng=excluded.lng, address_approx=excluded.address_approx,
  is_active=true, expires_at=now()+interval '14 days', is_demo=true;

commit;
