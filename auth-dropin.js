(function () {
  const STYLE_ID = "renzu-auth-dropin-style";
  const ROOT_ID = "renzu-auth-dropin-root";
  const MODAL_ID = "rz-auth-modal-root";

  const FATE_SPIDER_SVG = `
    <svg class="rz-fate-spider" viewBox="-20 -20 104 104" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="rzSpiderGlow" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stop-color="#fff8e6"/>
          <stop offset="42%" stop-color="#d8a34d"/>
          <stop offset="100%" stop-color="#5e3914"/>
        </radialGradient>
      </defs>
      <g transform="translate(0 4)">
        <path class="rz-spider-web" d="M32 4 C32 14 32 21 32 27 M15 10 C22 17 27 22 29 27 M49 10 C42 17 37 22 35 27" />
        <circle class="rz-spider-head" cx="32" cy="25" r="5.4" />
        <ellipse class="rz-spider-body" cx="32" cy="39" rx="8.2" ry="10.8" />
        <path class="rz-spider-legs" d="M26 30 C18 26 11 21 5 15 M38 30 C46 26 53 21 59 15" />
        <path class="rz-spider-legs" d="M24 36 C15 35 9 36 2 39 M40 36 C49 35 55 36 62 39" />
        <path class="rz-spider-legs" d="M25 43 C18 48 12 54 7 62 M39 43 C46 48 52 54 57 62" />
        <path class="rz-spider-mark" d="M32 31 L35 38 L32 48 L29 38 Z" />
      </g>
    </svg>
  `;

  let supabaseClient = null;
  let session = null;
  let currentUser = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rz-auth-root {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 99997;
        font-family: Georgia, serif;
      }

      .rz-auth-button {
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(12,10,8,0.88);
        color: #f7ead0;
        border-radius: 999px;
        padding: 10px 14px;
        font-size: 12px;
        letter-spacing: 0.08em;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      }

      .rz-auth-button:hover {
        background: rgba(22,18,12,0.96);
        border-color: rgba(255,220,150,0.32);
        transform: translateY(-1px);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-button:not(.rz-auth-button-bound) {
        background:
          linear-gradient(180deg, rgba(255,252,244,0.96), rgba(236,226,204,0.94));
        color: #2b1706;
        border-color: rgba(120,75,18,0.22);
        box-shadow:
          0 8px 28px rgba(0,0,0,0.12),
          0 0 18px rgba(216,163,77,0.14),
          inset 0 1px 0 rgba(255,255,255,0.75);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-button:not(.rz-auth-button-bound):hover {
        background:
          linear-gradient(180deg, rgba(255,249,232,1), rgba(232,214,174,0.98));
        border-color: rgba(138,91,24,0.34);
        box-shadow:
          0 10px 32px rgba(0,0,0,0.15),
          0 0 24px rgba(216,163,77,0.22),
          inset 0 1px 0 rgba(255,255,255,0.82);
      }

      html[data-renzu-auth-theme="dark"] .rz-auth-button:not(.rz-auth-button-bound) {
        background:
          radial-gradient(circle at 50% 0%, rgba(255,220,150,0.12), transparent 45%),
          rgba(8,8,10,0.94);
        color: #f7ead0;
        border-color: rgba(255,220,150,0.22);
        box-shadow:
          0 10px 34px rgba(0,0,0,0.70),
          0 0 24px rgba(216,163,77,0.18),
          inset 0 1px 0 rgba(255,255,255,0.08);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-button:not(.rz-auth-button-bound) {
        background:
          linear-gradient(180deg, rgba(242,223,182,0.98), rgba(207,168,91,0.96));
        color: #2a1502;
        border-color: rgba(95,55,9,0.30);
        box-shadow:
          0 8px 26px rgba(58,27,4,0.22),
          0 0 14px rgba(139,94,26,0.16),
          inset 0 1px 0 rgba(255,235,180,0.42);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-button:not(.rz-auth-button-bound):hover {
        background:
          linear-gradient(180deg, rgba(247,228,186,1), rgba(196,141,49,0.98));
        border-color: rgba(95,55,9,0.42);
      }

      .rz-auth-button-bound {
        width: 52px;
        height: 52px;
        padding: 0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
        background:
          radial-gradient(circle at 50% 34%, rgba(255,252,239,0.98) 0%, rgba(247,231,190,0.90) 34%, rgba(64,42,18,0.92) 100%);
        border-color: rgba(216,163,77,0.58);
        box-shadow:
          0 9px 30px rgba(0,0,0,0.30),
          0 0 0 1px rgba(255,255,255,0.46),
          0 0 24px rgba(216,163,77,0.30),
          inset 0 1px 0 rgba(255,255,255,0.58),
          inset 0 -12px 22px rgba(40,24,8,0.20);
      }

      .rz-auth-button-bound:hover {
        background:
          radial-gradient(circle at 50% 34%, rgba(255,252,239,1) 0%, rgba(255,235,185,0.94) 36%, rgba(54,34,14,0.96) 100%);
        box-shadow:
          0 11px 34px rgba(0,0,0,0.36),
          0 0 0 1px rgba(255,255,255,0.55),
          0 0 32px rgba(216,163,77,0.42),
          inset 0 1px 0 rgba(255,255,255,0.65),
          inset 0 -12px 24px rgba(40,24,8,0.24);
      }

      .rz-fate-spider {
        width: 30px;
        height: 30px;
        overflow: visible;
        display: block;
        filter: drop-shadow(0 0 5px rgba(216,163,77,0.72)) drop-shadow(0 1px 1px rgba(0,0,0,0.28));
      }

      .rz-fate-spider .rz-spider-head,
      .rz-fate-spider .rz-spider-body,
      .rz-fate-spider .rz-spider-mark {
        fill: url(#rzSpiderGlow);
      }

      .rz-fate-spider .rz-spider-web,
      .rz-fate-spider .rz-spider-legs {
        fill: none;
        stroke: #b77a25;
        stroke-width: 2.45;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.98;
      }

      .rz-fate-spider .rz-spider-web {
        stroke-width: 1.6;
        opacity: 0.68;
      }

      .rz-fate-spider .rz-spider-mark {
        opacity: 0.9;
        filter: drop-shadow(0 0 4px rgba(255,244,214,0.6));
      }
      html[data-renzu-auth-theme="dark"] .rz-auth-button-bound {
        background:
          radial-gradient(circle at 50% 32%, rgba(255,244,214,0.24) 0%, rgba(216,163,77,0.16) 42%, rgba(3,3,4,0.94) 100%);
        border-color: rgba(255,220,150,0.34);
        box-shadow:
          0 10px 34px rgba(0,0,0,0.72),
          0 0 30px rgba(216,163,77,0.30),
          inset 0 1px 0 rgba(255,255,255,0.10),
          inset 0 -12px 22px rgba(0,0,0,0.34);
      }

      html[data-renzu-auth-theme="dark"] .rz-fate-spider .rz-spider-web,
      html[data-renzu-auth-theme="dark"] .rz-fate-spider .rz-spider-legs {
        stroke: #f0c56a;
        opacity: 0.96;
      }

      html[data-renzu-auth-theme="dark"] .rz-fate-spider {
        filter: drop-shadow(0 0 7px rgba(240,197,106,0.72)) drop-shadow(0 1px 1px rgba(0,0,0,0.65));
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-button-bound {
        background:
          radial-gradient(circle at 50% 34%, rgba(255,241,198,0.92) 0%, rgba(196,141,49,0.60) 42%, rgba(77,43,9,0.88) 100%);
        border-color: rgba(96,55,12,0.48);
        box-shadow:
          0 8px 28px rgba(58,27,4,0.32),
          0 0 18px rgba(139,94,26,0.22),
          inset 0 1px 0 rgba(255,235,180,0.38),
          inset 0 -12px 22px rgba(71,38,8,0.20);
      }

      html[data-renzu-auth-theme="scroll"] .rz-fate-spider .rz-spider-web,
      html[data-renzu-auth-theme="scroll"] .rz-fate-spider .rz-spider-legs {
        stroke: #5d3509;
        opacity: 0.92;
      }

      html[data-renzu-auth-theme="scroll"] .rz-fate-spider .rz-spider-head,
      html[data-renzu-auth-theme="scroll"] .rz-fate-spider .rz-spider-body,
      html[data-renzu-auth-theme="scroll"] .rz-fate-spider .rz-spider-mark {
        fill: #7a4a13;
      }


      .rz-auth-backdrop {
        position: fixed;
        right: 14px;
        bottom: 64px;
        z-index: 99998;
        width: min(420px, calc(100vw - 24px));
        background: transparent;
        display: block;
        padding: 0;
        font-family: Georgia, serif;
      }

      .rz-auth-modal {
        width: 100%;
        border-radius: 24px;
        border: 1px solid rgba(255,220,150,0.24);
        background:
          radial-gradient(circle at 50% 0%, rgba(255,220,150,0.12), transparent 34%),
          linear-gradient(180deg, rgba(18,14,10,0.98), rgba(7,6,5,0.98));
        color: #f7ead0;
        box-shadow: 0 22px 80px rgba(0,0,0,0.65);
        overflow: hidden;
        animation: rzAuthRise 0.18s ease both;
      }

      @keyframes rzAuthRise {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes rzAuthSheetRise {
        from {
          opacity: 0;
          transform: translateY(26px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .rz-auth-head {
        padding: 22px 24px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }

      .rz-auth-kicker {
        font-size: 9px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(255,230,180,0.58);
        margin-bottom: 8px;
      }

      .rz-auth-title {
        font-size: 22px;
        line-height: 1.15;
        font-weight: 700;
        color: #fff4d6;
      }

      .rz-auth-body {
        padding: 20px 24px 24px;
      }

      .rz-auth-text {
        font-size: 13px;
        line-height: 1.65;
        color: rgba(247,234,208,0.72);
        margin-bottom: 16px;
      }

      .rz-auth-input {
        width: 100%;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        background: rgba(0,0,0,0.35);
        color: #fff7e6;
        padding: 12px 14px;
        outline: none;
        font-size: 14px;
        margin-bottom: 10px;
        box-sizing: border-box;
      }

      .rz-auth-input::placeholder {
        color: rgba(247,234,208,0.36);
      }

      .rz-auth-input:focus {
        border-color: rgba(255,220,150,0.45);
      }

      .rz-auth-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .rz-auth-primary,
      .rz-auth-secondary {
        border-radius: 12px;
        padding: 11px 14px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.12);
        font-family: Georgia, serif;
        font-weight: 600;
      }

      .rz-auth-primary:disabled,
      .rz-auth-secondary:disabled {
        cursor: not-allowed;
        opacity: 0.62;
        transform: none !important;
      }

      .rz-auth-primary {
        flex: 1;
        background: rgba(255,220,150,0.16);
        color: #fff4d6;
      }

      .rz-auth-primary:hover {
        background: rgba(255,220,150,0.24);
      }

      .rz-auth-primary:disabled,
      .rz-auth-primary:disabled:hover {
        background: rgba(255,220,150,0.07);
        color: rgba(247,234,208,0.42);
        border-color: rgba(255,255,255,0.08);
        box-shadow: none;
        font-weight: 500;
      }

      .rz-auth-secondary {
        background: transparent;
        color: rgba(247,234,208,0.68);
      }

      .rz-auth-secondary:hover {
        background: rgba(255,255,255,0.06);
      }

      .rz-auth-status {
        margin-top: 12px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(255,230,180,0.68);
      }

      .rz-auth-profile-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }

      .rz-auth-profile-row span:first-child {
        color: rgba(247,234,208,0.55);
      }

      .rz-auth-profile-row span:last-child {
        color: #fff4d6;
        text-align: right;
        overflow-wrap: anywhere;
      }

      .rz-auth-code-wrap {
        display: none;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }

      .rz-auth-gate-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99998;
        padding: max(18px, env(safe-area-inset-top, 18px)) 16px max(18px, env(safe-area-inset-bottom, 18px));
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        font-family: Georgia, serif;
        background:
          radial-gradient(circle at 50% 18%, rgba(216,163,77,0.22), transparent 32%),
          radial-gradient(circle at 14% 80%, rgba(98,232,255,0.08), transparent 24%),
          rgba(5,4,4,0.86);
        backdrop-filter: blur(16px) saturate(1.15);
        -webkit-backdrop-filter: blur(16px) saturate(1.15);
        animation: rzGateFade 0.22s ease both;
      }

      .rz-auth-gate {
        width: min(720px, 94vw);
        min-height: min(560px, calc(100vh - 42px));
        max-height: calc(100vh - 34px);
        position: relative;
        overflow: hidden;
        border-radius: 30px;
        border: 1px solid rgba(255,220,150,0.25);
        background:
          radial-gradient(circle at 50% 0%, rgba(255,220,150,0.16), transparent 30%),
          linear-gradient(180deg, rgba(20,14,9,0.98), rgba(5,4,4,0.98));
        color: #f7ead0;
        box-shadow:
          0 32px 100px rgba(0,0,0,0.72),
          0 0 0 1px rgba(255,255,255,0.04),
          inset 0 1px 0 rgba(255,255,255,0.08);
        animation: rzGateRise 0.25s cubic-bezier(.2,.8,.25,1) both;
      }

      .rz-auth-gate::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.10;
        background:
          radial-gradient(circle at 22% 18%, rgba(216,163,77,0.22), transparent 24%),
          radial-gradient(circle at 82% 82%, rgba(216,163,77,0.12), transparent 28%);
      }

      .rz-auth-gate-watermark {
        position: absolute;
        right: -250px;
        bottom: -190px;
        width: min(640px, 90vw);
        height: min(640px, 90vw);
        z-index: 1;
        pointer-events: none;
        opacity: 0.075;
        transform: rotate(-12deg);
        filter: drop-shadow(0 0 26px rgba(216,163,77,0.20));
      }

      .rz-auth-gate-watermark .rz-fate-spider {
        width: 100%;
        height: 100%;
        filter: none;
      }

      .rz-auth-gate-watermark .rz-spider-head,
      .rz-auth-gate-watermark .rz-spider-body,
      .rz-auth-gate-watermark .rz-spider-mark {
        fill: none !important;
        stroke: rgba(255,220,150,0.72);
        stroke-width: 1.25;
      }

      .rz-auth-gate-watermark .rz-spider-web,
      .rz-auth-gate-watermark .rz-spider-legs {
        stroke: rgba(255,220,150,0.72);
        stroke-width: 1.08;
        opacity: 1;
      }

      .rz-auth-gate-watermark .rz-spider-web {
        stroke-width: 0.75;
        opacity: 0.72;
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-watermark {
        opacity: 0.055;
        filter: drop-shadow(0 0 14px rgba(120,75,18,0.12));
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-watermark .rz-spider-head,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-watermark .rz-spider-body,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-watermark .rz-spider-mark,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-watermark .rz-spider-web,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-watermark .rz-spider-legs {
        stroke: rgba(80,45,8,0.75);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-watermark {
        opacity: 0.12;
        filter: drop-shadow(0 0 18px rgba(75,43,8,0.16));
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-watermark .rz-spider-head,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-watermark .rz-spider-body,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-watermark .rz-spider-mark,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-watermark .rz-spider-web,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-watermark .rz-spider-legs {
        stroke: rgba(70,38,5,0.72);
      }

      .rz-auth-gate-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        color: rgba(247,234,208,0.70);
        cursor: pointer;
        z-index: 4;
      }

      .rz-auth-gate-inner {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1fr 0.92fr;
        min-height: inherit;
      }

      .rz-auth-gate-lore {
        padding: 44px 38px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-right: 1px solid rgba(255,255,255,0.07);
      }

      .rz-auth-gate-form {
        padding: 44px 34px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: rgba(0,0,0,0.16);
      }

      .rz-auth-gate-sigil {
        width: 92px;
        height: 92px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        background:
          radial-gradient(circle at 50% 35%, rgba(255,248,225,0.30), rgba(216,163,77,0.13) 46%, rgba(0,0,0,0.20) 100%);
        border: 1px solid rgba(255,220,150,0.38);
        box-shadow: 0 0 44px rgba(216,163,77,0.23), inset 0 1px 0 rgba(255,255,255,0.13);
      }

      .rz-auth-gate-sigil .rz-fate-spider {
        width: 52px;
        height: 52px;
      }

      .rz-auth-gate-kicker {
        font-size: 10px;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: rgba(255,230,180,0.56);
        margin-bottom: 12px;
      }

      .rz-auth-gate-title {
        font-size: clamp(32px, 6vw, 56px);
        line-height: 0.98;
        font-weight: 800;
        color: #fff4d6;
        text-shadow: 0 0 26px rgba(216,163,77,0.20);
        margin-bottom: 20px;
      }

      .rz-auth-gate-copy {
        font-size: 15px;
        line-height: 1.8;
        color: rgba(247,234,208,0.72);
        max-width: 38em;
      }

      .rz-auth-gate-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 24px;
      }

      .rz-auth-gate-pill {
        border: 1px solid rgba(255,220,150,0.18);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(247,234,208,0.64);
        background: rgba(255,220,150,0.06);
      }

      .rz-auth-gate-form-title {
        font-size: 20px;
        color: #fff4d6;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .rz-auth-gate-form-note {
        font-size: 13px;
        line-height: 1.65;
        color: rgba(247,234,208,0.64);
        margin-bottom: 18px;
      }

      @keyframes rzGateFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes rzGateRise {
        from { opacity: 0; transform: translateY(18px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-backdrop {
        background:
          radial-gradient(circle at 50% 18%, rgba(216,163,77,0.18), transparent 32%),
          rgba(246,242,234,0.78);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate {
        background:
          radial-gradient(circle at 50% 0%, rgba(216,163,77,0.16), transparent 32%),
          linear-gradient(180deg, rgba(255,252,244,0.98), rgba(236,226,204,0.98));
        color: #211407;
        border-color: rgba(120,75,18,0.22);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-title,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-form-title {
        color: #2b1706;
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-copy,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-form-note {
        color: rgba(35,22,9,0.70);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-kicker,
      html[data-renzu-auth-theme="light"] .rz-auth-gate-pill {
        color: rgba(75,46,12,0.72);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-form {
        background: rgba(70,40,8,0.045);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-lore {
        border-right-color: rgba(80,50,12,0.10);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate-close {
        color: rgba(35,22,9,0.65);
        background: rgba(255,255,255,0.34);
        border-color: rgba(80,50,12,0.12);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-primary {
        background: linear-gradient(180deg, #3a2109, #241305);
        color: #fff4d6;
        border-color: rgba(58,33,9,0.45);
        box-shadow: 0 8px 22px rgba(58,33,9,0.18), inset 0 1px 0 rgba(255,255,255,0.10);
        font-weight: 700;
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-primary:hover {
        background: linear-gradient(180deg, #4a2b0d, #2a1706);
        box-shadow: 0 10px 28px rgba(58,33,9,0.24), 0 0 18px rgba(216,163,77,0.18), inset 0 1px 0 rgba(255,255,255,0.12);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-primary:disabled,
      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-primary:disabled:hover {
        background: rgba(74,43,13,0.12);
        color: rgba(43,23,6,0.42);
        border-color: rgba(80,50,12,0.12);
        box-shadow: none;
        font-weight: 500;
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-status {
        color: rgba(43,23,6,0.62);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-secondary {
        background: rgba(255,255,255,0.42);
        color: rgba(43,23,6,0.72);
        border-color: rgba(80,50,12,0.18);
      }

      html[data-renzu-auth-theme="light"] .rz-auth-gate .rz-auth-secondary:hover {
        background: rgba(255,246,222,0.76);
        color: #2b1706;
      }

      html[data-renzu-auth-theme="dark"] .rz-auth-gate .rz-auth-status {
        color: rgba(255,230,180,0.72);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-backdrop {
        background:
          radial-gradient(circle at 50% 18%, rgba(120,72,12,0.18), transparent 34%),
          rgba(210,174,98,0.76);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate {
        background:
          radial-gradient(circle at 50% 0%, rgba(95,55,9,0.12), transparent 32%),
          linear-gradient(180deg, rgba(241,220,170,0.98), rgba(207,168,91,0.98));
        color: #2a1502;
        border-color: rgba(95,55,9,0.30);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-title,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-form-title {
        color: #2a1502;
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-copy,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-form-note {
        color: rgba(42,21,2,0.72);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-kicker,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-pill {
        color: rgba(75,43,8,0.78);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-form {
        background: rgba(90,50,8,0.07);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-lore {
        border-right-color: rgba(80,45,8,0.14);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate-close {
        color: rgba(42,21,2,0.68);
        background: rgba(255,240,200,0.24);
        border-color: rgba(80,45,8,0.16);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate .rz-auth-primary {
        background: linear-gradient(180deg, #6b4310, #3f2407);
        color: #fff3cf;
        border-color: rgba(80,45,8,0.45);
        box-shadow: 0 8px 22px rgba(58,27,4,0.20), inset 0 1px 0 rgba(255,235,180,0.18);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate .rz-auth-primary:hover {
        background: linear-gradient(180deg, #7b5018, #4a2b0b);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate .rz-auth-primary:disabled,
      html[data-renzu-auth-theme="scroll"] .rz-auth-gate .rz-auth-primary:disabled:hover {
        background: rgba(80,45,8,0.12);
        color: rgba(42,21,2,0.42);
        border-color: rgba(80,45,8,0.12);
        box-shadow: none;
        font-weight: 500;
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate .rz-auth-status {
        color: rgba(42,21,2,0.66);
      }

      html[data-renzu-auth-theme="scroll"] .rz-auth-gate .rz-auth-secondary {
        background: rgba(255,238,196,0.22);
        color: rgba(42,21,2,0.70);
        border-color: rgba(80,45,8,0.20);
      }

      @media (max-width: 640px) {
        .rz-auth-root {
          right: 12px;
          bottom: max(12px, env(safe-area-inset-bottom, 12px));
        }

        .rz-auth-button {
          padding: 9px 12px;
          font-size: 11px;
        }

        .rz-auth-button-bound {
          width: 48px;
          height: 48px;
          padding: 0;
        }

        .rz-fate-spider {
          width: 29px;
          height: 29px;
        }

        .rz-auth-backdrop {
          left: 0;
          right: 0;
          bottom: 0;
          width: auto;
          padding: 0 10px max(10px, env(safe-area-inset-bottom, 10px));
          pointer-events: none;
        }

        .rz-auth-modal {
          pointer-events: auto;
          border-radius: 24px 24px 18px 18px;
          max-height: min(78vh, 560px);
          overflow-y: auto;
          animation: rzAuthSheetRise 0.22s cubic-bezier(.2,.8,.25,1) both;
        }

        .rz-auth-head {
          padding: 18px 20px 12px;
        }

        .rz-auth-body {
          padding: 16px 20px 20px;
        }

        .rz-auth-title {
          font-size: 20px;
        }

        .rz-auth-gate-inner {
          grid-template-columns: 1fr;
        }

        .rz-auth-gate {
          width: calc(100vw - 26px);
          max-height: calc(100dvh - 34px);
          border-radius: 24px;
        }

        .rz-auth-gate-lore {
          padding: 26px 22px 16px;
          border-right: none;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .rz-auth-gate-form {
          padding: 20px 22px 22px;
        }

        .rz-auth-gate-copy {
          font-size: 13.5px;
          line-height: 1.65;
        }

        .rz-auth-gate-pills {
          margin-top: 16px;
        }

        .rz-auth-gate-watermark {
          right: -230px;
          bottom: -210px;
          top: auto;
          width: 520px;
          height: 520px;
          opacity: 0.055;
        }

        .rz-auth-gate-sigil {
          width: 72px;
          height: 72px;
          margin-bottom: 18px;
        }

        .rz-auth-gate-sigil .rz-fate-spider {
          width: 42px;
          height: 42px;
        }

        .rz-auth-gate-title {
          font-size: clamp(30px, 12vw, 42px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function detectRenzuTheme() {
    const appRoot = document.getElementById("root");
    const appShell = appRoot && appRoot.firstElementChild;
    const raw = [
      appShell && appShell.getAttribute("style"),
      appShell && appShell.style && appShell.style.background,
      document.body && document.body.getAttribute("style"),
      document.documentElement && document.documentElement.getAttribute("style")
    ].filter(Boolean).join(" ").toLowerCase();

    if (raw.includes("#000") || raw.includes("0, 0, 0") || raw.includes("rgb(0, 0, 0)")) {
      return "dark";
    }

    if (
      raw.includes("#cba85e") ||
      raw.includes("#dfc48a") ||
      raw.includes("#be9844") ||
      raw.includes("203, 168, 94") ||
      raw.includes("scroll")
    ) {
      return "scroll";
    }

    return "light";
  }

  function updateRenzuTheme() {
    try {
      document.documentElement.setAttribute("data-renzu-auth-theme", detectRenzuTheme());
    } catch (_) {}
  }

  function watchRenzuTheme() {
    updateRenzuTheme();

    const appRoot = document.getElementById("root");
    const appShell = appRoot && appRoot.firstElementChild;

    if (window.MutationObserver && appShell) {
      const observer = new MutationObserver(updateRenzuTheme);
      observer.observe(appShell, { attributes: true, attributeFilter: ["style", "class"] });
    }

    setInterval(updateRenzuTheme, 900);
  }

  function getDeviceId() {
    try {
      let id = localStorage.getItem("renzu_device_id");

      if (!id) {
        id =
          "d-" +
          Math.random().toString(36).slice(2, 10) +
          "-" +
          Date.now().toString(36);

        localStorage.setItem("renzu_device_id", id);
      }

      return id;
    } catch (_) {
      return "d-" + Math.random().toString(36).slice(2) + Date.now();
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();

      const existing = document.querySelector(`script[src="${src}"]`);

      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");

    const res = await fetch("/api/public-config");
    const cfg = await res.json();

    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw new Error("Missing Supabase public config");
    }

    supabaseClient = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    const { data } = await supabaseClient.auth.getSession();

    session = data.session || null;
    currentUser = session ? session.user : null;

    supabaseClient.auth.onAuthStateChange(async (_event, newSession) => {
      session = newSession || null;
      currentUser = session ? session.user : null;

      if (session) {
        await linkDevice();
      }

      renderButton();

      window.dispatchEvent(
        new CustomEvent("renzu-auth-change", {
          detail: {
            session,
            user: currentUser
          }
        })
      );
    });

    if (session) {
      await linkDevice();
    }

    return supabaseClient;
  }

  async function linkDevice() {
    if (!session || !session.access_token) return;

    const deviceId = getDeviceId();

    try {
      const res = await fetch("/api/link-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({
          deviceId
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("Device link failed:", data.error || res.status);
      }
    } catch (err) {
      console.warn("Device link failed:", err);
    }
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);

    if (modal) modal.remove();
  }

  function toggleModal() {
    const modal = document.getElementById(MODAL_ID);

    if (modal) {
      closeModal();
    } else {
      openModal();
    }
  }

  function openGate() {
    closeModal();
    updateRenzuTheme();

    const root = document.createElement("div");
    root.id = MODAL_ID;
    root.className = "rz-auth-gate-backdrop";

    root.innerHTML = `
      <div class="rz-auth-gate">
        <div class="rz-auth-gate-watermark">${FATE_SPIDER_SVG}</div>
        <button class="rz-auth-gate-close" id="rz-auth-close" aria-label="Close Gate of Fate">✕</button>
        <div class="rz-auth-gate-inner">
          <div class="rz-auth-gate-lore">
            <div class="rz-auth-gate-sigil">${FATE_SPIDER_SVG}</div>
            <div class="rz-auth-gate-kicker">The Legends of Ren Zu</div>
            <div class="rz-auth-gate-title">Gate of Fate</div>
            <div class="rz-auth-gate-copy">
              Bind your soul mark to The Omniarch. Your realm, essence, Gu collection, bookmarks, and progress will follow you across devices.
            </div>
            <div class="rz-auth-gate-pills">
              <span class="rz-auth-gate-pill">No password</span>
              <span class="rz-auth-gate-pill">Sacred code</span>
              <span class="rz-auth-gate-pill">Realm sync</span>
              <span class="rz-auth-gate-pill">Fate web bound</span>
            </div>
          </div>

          <div class="rz-auth-gate-form">
            <div class="rz-auth-gate-form-title">Open the Archive</div>
            <div class="rz-auth-gate-form-note">
              Enter your email. The Omniarch will send a sacred code to complete the binding.
            </div>

            <input class="rz-auth-input" id="rz-auth-email" type="email" placeholder="you@example.com" />

            <div class="rz-auth-actions">
              <button class="rz-auth-secondary" id="rz-auth-close-secondary">Cancel</button>
              <button class="rz-auth-primary" id="rz-auth-send" disabled>Send code</button>
            </div>

            <div class="rz-auth-code-wrap" id="rz-auth-code-wrap">
              <input class="rz-auth-input" id="rz-auth-code" type="text" inputmode="numeric" maxlength="8" placeholder="Enter sacred code" />

              <div class="rz-auth-actions">
                <button class="rz-auth-secondary" id="rz-auth-resend">Resend</button>
                <button class="rz-auth-primary" id="rz-auth-verify">Bind Soul Mark</button>
              </div>
            </div>

            <div class="rz-auth-status" id="rz-auth-status"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    bindAuthFormEvents();
  }

  function updateSendButtonState() {
    const emailInput = document.getElementById("rz-auth-email");
    const sendBtn = document.getElementById("rz-auth-send");

    if (!sendBtn) return;

    const hasText = !!(emailInput && emailInput.value.trim());
    sendBtn.disabled = !hasText;
  }

  function bindAuthFormEvents() {
    const closeBtn = document.getElementById("rz-auth-close");
    const closeBtn2 = document.getElementById("rz-auth-close-secondary");

    if (closeBtn) closeBtn.onclick = closeModal;
    if (closeBtn2) closeBtn2.onclick = closeModal;

    const signoutBtn = document.getElementById("rz-auth-signout");
    if (signoutBtn) signoutBtn.onclick = signOut;

    const sendBtn = document.getElementById("rz-auth-send");
    if (sendBtn) sendBtn.onclick = sendLoginCode;

    const resendBtn = document.getElementById("rz-auth-resend");
    if (resendBtn) resendBtn.onclick = sendLoginCode;

    const verifyBtn = document.getElementById("rz-auth-verify");
    if (verifyBtn) verifyBtn.onclick = verifyLoginCode;

    const codeInput = document.getElementById("rz-auth-code");
    if (codeInput) {
      codeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") verifyLoginCode();
      });
    }

    const emailInput = document.getElementById("rz-auth-email");
    if (emailInput) {
      emailInput.addEventListener("input", updateSendButtonState);

      emailInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") sendLoginCode();
      });

      updateSendButtonState();

      setTimeout(() => {
        try { emailInput.focus(); } catch (_) {}
        updateSendButtonState();
      }, 50);
    }
  }

  function openModal() {
    closeModal();

    if (!currentUser) {
      openGate();
      return;
    }

    const root = document.createElement("div");
    root.id = MODAL_ID;
    root.className = "rz-auth-backdrop";

    const loggedIn = !!currentUser;

    root.innerHTML = `
      <div class="rz-auth-modal">
        <div class="rz-auth-head">
          <div class="rz-auth-kicker">The Legends of Ren Zu</div>
          <div class="rz-auth-title">${
            loggedIn ? "Bound by Fate" : "Open the Archive"
          }</div>
        </div>

        <div class="rz-auth-body">
          ${
            loggedIn
              ? `
                <div class="rz-auth-text">
                  Your soul mark is now woven into The Omniarch. Your realm, essence, Gu collection, bookmarks, and progress can follow you across devices.
                </div>

                <div class="rz-auth-profile-row">
                  <span>Email</span>
                  <span>${escapeHtml(currentUser.email || "Unknown")}</span>
                </div>

                <div class="rz-auth-profile-row">
                  <span>User ID</span>
                  <span>${escapeHtml(currentUser.id.slice(0, 8))}…</span>
                </div>

                <div class="rz-auth-actions" style="margin-top:16px;">
                  <button class="rz-auth-secondary" id="rz-auth-close">Close</button>
                  <button class="rz-auth-primary" id="rz-auth-signout">Sign out</button>
                </div>

                <div class="rz-auth-status" id="rz-auth-status"></div>
              `
              : `
                <div class="rz-auth-text">
                  Enter your email. No password needed. The Omniarch will send your sacred code.
                </div>

                <input class="rz-auth-input" id="rz-auth-email" type="email" placeholder="you@example.com" />

                <div class="rz-auth-actions">
                  <button class="rz-auth-secondary" id="rz-auth-close">Cancel</button>
                  <button class="rz-auth-primary" id="rz-auth-send" disabled>Send code</button>
                </div>

                <div class="rz-auth-code-wrap" id="rz-auth-code-wrap">
                  <input class="rz-auth-input" id="rz-auth-code" type="text" inputmode="numeric" maxlength="8" placeholder="Enter sacred code" />

                  <div class="rz-auth-actions">
                    <button class="rz-auth-secondary" id="rz-auth-resend">Resend</button>
                    <button class="rz-auth-primary" id="rz-auth-verify">Open Archive</button>
                  </div>
                </div>

                <div class="rz-auth-status" id="rz-auth-status"></div>
              `
          }
        </div>
      </div>
    `;

    document.body.appendChild(root);
    bindAuthFormEvents();
  }

  function setStatus(text) {
    const status = document.getElementById("rz-auth-status");

    if (status) {
      status.textContent = text || "";
    }
  }

  async function sendLoginCode() {
    const emailInput = document.getElementById("rz-auth-email");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("The Omniarch is sending your code…");

    try {
      const client = await initSupabase();

      const redirectTo = window.location.origin + "/";

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true
        }
      });

      if (error) throw error;

      const codeWrap = document.getElementById("rz-auth-code-wrap");

      if (codeWrap) {
        codeWrap.style.display = "block";
      }

      const codeInput = document.getElementById("rz-auth-code");

      if (codeInput) {
        setTimeout(() => {
          try {
            codeInput.focus();
          } catch (_) {}
        }, 50);
      }

      setStatus("Code sent by The Omniarch. Check your email.");
    } catch (err) {
      setStatus(err.message || "Could not send login code.");
    }
  }

  async function verifyLoginCode() {
    const emailInput = document.getElementById("rz-auth-email");
    const codeInput = document.getElementById("rz-auth-code");

    const email = emailInput ? emailInput.value.trim() : "";
    const token = codeInput ? codeInput.value.trim().replace(/\s+/g, "") : "";

    if (!email) {
      setStatus("Enter your email first.");
      return;
    }

    if (!token || token.length < 6) {
      setStatus("Enter the sacred code.");
      return;
    }

    setStatus("Opening the archive…");

    try {
      const client = await initSupabase();

      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email"
      });

      if (error) throw error;

      session = data.session || null;
      currentUser = data.user || (session ? session.user : null);

      if (session) {
        await linkDevice();
      }

      closeModal();
      renderButton();

      window.dispatchEvent(
        new CustomEvent("renzu-auth-change", {
          detail: {
            session,
            user: currentUser
          }
        })
      );
    } catch (err) {
      setStatus(err.message || "Invalid or expired code.");
    }
  }

  async function signOut() {
    setStatus("Severing the soul mark…");

    try {
      const client = await initSupabase();

      await client.auth.signOut({
        scope: "local"
      });

      session = null;
      currentUser = null;

      closeModal();
      renderButton();

      window.dispatchEvent(
        new CustomEvent("renzu-auth-change", {
          detail: {
            session: null,
            user: null
          }
        })
      );

      setTimeout(() => {
        renderButton();
      }, 100);
    } catch (err) {
      setStatus(err.message || "Could not sign out.");
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderButton() {
    injectStyle();
    updateRenzuTheme();

    let root = document.getElementById(ROOT_ID);

    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.className = "rz-auth-root";
      document.body.appendChild(root);
    }

    const isBound = !!currentUser;

    root.innerHTML = `
      <button
        class="rz-auth-button ${isBound ? "rz-auth-button-bound" : ""}"
        id="rz-auth-open"
        aria-label="${isBound ? "Open bound profile" : "Login"}"
        title="${isBound ? "Open Profile" : "Login"}"
      >
        ${isBound ? FATE_SPIDER_SVG : "Login"}
      </button>
    `;

    const openBtn = document.getElementById("rz-auth-open");

    if (isBound) {
      openBtn.onclick = () => {
        window.dispatchEvent(new CustomEvent("renzu-open-profile"));
      };
    } else {
      openBtn.onclick = openGate;
    }
  }

  window.RenZuAuth = {
    init: initSupabase,

    getSession: function () {
      return session;
    },

    getUser: function () {
      return currentUser;
    },

    openGate,

    getAccessToken: async function () {
      await initSupabase();

      const { data } = await supabaseClient.auth.getSession();

      return data.session ? data.session.access_token : null;
    },

    signOut
  };

  document.addEventListener("click", function (e) {
    const modal = document.getElementById(MODAL_ID);
    const root = document.getElementById(ROOT_ID);

    if (!modal) return;

    if (modal.contains(e.target)) return;
    if (root && root.contains(e.target)) return;

    closeModal();
  });

  document.addEventListener("DOMContentLoaded", async function () {
    watchRenzuTheme();
    renderButton();

    try {
      await initSupabase();
      renderButton();
    } catch (err) {
      console.warn("RenZuAuth init failed:", err);
    }
  });
})();
