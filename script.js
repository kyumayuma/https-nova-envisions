/* モバイルメニューの開閉。旧パターン1（_archive/pattern1-video-hero/script.js）の実装をそのまま踏襲。 */
const body = document.body;
const menuButton = document.getElementById('menuButton');
const mobileMenu = document.getElementById('mobileMenu');
const menuOverlay = document.getElementById('menuOverlay');
const closeButton = document.querySelector('.menu-close');
const mobileLinks = document.querySelectorAll('.mobile-nav a');

function openMenu() {
  mobileMenu.classList.add('is-open');
  menuOverlay.classList.add('is-visible');
  menuButton.classList.add('open');
  menuButton.setAttribute('aria-expanded', 'true');
  mobileMenu.setAttribute('aria-hidden', 'false');
  menuOverlay.setAttribute('aria-hidden', 'false');
  body.classList.add('menu-open');
}

function closeMenu() {
  mobileMenu.classList.remove('is-open');
  menuOverlay.classList.remove('is-visible');
  menuButton.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
  menuOverlay.setAttribute('aria-hidden', 'true');
  body.classList.remove('menu-open');
}

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  isOpen ? closeMenu() : openMenu();
});

closeButton?.addEventListener('click', closeMenu);
menuOverlay?.addEventListener('click', closeMenu);
mobileLinks.forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
window.addEventListener('resize', () => {
  if (window.innerWidth >= 700) closeMenu();
});

/* PROJECTS / EXPERIENCE: 事例カードの詳細モーダル（課題→解決策）。
   .case-link は元のhref/target/relを残したままにしてあり、<dialog>非対応ブラウザや
   JS無効時はクリックが素通りしてそのまま実サイト（LIVNEST/NESTA）へ遷移する
   （プログレッシブ・エンハンスメント、フォールバック確保）。
   <dialog>対応時のみクリックをフックしてモーダルを開く。 */
const supportsDialog = typeof HTMLDialogElement === 'function';
const caseModalTriggers = document.querySelectorAll('.case-link[data-modal]');

function openCaseModal(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  document.body.classList.add('modal-open');
  // 2回のrequestAnimationFrameで「openした直後の初期状態（opacity:0）」を一度描画させてから
  // is-openを付与し、CSS transitionが確実に発火するようにする。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dialog.classList.add('is-open');
    });
  });
}

function closeCaseModal(dialog) {
  if (!dialog.open) return;
  dialog.classList.remove('is-open');
  const finalize = () => {
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('transitionend', finalize, { once: true });
  window.setTimeout(finalize, 320); // transitionendが発火しない環境向けの保険
}

if (supportsDialog && caseModalTriggers.length) {
  caseModalTriggers.forEach((trigger) => {
    const dialog = document.getElementById(trigger.dataset.modal);
    if (!dialog) return;

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openCaseModal(dialog);
    });

    dialog.querySelectorAll('[data-modal-close]').forEach((closeEl) => {
      closeEl.addEventListener('click', () => closeCaseModal(dialog));
    });

    // Escキー: ネイティブdialogは自動でcancelイベント→即座にcloseするが、
    // フェードアウトのアニメーションを効かせるためcancelを一旦止めて自前のcloseに委譲する。
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeCaseModal(dialog);
    });

    // backdropクリックで閉じる。dialog自体はpadding:0のため、
    // クリック位置がdialogの矩形（=見た目のカード範囲）の外ならbackdropクリックと判定する。
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inBounds =
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inBounds) closeCaseModal(dialog);
    });

    // close時（自前close・Escからのclose・ブラウザ標準closeいずれも）に
    // 状態をリセットし、開いたトリガー（矢印リンク）へフォーカスを戻す。
    dialog.addEventListener('close', () => {
      dialog.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      trigger.focus();
    });
  });
}

/* SERVICE セクション（エディトリアル・ロードマップ）: 区間に入ったら01→05の順に一度だけ表示。
   IntersectionObserver未対応 or prefers-reduced-motion時はJSを介入させず、常時表示のまま。 */
const serviceFlow = document.querySelector('.service-flow');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (serviceFlow && !prefersReducedMotion && 'IntersectionObserver' in window) {
  serviceFlow.classList.add('js-fade-ready');
  const serviceStepObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        serviceFlow.classList.add('is-visible');
        serviceStepObserver.disconnect();
      }
    });
  }, { threshold: 0.2 });
  serviceStepObserver.observe(serviceFlow);
}

/* CONTACT FORM: クライアントサイドバリデーション + Netlify Forms への送信。
   Netlify Forms はサイトが Netlify にデプロイされ、ビルドされて初めて
   機能する（このHTMLのdata-netlify="true"属性をNetlifyがビルド時に検出する
   仕組みのため）。ローカル環境やNetlify以外でのホスティングでは、下記の
   fetch がエラーになり、catch側の案内メッセージが表示されるだけに留まる
   （存在しない送信先へ送信を試みているわけではない）。
   送信は既存のUI（インラインバリデーション・aria-liveなステータス表示）を
   活かすため、ネイティブのPOSTではなくfetchによるAJAX送信にしている
   （Netlify Forms公式のAJAX送信パターンに準拠）。 */
const contactForm = document.getElementById('contactForm');

if (contactForm) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const formStatus = document.getElementById('formStatus');

  const contactFields = [
    {
      input: document.getElementById('cf-name'),
      error: document.getElementById('cf-name-error'),
      requiredMessage: 'お名前を入力してください。',
    },
    {
      input: document.getElementById('cf-email'),
      error: document.getElementById('cf-email-error'),
      requiredMessage: 'メールアドレスを入力してください。',
      pattern: emailPattern,
      patternMessage: 'メールアドレスの形式が正しくありません。',
    },
    {
      input: document.getElementById('cf-message'),
      error: document.getElementById('cf-message-error'),
      requiredMessage: 'お問い合わせ内容を入力してください。',
    },
  ].filter((field) => field.input && field.error);

  function validateContactField(field) {
    const value = field.input.value.trim();
    let message = '';

    if (field.input.hasAttribute('required') && value === '') {
      message = field.requiredMessage;
    } else if (field.pattern && value !== '' && !field.pattern.test(value)) {
      message = field.patternMessage;
    }

    field.input.classList.toggle('is-invalid', Boolean(message));
    field.input.setAttribute('aria-invalid', message ? 'true' : 'false');
    field.error.textContent = message;
    return message === '';
  }

  contactFields.forEach((field) => {
    field.input.addEventListener('blur', () => validateContactField(field));
    field.input.addEventListener('input', () => {
      if (field.input.classList.contains('is-invalid')) validateContactField(field);
    });
  });

  function encodeFormData(form) {
    return new URLSearchParams(new FormData(form)).toString();
  }

  contactForm.addEventListener('submit', (event) => {
    // Netlify Forms へは fetch 経由のAJAX送信で行うため、常にネイティブ送信は止める。
    event.preventDefault();

    const allValid = contactFields
      .map((field) => validateContactField(field))
      .every(Boolean);

    if (!allValid) {
      if (formStatus) {
        formStatus.classList.remove('is-success');
        formStatus.classList.add('is-error');
        formStatus.textContent = '未入力・入力エラーの項目があります。ご確認ください。';
      }
      const firstInvalid = contactFields.find((field) => field.input.classList.contains('is-invalid'));
      firstInvalid?.input.focus();
      return;
    }

    if (formStatus) {
      formStatus.classList.remove('is-error', 'is-success');
      formStatus.textContent = '送信しています…';
    }

    fetch(window.location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodeFormData(contactForm),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Netlify Forms response not ok: ${response.status}`);
        if (formStatus) {
          formStatus.classList.remove('is-error');
          formStatus.classList.add('is-success');
          formStatus.textContent = 'お問い合わせを送信しました。担当者よりご連絡いたします。';
        }
        contactForm.reset();
      })
      .catch(() => {
        // Netlifyにデプロイされていない環境（ローカル・他社ホスティング等）では
        // Netlify Forms が送信を受け取れないため、ここに到達する。
        if (formStatus) {
          formStatus.classList.remove('is-success');
          formStatus.classList.add('is-error');
          formStatus.textContent = '現在この環境では送信できません（Netlifyへのデプロイ後に有効になります）。お急ぎの場合は他の方法でご連絡ください。';
        }
      });
  });
}
