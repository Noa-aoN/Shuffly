import { Controller } from "@hotwired/stimulus"

// 読み取り専用 textarea の右上に拡大表示ボタンを重ねる。
// クリックで textarea-meter:expand カスタムイベントを発火する。
export default class extends Controller {
  connect() {
    if (this.element.tagName !== "TEXTAREA") return
    if (!this.element.readOnly) return
    if (this.element.dataset.textareaMeterReady === "true") return

    const wrapper = document.createElement("div")
    wrapper.className = "shuffly-textarea-wrap"

    const parent = this.element.parentNode
    parent.insertBefore(wrapper, this.element)
    wrapper.appendChild(this.element)

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "shuffly-textarea-expand-btn"
    btn.setAttribute("aria-label", "拡大表示")
    btn.title = "拡大表示"
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>'

    btn.addEventListener("click", (e) => {
      e.preventDefault()
      this.element.dispatchEvent(new CustomEvent("textarea-meter:expand", {
        bubbles: true,
        detail: { id: this.element.id }
      }))
    })

    wrapper.appendChild(btn)
    this.element.dataset.textareaMeterReady = "true"
  }
}
