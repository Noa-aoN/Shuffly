import { Controller } from "@hotwired/stimulus"

// Toastメッセージを表示するStimulusコントローラー
export default class extends Controller {
  connect() {
    // サーバー側のフラッシュメッセージを取得して表示
    const notice = this.element.dataset.notice
    const alert = this.element.dataset.alert

    if (notice && notice.trim() !== '') {
      this.show(notice, 'success')
    }
    if (alert && alert.trim() !== '') {
      this.show(alert, 'error')
    }
  }

  show(message, type = 'info', duration = 3000) {
    if (!message) return

    // 位置とスタイルを設定
    this.element.style.top = '100px'
    this.element.style.bottom = 'auto'
    this.element.style.left = '50%'
    this.element.style.zIndex = '1000'

    // メッセージを設定
    this.element.textContent = message

    // タイプに応じて色を変更（オプション、現在はデフォルトスタイル）
    // 必要に応じて、type に基づいてクラスを追加できます

    // 表示
    this.element.classList.remove('opacity-0')

    // 自動的に非表示
    setTimeout(() => {
      this.element.classList.add('opacity-0')
    }, duration)
  }
}
