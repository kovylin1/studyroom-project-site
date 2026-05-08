(function () {
  const STATUS_LABEL = {
    todo: 'к работе',
    in_progress: 'в работе',
    done: 'готово',
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function renderRoadmap() {
    const root = document.getElementById('roadmap');
    if (!root || !window.STUDYROOM_ROADMAP) return;

    for (const step of window.STUDYROOM_ROADMAP) {
      const num = el('div', { class: 'num' }, String(step.n));
      const body = el('div', { class: 'body' }, [
        el('h3', null, step.title),
        el('p', null, step.detail),
      ]);
      const status = el(
        'span',
        { class: 'status ' + step.status },
        STATUS_LABEL[step.status] || step.status,
      );
      root.appendChild(el('div', { class: 'step' }, [num, body, status]));
    }
  }

  function renderArchitecture() {
    const layersRoot = document.getElementById('layers');
    const pipelineRoot = document.getElementById('pipeline');
    const rejectedRoot = document.getElementById('rejected');
    const tradeoffRoot = document.getElementById('tradeoff');
    const arch = window.STUDYROOM_ARCHITECTURE;
    if (!arch) return;

    if (layersRoot) {
      for (const layer of arch.layers) {
        const ul = el(
          'ul',
          null,
          layer.tools.map((t) => el('li', null, t)),
        );
        layersRoot.appendChild(
          el('div', { class: 'card' }, [
            el('h3', null, layer.title),
            el('p', null, layer.cadence),
            ul,
          ]),
        );
      }
    }

    if (pipelineRoot) {
      for (const step of arch.pipeline) {
        pipelineRoot.appendChild(el('li', null, step));
      }
    }

    if (rejectedRoot) {
      for (const r of arch.rejected) {
        rejectedRoot.appendChild(
          el('div', { class: 'card' }, [
            el('h3', null, r.name + ' — почему мимо'),
            el(
              'ul',
              null,
              r.reasons.map((reason) => el('li', null, reason)),
            ),
          ]),
        );
      }
    }

    if (tradeoffRoot) {
      tradeoffRoot.textContent = arch.tradeoff;
    }
  }

  function renderSchema() {
    const tableBody = document.getElementById('schema-body');
    const exampleRoot = document.getElementById('schema-example');
    const schema = window.STUDYROOM_UNIVERSITY_SCHEMA;
    if (!schema) return;

    if (tableBody) {
      for (const f of schema.fields) {
        tableBody.appendChild(
          el('tr', null, [
            el('td', null, [el('code', null, f.key)]),
            el('td', null, [el('code', null, f.type)]),
            el('td', null, f.example != null ? String(f.example) : ''),
            el('td', null, f.note || ''),
          ]),
        );
      }
    }

    if (exampleRoot) {
      exampleRoot.textContent = JSON.stringify(schema.example, null, 2);
    }
  }

  function renderRisks() {
    const root = document.getElementById('risks');
    if (!root || !window.STUDYROOM_RISKS) return;

    const sevLabel = { high: 'высокий', medium: 'средний', low: 'низкий' };

    for (const r of window.STUDYROOM_RISKS) {
      const sev = el(
        'span',
        { class: 'status ' + (r.severity === 'high' ? 'in_progress' : r.severity === 'medium' ? 'todo' : 'done') },
        sevLabel[r.severity] || r.severity,
      );
      const head = el('div', { class: 'risk-head' }, [
        el('h3', null, r.title),
        sev,
      ]);
      root.appendChild(
        el('div', { class: 'card' }, [
          head,
          el('p', null, r.detail),
        ]),
      );
    }
  }

  function renderOpenQuestions() {
    const root = document.getElementById('open-questions');
    if (!root || !window.STUDYROOM_OPEN_QUESTIONS) return;

    for (const q of window.STUDYROOM_OPEN_QUESTIONS) {
      const opts = el(
        'ul',
        null,
        (q.options || []).map((o) => el('li', null, o)),
      );
      const card = el('div', { class: 'card' }, [
        el('h3', null, q.n + '. ' + q.title),
        q.detail ? el('p', null, q.detail) : null,
        opts,
        el('span', { class: 'status ' + (q.status === 'decided' ? 'done' : 'todo') }, q.status === 'decided' ? 'решено' : 'открыто'),
      ]);
      root.appendChild(card);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderRoadmap();
    renderArchitecture();
    renderSchema();
    renderRisks();
    renderOpenQuestions();
  });
})();
