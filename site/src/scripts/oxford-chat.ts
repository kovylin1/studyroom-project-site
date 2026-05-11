// Floating consultant chat widget. Hydrates from window.CHAT, handles
// open/close, message append, and a simulated consultant auto-reply.

interface ChatQuickAction {
  label: string;
  href?: string;
  icon?: 'whatsapp' | 'telegram';
}

interface ChatConsultant {
  name?: string;
  role?: string;
  online?: boolean;
  avatarInitial?: string;
}

interface ChatConfigShape {
  buttonAriaLabel?: string;
  consultant?: ChatConsultant;
  greeting?: string;
  quickActions?: ChatQuickAction[];
  inputPlaceholder?: string;
  autoReply?: string;
}

declare global {
  interface Window {
    CHAT?: ChatConfigShape;
  }
}

(() => {
  const root = document.querySelector<HTMLElement>('.chat');
  if (!root) return;

  const config: ChatConfigShape = window.CHAT || {};
  const fab = root.querySelector<HTMLButtonElement>('.chat__fab');
  const panel = root.querySelector<HTMLElement>('.chat__panel');
  const closeBtn = root.querySelector<HTMLButtonElement>('.chat__close');
  const form = root.querySelector<HTMLFormElement>('.chat__form');
  const input = root.querySelector<HTMLInputElement>('.chat__input');
  const messages = root.querySelector<HTMLElement>('.chat__messages');
  const quick = root.querySelector<HTMLElement>('.chat__quick');
  const badge = root.querySelector<HTMLElement>('.chat__fab-badge');
  const avatar = root.querySelector<HTMLElement>('.chat__avatar');
  const nameEl = root.querySelector<HTMLElement>('.chat__head-name');
  const statusText = root.querySelector<HTMLElement>('.chat__head-status-text');
  const headDot = root.querySelector<HTMLElement>('.chat__head-dot');

  if (!fab || !panel || !closeBtn || !form || !input || !messages || !quick) return;

  if (config.consultant) {
    const c = config.consultant;
    if (avatar) avatar.textContent = c.avatarInitial || '•';
    if (nameEl) nameEl.textContent = c.role ? `${c.name} · ${c.role}` : c.name || '';
    if (statusText) statusText.textContent = c.online ? 'Онлайн' : 'Не в сети';
    if (headDot && !c.online) headDot.style.background = '#999';
  }
  if (config.buttonAriaLabel) fab.setAttribute('aria-label', config.buttonAriaLabel);
  if (config.inputPlaceholder) input.placeholder = config.inputPlaceholder;

  if (config.greeting) addMessage(config.greeting, 'consultant');

  (config.quickActions || []).forEach((qa) => {
    if (!qa || !qa.label) return;
    const node = qa.href ? document.createElement('a') : document.createElement('button');
    node.className = 'chat__quick-btn';
    if (qa.icon) {
      const icon = iconFor(qa.icon);
      if (icon) node.appendChild(icon);
    }
    node.appendChild(document.createTextNode(qa.label));
    if (qa.href) {
      const a = node as HTMLAnchorElement;
      a.href = qa.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      (node as HTMLButtonElement).type = 'button';
    }
    quick.appendChild(node);
  });

  function setOpen(open: boolean): void {
    if (!root || !fab || !panel || !input) return;
    root.dataset.state = open ? 'open' : 'closed';
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      if (badge) badge.style.display = 'none';
      setTimeout(() => {
        try {
          input.focus();
        } catch {
          /* noop */
        }
      }, 220);
    }
  }
  fab.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.dataset.state === 'open') setOpen(false);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (input.value || '').trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    setTimeout(() => {
      addMessage(
        config.autoReply || 'Спасибо! Мы свяжемся с вами в ближайшее время.',
        'consultant'
      );
    }, 650);
  });

  function addMessage(text: string, who: 'consultant' | 'user'): void {
    if (!messages) return;
    const li = document.createElement('li');
    li.className = `chat__msg chat__msg--${who === 'user' ? 'user' : 'consultant'}`;
    li.textContent = text;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }

  function iconFor(name: 'whatsapp' | 'telegram'): SVGSVGElement | null {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.style.flexShrink = '0';

    const path = document.createElementNS(svgNS, 'path');
    if (name === 'whatsapp') {
      path.setAttribute(
        'd',
        'M20.5 3.5A11 11 0 0 0 3 17l-1 5 5.2-1.3A11 11 0 1 0 20.5 3.5Zm-8.5 17a8.5 8.5 0 0 1-4.3-1.2l-.3-.2-3 .8.8-3-.2-.3A8.5 8.5 0 1 1 12 20.5Zm4.7-6.4c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1c-.2.1-.3.2-.5 0-.3-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.2 0-.4.1-.5.1-.1.3-.3.4-.5.1-.1.2-.2.2-.4s0-.3 0-.5c-.1-.1-.6-1.5-.8-2-.2-.5-.5-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3 4.8 4.2 2.7 1.2 2.7.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z'
      );
    } else if (name === 'telegram') {
      path.setAttribute(
        'd',
        'M21.3 3.5 2.7 10.7c-1 .4-1 1.7 0 2L7 14l1.9 5.6c.3.9 1.5 1 2 .2l2.4-3.7 5 3.8c.8.6 2 .2 2.2-.9l2.9-13.6c.2-1-.7-1.8-1.6-1.4ZM10 14l9-7L11.3 15l-.3 4-1-5Z'
      );
    } else {
      return null;
    }
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
  }
})();
