/**
 * report-auth.js
 * 月次レポートページ共通の認証ガード。
 * 課金サポーター（isActiveMember）のみアクセスを許可する。
 *
 * 使い方: レポートページの <head> に以下を一行追加するだけ。
 *   <script type="module" src="/js/report-auth.js"></script>
 */

import { initializeApp }       from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            "AIzaSyDFnIZ3dV3DxneBvpGK3cXzJBt8zbYhVRo",
  authDomain:        "kikinagashi-ijinden.firebaseapp.com",
  projectId:         "kikinagashi-ijinden",
  storageBucket:     "kikinagashi-ijinden.firebasestorage.app",
  messagingSenderId: "601294846428",
  appId:             "1:601294846428:web:f1b80a5cbb5f613f04f719",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── ローディングオーバーレイを注入 ──
const overlay = document.createElement('div');
overlay.id = 'report-auth-overlay';
overlay.style.cssText = [
  'position:fixed', 'inset:0', 'background:#f8fafc', 'z-index:9999',
  'display:flex', 'flex-direction:column', 'align-items:center',
  'justify-content:center', 'gap:1rem',
].join(';');
overlay.innerHTML = `
  <div style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#1e3a8a;border-radius:50%;animation:__spin .8s linear infinite;"></div>
  <p style="font-family:'Noto Sans JP',sans-serif;font-size:13px;color:#94a3b8;">認証情報を確認中…</p>
  <style>@keyframes __spin{to{transform:rotate(360deg)}}</style>
`;
document.documentElement.appendChild(overlay);

// ── 認証チェック ──
onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    // 未ログイン → ログイン後にこのページへ戻れるよう保存してからリダイレクト
    sessionStorage.setItem('login_redirect', window.location.href);
    window.location.href = '/auth/login.html';
    return;
  }

  const token = await firebaseUser.getIdTokenResult();

  if (!token.claims.isActiveMember) {
    // 課金していない
    if (token.claims.isMember) {
      window.location.href = '/upgrade.html';
    } else {
      sessionStorage.setItem('login_redirect', window.location.href);
      window.location.href = '/auth/login.html';
    }
    return;
  }

  // 課金サポーター → オーバーレイ解除
  overlay.remove();
});
