// パフォーマンス最適化ユーティリティ

/**
 * デバウンス関数 - 連続した関数呼び出しを制限
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * スロットル関数 - 関数の実行頻度を制限
 * @param {Function} func - 実行する関数
 * @param {number} limit - 制限時間（ミリ秒）
 * @returns {Function} スロットルされた関数
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 仮想スクロール - 大量のアイテムを効率的に表示
 * @param {Array} items - 表示するアイテムの配列
 * @param {HTMLElement} container - コンテナ要素
 * @param {Function} renderItem - アイテムをレンダリングする関数
 * @param {number} itemHeight - 各アイテムの高さ（ピクセル）
 */
export class VirtualScroll {
  constructor(items, container, renderItem, itemHeight = 40) {
    this.items = items;
    this.container = container;
    this.renderItem = renderItem;
    this.itemHeight = itemHeight;
    this.visibleItems = Math.ceil(container.clientHeight / itemHeight) + 5;
    this.scrollTop = 0;

    this.init();
  }

  init() {
    // スクロールイベントをスロットル
    this.container.addEventListener('scroll', throttle(() => {
      this.scrollTop = this.container.scrollTop;
      this.render();
    }, 100));

    this.render();
  }

  render() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleItems, this.items.length);

    // コンテナをクリア
    this.container.innerHTML = '';

    // 上部のスペーサー
    const topSpacer = document.createElement('div');
    topSpacer.style.height = `${startIndex * this.itemHeight}px`;
    this.container.appendChild(topSpacer);

    // 表示するアイテムをレンダリング
    for (let i = startIndex; i < endIndex; i++) {
      const itemEl = this.renderItem(this.items[i], i);
      this.container.appendChild(itemEl);
    }

    // 下部のスペーサー
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = `${(this.items.length - endIndex) * this.itemHeight}px`;
    this.container.appendChild(bottomSpacer);
  }

  update(newItems) {
    this.items = newItems;
    this.render();
  }
}

/**
 * 遅延読み込み - 画像やコンテンツの遅延読み込み
 * @param {HTMLElement} element - 監視する要素
 * @param {Function} loadCallback - 読み込み時に実行するコールバック
 */
export function lazyLoad(element, loadCallback) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadCallback(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '50px'
  });

  observer.observe(element);
}

/**
 * メモ化 - 関数の結果をキャッシュ
 * @param {Function} fn - メモ化する関数
 * @returns {Function} メモ化された関数
 */
export function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * バッチ処理 - 大量のデータを分割して処理
 * @param {Array} items - 処理するアイテムの配列
 * @param {Function} processFn - 各アイテムを処理する関数
 * @param {number} batchSize - バッチサイズ
 * @param {Function} onComplete - 完了時のコールバック
 */
export async function processBatch(items, processFn, batchSize = 100, onComplete = null) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processFn));

    // 次のバッチの前に少し待つ（UIのブロックを防ぐ）
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (onComplete) {
    onComplete();
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PerformanceOptimizer = {
    debounce,
    throttle,
    VirtualScroll,
    lazyLoad,
    memoize,
    processBatch
  };
}
