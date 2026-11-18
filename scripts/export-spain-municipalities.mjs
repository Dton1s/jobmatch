import { mkdir, writeFile } from "node:fs/promises";
import { getAllCities } from "spanish-cities-info";

const municipalities = getAllCities().map((city) => ({
  name: city.name,
  ineCode: city.ineCode,
  province: city.province,
  community: city.community,
  lat: city.latitude,
  lng: city.longitude,
}));

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/data/spain-municipalities.json", import.meta.url),
  JSON.stringify(municipalities),
);
console.log(`Exportados ${municipalities.length} municipios españoles.`);
