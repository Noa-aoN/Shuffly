import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["ctaHint", "modal", "modalTitle", "modalBody", "detail"]

  connect() {
    this.defaultHint = this.ctaHintTarget?.textContent?.trim() || ""
    this.boundHandleKeydown = this.handleKeydown.bind(this)
    document.addEventListener("keydown", this.boundHandleKeydown)
    this.syncHintVisibility()
  }

  disconnect() {
    document.removeEventListener("keydown", this.boundHandleKeydown)
  }

  previewCta(event) {
    if (!this.hasCtaHintTarget) return
    const hint = event.currentTarget.dataset.lpCardsHint
    if (!hint) return
    this.ctaHintTarget.textContent = hint
    this.syncHintVisibility()
  }

  resetCta() {
    if (!this.hasCtaHintTarget) return
    this.ctaHintTarget.textContent = this.defaultHint
    this.syncHintVisibility()
  }

  openCard(event) {
    const detailId = event.params.detailId
    if (!detailId) return

    const template = this.detailTargets.find((target) => target.dataset.detailId === detailId)
    if (!template) return

    const title = template.dataset.detailTitle || ""
    const badge = template.dataset.detailBadge
    this.modalTitleTarget.innerHTML = ""

    const titleText = document.createElement("span")
    titleText.textContent = title
    this.modalTitleTarget.appendChild(titleText)

    if (badge) {
      const badgeEl = document.createElement("span")
      badgeEl.className = "lp-detail-badge"
      badgeEl.textContent = badge
      this.modalTitleTarget.appendChild(badgeEl)
    }

    this.modalBodyTarget.innerHTML = template.innerHTML
    this.modalTarget.classList.remove("hidden")
    this.modalTarget.classList.add("flex")
    document.body.classList.add("overflow-hidden")
  }

  closeModal(event) {
    if (event) event.preventDefault()
    this.modalTarget.classList.add("hidden")
    this.modalTarget.classList.remove("flex")
    this.modalBodyTarget.innerHTML = ""
    document.body.classList.remove("overflow-hidden")
  }

  handleKeydown(event) {
    if (event.key === "Escape" && this.modalTarget.classList.contains("flex")) {
      this.closeModal()
    }
  }

  syncHintVisibility() {
    if (!this.hasCtaHintTarget) return

    const hasText = this.ctaHintTarget.textContent.trim().length > 0
    this.ctaHintTarget.classList.toggle("lp-cta-hint-visible", hasText)
    this.ctaHintTarget.setAttribute("aria-hidden", hasText ? "false" : "true")
  }
}
