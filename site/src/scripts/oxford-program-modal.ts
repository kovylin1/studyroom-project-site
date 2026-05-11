// Open/close handlers for the per-faculty "all programs" modal.
//
// Markup contract (rendered by `[slug].astro` only when a faculty has more
// than 8 programs):
//   <button class="programs-modal__open" data-modal-target="programs-modal-N">…</button>
//   <dialog class="programs-modal" id="programs-modal-N"> … </dialog>
//
// Behaviour: click the button → dialog.showModal(); click the .programs-modal__close
// button OR click outside the dialog content (on the backdrop area) → dialog.close().
// `<dialog>` handles Escape natively.

(() => {
  document.querySelectorAll<HTMLButtonElement>('button[data-modal-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.modalTarget;
      if (!id) return;
      const dialog = document.getElementById(id);
      if (!(dialog instanceof HTMLDialogElement)) return;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  });

  document.querySelectorAll<HTMLDialogElement>('dialog.programs-modal').forEach((dialog) => {
    const closeBtn = dialog.querySelector<HTMLButtonElement>('.programs-modal__close');
    closeBtn?.addEventListener('click', () => dialog.close());

    // Click on the backdrop (outside .programs-modal__inner) closes the dialog.
    // Hit-test the inner box: if the click target is the <dialog> itself AND
    // the pointer landed outside the visible inner content rect, close.
    dialog.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target !== dialog) return;
      const inner = dialog.querySelector<HTMLElement>('.programs-modal__inner');
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) dialog.close();
    });
  });
})();
