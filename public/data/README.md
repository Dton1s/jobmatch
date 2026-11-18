# Catálogo de municipios españoles

`spain-municipalities.json` contiene 8.132 municipios con código INE, provincia, comunidad autónoma y coordenadas de referencia. Se genera con `npm run locations:export` desde el paquete `spanish-cities-info` (licencia ISC), que documenta sus fuentes como INE y cartografía del IGN.

Las coordenadas representan el centro de referencia del municipio y sirven para estimar distancias. Cuando se concede el permiso de ubicación, la aplicación conserva las coordenadas GPS del usuario para calcular el radio con mayor precisión; el municipio más cercano se usa como etiqueta. El código postal se intenta completar mediante una consulta puntual de geocodificación inversa a Nominatim.

Fuentes: [spanish-cities-info](https://github.com/ManuelCebreiro/spanish-cities-info) y [Nomenclátor Geográfico de Municipios y Entidades de Población del IGN](https://centrodedescargas.cnig.es/CentroDescargas/nomenclator-geografico-municipios-entidades-poblacion).
