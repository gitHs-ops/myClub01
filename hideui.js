// 모든 업장 공통 「카드 숨기기」: 화면을 가리는 카드(상단 바·패널·자막 등)를 접고 3D 화면만 본다.
// 숨긴 동안에는 오른쪽 아래 「카드 보이기」 버튼만 남고, H 키로도 숨기기·보이기를 바꾼다.
export function installHideUi({ targets, before, btnClass = 'glass' }) {
  const list = targets.join(', ');
  const css = document.createElement('style');
  css.textContent = `
${list} { transition: opacity .35s cubic-bezier(.22, 1, .36, 1); }
body.uiHidden :is(${list}) { opacity: 0 !important; pointer-events: none !important; animation: none !important; }
body.uiHidden :is(${list}) * { pointer-events: none !important; }
#btnShowUi { position: fixed; z-index: 30; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); display: none; align-items: center; gap: 6px;
  height: 40px; padding: 0 14px; border-radius: 20px; font: 600 13px Pretendard, sans-serif; color: #4c1d95; cursor: pointer; border: 0; animation: rise .4s ease both; }
#btnShowUi svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
body.uiHidden #btnShowUi { display: inline-flex; }
@media (prefers-reduced-motion: reduce) { ${list} { transition: none; } }`;
  document.head.append(css);

  const hide = document.createElement('button');
  hide.type = 'button'; hide.id = 'btnHideUi'; hide.className = btnClass;
  hide.textContent = '카드 숨기기'; hide.title = '카드를 숨기고 화면만 보기 (H)'; hide.setAttribute('aria-pressed', 'false');
  const ref = document.querySelector(before);
  if (ref) ref.parentNode.insertBefore(hide, ref);

  const show = document.createElement('button');
  show.type = 'button'; show.id = 'btnShowUi'; show.className = 'glass';
  show.setAttribute('aria-label', '카드 다시 보이기 (H)'); show.title = '카드 다시 보이기 (H)';
  show.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span>카드 보이기</span>';
  document.body.append(show);

  const set = (on) => {
    document.body.classList.toggle('uiHidden', on);
    hide.setAttribute('aria-pressed', String(on));
    (on ? show : hide).focus({ preventScroll: true });
  };
  hide.onclick = () => set(true);
  show.onclick = () => set(false);
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const hidden = document.body.classList.contains('uiHidden');
    if (!hidden && !hide.offsetParent) return;   // 업장에 들어가기 전(버튼이 안 보일 때)에는 쓰지 않는다
    set(!hidden);
  });
  return { set };
}
