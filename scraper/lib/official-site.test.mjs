import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOfficialSite, AGG_DOMAINS } from './official-site.mjs';

test('officialUrl имеет высший приоритет', () => {
  const u = { officialUrl: 'https://www.aru.ac.uk', sourceUrl: 'https://edge.edvoy.com/x' };
  assert.equal(resolveOfficialSite(u, []), 'https://www.aru.ac.uk');
});

test('website из edvoy-выгрузки — второй приоритет', () => {
  const u = { sourceUrl: 'https://edge.edvoy.com/institution/aru' };
  const extracts = [{ source: 'edvoy', data: { website: 'https://www.aru.ac.uk' } }];
  assert.equal(resolveOfficialSite(u, extracts), 'https://www.aru.ac.uk');
});

test('свой домен в sourceUrl проходит', () => {
  const u = { sourceUrl: 'https://www.hw.ac.uk' };
  assert.equal(resolveOfficialSite(u, []), 'https://www.hw.ac.uk');
});

test('агрегаторный хост в sourceUrl → null (не выдумываем)', () => {
  for (const host of [
    'https://edge.edvoy.com/x',
    'https://www.kaplanpathways.com/x',
    'https://collabinternational.com/x',
    'https://www.oxfordinternational.com/x',
    'https://www.catsglobalschools.com/x',
    'https://www.intostudy.com/x',
  ]) {
    assert.equal(resolveOfficialSite({ sourceUrl: host }, []), null, host);
  }
});

test('мусорный/пустой URL → null', () => {
  assert.equal(resolveOfficialSite({ sourceUrl: 'не-урл' }, []), null);
  assert.equal(resolveOfficialSite({}, []), null);
  assert.equal(resolveOfficialSite({ sourceUrl: '' }, []), null);
});

test('агрегаторный website из edvoy тоже отвергается', () => {
  const u = { sourceUrl: 'https://edge.edvoy.com/x' };
  const extracts = [{ source: 'edvoy', data: { website: 'https://edge.edvoy.com/y' } }];
  assert.equal(resolveOfficialSite(u, extracts), null);
});

test('хвостовой слеш срезается', () => {
  assert.equal(resolveOfficialSite({ officialUrl: 'https://www.aru.ac.uk/' }, []), 'https://www.aru.ac.uk');
});

test('AGG_DOMAINS покрывает домены из каталога', () => {
  assert.ok(AGG_DOMAINS.test('catsglobalschools.com'));
  assert.ok(AGG_DOMAINS.test('oxfordinternational.com'));
  assert.ok(!AGG_DOMAINS.test('aru.ac.uk'));
});
