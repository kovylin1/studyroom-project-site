// Cloudflare Pages Function — POST /api/lead
// Принимает заявки с форм каталога и форвардит их в CRM.
//
// Настройка (Cloudflare Pages → проект → Settings → Environment variables):
//   CRM_WEBHOOK_URL  — ОБЯЗАТЕЛЬНО. Для Bitrix24 — base входящего вебхука, например
//                      https://your.bitrix24.kz/rest/1/XXXXXtokenXXXXX/
//                      (скрипт сам допишет crm.lead.add.json). Для generic — любой URL,
//                      принимающий JSON POST.
//   CRM_TYPE         — 'bitrix24' (по умолчанию) | 'generic' (для amoCRM/собственного вебхука).
//   LEAD_NOTIFY_URL  — опционально: доп. вебхук для дубль-уведомления (например, свой
//                      эндпоинт или прокси Telegram), получает { text }.
//
// Секреты задаются как env, в код не попадают.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const clean = (s, max = 500) =>
  String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);

const FORM_LABELS = {
  consultation: 'Консультация (CTA)',
  consultation_modal: 'Консультация (модалка)',
  guide_pdf: 'Гид PDF (exit-popup)',
};

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  // honeypot — если скрытое поле заполнено, это бот: тихо отвечаем ok, ничего не шлём
  if (clean(body.company)) return json({ ok: true });

  const lead = {
    name: clean(body.name, 120),
    phone: clean(body.phone, 40),
    email: clean(body.email, 120),
    formType: clean(body.formType, 40),
    uniSlug: clean(body.uniSlug, 80),
    uniName: clean(body.uniName, 160),
    pageUrl: clean(body.pageUrl, 300),
    role: clean(body.role, 40),
    channel: clean(body.channel, 40),
    time: clean(body.time, 40),
  };

  if (!lead.name || (!lead.phone && !lead.email)) {
    return json({ ok: false, error: 'missing_fields' }, 422);
  }

  const webhook = env.CRM_WEBHOOK_URL;
  if (!webhook) {
    // Не теряем лид: пишем в логи Pages. Возвращаем ошибку — фронт покажет «напишите в WhatsApp».
    console.error('LEAD (CRM_WEBHOOK_URL not configured):', JSON.stringify(lead));
    return json({ ok: false, error: 'crm_not_configured' }, 503);
  }

  const formLabel = FORM_LABELS[lead.formType] || lead.formType || 'заявка';
  const title = `StudyRoom: ${lead.uniName || 'каталог'} — ${formLabel}`;
  const comments = [
    lead.uniName && `Вуз: ${lead.uniName}${lead.uniSlug ? ` (${lead.uniSlug})` : ''}`,
    lead.pageUrl && `Страница: ${lead.pageUrl}`,
    `Форма: ${formLabel}`,
    lead.role && `Роль: ${lead.role}`,
    lead.channel && `Канал связи: ${lead.channel}`,
    lead.time && `Удобное время: ${lead.time}`,
  ].filter(Boolean).join('\n');

  const type = (env.CRM_TYPE || 'bitrix24').toLowerCase();

  try {
    let resp;
    if (type === 'bitrix24') {
      const url = webhook.replace(/\/+$/, '') + '/crm.lead.add.json';
      const fields = { TITLE: title, NAME: lead.name, SOURCE_ID: 'WEB', COMMENTS: comments };
      if (lead.phone) fields.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: 'WORK' }];
      if (lead.email) fields.EMAIL = [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }];
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, params: { REGISTER_SONET_EVENT: 'Y' } }),
      });
    } else {
      // generic: пробрасываем заявку как есть (amoCRM-прокси / собственный вебхук)
      resp = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, comments, ...lead }),
      });
    }

    const text = await resp.text();
    if (!resp.ok) {
      console.error('CRM HTTP error', resp.status, text.slice(0, 500));
      return json({ ok: false, error: 'crm_failed' }, 502);
    }
    if (type === 'bitrix24') {
      let parsed = {};
      try { parsed = JSON.parse(text); } catch {}
      if (parsed.error) {
        console.error('Bitrix24 error:', text.slice(0, 500));
        return json({ ok: false, error: 'crm_failed' }, 502);
      }
    }

    // Опциональное дубль-уведомление (не валим основной ответ, если упадёт)
    if (env.LEAD_NOTIFY_URL) {
      try {
        await fetch(env.LEAD_NOTIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `🎓 Новый лид\n${lead.name} · ${lead.phone || lead.email}\n${comments}` }),
        });
      } catch (e) {
        console.error('notify failed', e && e.message);
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error('lead handler crash:', err && err.message);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

// Health-check: GET /api/lead
export async function onRequestGet() {
  return json({ ok: true, service: 'lead', method: 'POST' });
}
