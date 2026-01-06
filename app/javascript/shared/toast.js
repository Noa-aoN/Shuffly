/**
 * Toast通知を表示する共通関数
 * @param {string} message - 表示するメッセージ
 * @param {number} duration - 表示時間（ミリ秒）、デフォルト3000ms
 */
export function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found');
    return;
  }

  // 位置とスタイルを設定
  toast.style.top = '100px';
  toast.style.bottom = 'auto';
  toast.style.left = '50%';
  toast.style.zIndex = '1000';

  // メッセージを設定
  toast.textContent = message;

  // 表示
  toast.classList.remove('opacity-0');

  // 自動的に非表示
  setTimeout(() => {
    toast.classList.add('opacity-0');
  }, duration);
}

// グローバルに公開（既存コードとの互換性のため）
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
