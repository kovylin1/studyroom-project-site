// Remove the generated "top-up" campus/accommodation cards that an earlier pilot
// attempt baked into the pilot JSONs, restoring the previous-variant counts.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site/src/content/universities');
const PILOT = ['glasgow','aalto-university','aarhus-university','anglia-ruskin','3a-france','arden','gisma','arizona-state','alberta','adelaide','murdoch','bangor','abertay','avila','concordia-chicago','ue-germany','massey','lim-college'];

const ACCOM_NAMES = new Set(['Студенческое общежитие (университетское)','Студия / частная аренда','Комната в шеринге']);
const CAMP_TITLES = new Set(['Главный кампус','Учебные корпуса']);
const CAMP_TEXTS = new Set(['Основные факультеты, библиотеки и учебные корпуса университета.','Аудитории, лаборатории и студенческие пространства кампуса.']);

for(const slug of PILOT){
  const path=join(CATALOG, slug+'.json');
  let u;
  try{ u=JSON.parse(await readFile(path,'utf8')); }catch{ console.log('skip',slug,'(no json)'); continue; }
  const accBefore=(u.accommodation??[]).length, campBefore=(u.campuses??[]).length;
  if(Array.isArray(u.accommodation)) u.accommodation=u.accommodation.filter(a=>!ACCOM_NAMES.has(a.name));
  if(Array.isArray(u.campuses)) u.campuses=u.campuses.filter(c=>!(CAMP_TITLES.has(c.title)&&CAMP_TEXTS.has(c.text)));
  const accAfter=(u.accommodation??[]).length, campAfter=(u.campuses??[]).length;
  if(accAfter!==accBefore || campAfter!==campBefore){
    await writeFile(path, JSON.stringify(u,null,2)+'\n','utf8');
    console.log(`${slug}: accom ${accBefore}→${accAfter}, campus ${campBefore}→${campAfter}`);
  } else {
    console.log(`${slug}: no change (accom ${accAfter}, campus ${campAfter})`);
  }
}
console.log('done');
