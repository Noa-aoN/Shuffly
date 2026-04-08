import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["ctaHint", "modal", "modalTitle", "modalBody", "detail", "cardShell", "background", "wordmark"]

  connect() {
    this.defaultHint = this.ctaHintTarget?.textContent?.trim() || ""
    this.boundHandleKeydown = this.handleKeydown.bind(this)
    this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.pointerFrame = null
    this.animationFrame = null
    this.pointerState = null
    this.burstState = null
    this.lastPointer = null
    document.addEventListener("keydown", this.boundHandleKeydown)
    this.syncHintVisibility()
  }

  disconnect() {
    document.removeEventListener("keydown", this.boundHandleKeydown)
    if (this.pointerFrame) window.cancelAnimationFrame(this.pointerFrame)
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)
    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)
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

  handlePointer(event) {
    if (this.prefersReducedMotion || !this.hasCardShellTarget) return
    if (this.pointerFrame) window.cancelAnimationFrame(this.pointerFrame)

    const { clientX, clientY } = event
    this.lastPointer = { x: clientX, y: clientY }
    this.queueBurst(clientX, clientY)
    this.pointerFrame = window.requestAnimationFrame(() => {
      this.applyPointerMotion(clientX, clientY)
    })
  }

  resetPointer() {
    if (this.prefersReducedMotion || !this.hasCardShellTarget) return
    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)
    this.pointerState = null
    this.burstState = null
    this.lastPointer = null
    this.cardShellTargets.forEach((shell) => {
      shell.style.transform = "translate3d(0, 0, 0) rotate(0deg) scale(1)"
    })
  }

  activateWordmark() {
    if (this.prefersReducedMotion || !this.hasWordmarkTarget) return
    this.wordmarkTarget.classList.add("is-shuffling")
  }

  deactivateWordmark() {
    if (!this.hasWordmarkTarget) return
    this.wordmarkTarget.classList.remove("is-shuffling")
  }

  syncHintVisibility() {
    if (!this.hasCtaHintTarget) return

    const hasText = this.ctaHintTarget.textContent.trim().length > 0
    this.ctaHintTarget.classList.toggle("lp-cta-hint-visible", hasText)
    this.ctaHintTarget.setAttribute("aria-hidden", hasText ? "false" : "true")
  }

  applyPointerMotion(clientX, clientY) {
    const radius = 220
    const maxRepel = 26
    const maxRotate = 7
    const maxScaleBoost = 0.035
    const now = Date.now()

    this.cardShellTargets.forEach((shell, index) => {
      const rect = shell.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = centerX - clientX
      const dy = centerY - clientY
      const distance = Math.hypot(dx, dy)

      let offsetX = 0
      let offsetY = 0
      let rotation = 0
      let scale = 1

      if (distance < radius) {
        const force = (1 - distance / radius) * maxRepel
        const nx = distance === 0 ? 0 : dx / distance
        const ny = distance === 0 ? -1 : dy / distance
        const swirl = Math.atan2(dy, dx)
        const tangentX = -Math.sin(swirl)
        const tangentY = Math.cos(swirl)
        const spread = 0.34 + (Math.abs(nx) + Math.abs(ny)) * 0.18

        offsetX += nx * force + tangentX * force * spread
        offsetY += ny * force + tangentY * force * spread
        rotation = (tangentX + ny) * maxRotate * (force / maxRepel)
        scale += maxScaleBoost * (force / maxRepel)
      }

      if (this.burstState?.until && this.burstState.until > now) {
        const burst = this.burstState.offsets[index]
        if (burst) {
          const progress = 1 - (this.burstState.until - now) / this.burstState.duration
          const decay = progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5
          offsetX += burst.x * decay
          offsetY += burst.y * decay
          rotation += burst.rotate * decay
          scale += burst.scale * decay
        }
      }

      shell.style.transform = `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`
    })
  }

  queueBurst(clientX, clientY) {
    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)

    this.pointerState = {
      x: clientX,
      y: clientY,
      timer: window.setTimeout(() => {
        this.triggerBurst(clientX, clientY)
      }, 320)
    }
  }

  triggerBurst(clientX, clientY) {
    const duration = 720
    const offsets = this.cardShellTargets.map((shell) => {
      const rect = shell.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = centerX - clientX
      const dy = centerY - clientY
      const distance = Math.hypot(dx, dy)

      if (distance > 240) return null

      const nx = distance === 0 ? 0 : dx / distance
      const ny = distance === 0 ? -1 : dy / distance
      const tangentX = -ny
      const tangentY = nx
      const force = (1 - distance / 240)
      const launch = 26 + force * 42
      const drift = 8 + force * 12
      const direction = Math.random() > 0.5 ? 1 : -1

      return {
        x: nx * launch + tangentX * drift * direction,
        y: ny * launch + tangentY * drift * direction,
        rotate: direction * (8 + force * 12),
        scale: 0.03 + force * 0.05
      }
    })

    this.burstState = {
      start: Date.now(),
      until: Date.now() + duration,
      duration,
      offsets
    }

    this.startBurstAnimation()
  }

  startBurstAnimation() {
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)

    const tick = () => {
      if (!this.burstState || !this.lastPointer) {
        this.animationFrame = null
        return
      }

      this.applyPointerMotion(this.lastPointer.x, this.lastPointer.y)

      if (Date.now() < this.burstState.until) {
        this.animationFrame = window.requestAnimationFrame(tick)
      } else {
        this.burstState = null
        if (this.lastPointer) {
          this.applyPointerMotion(this.lastPointer.x, this.lastPointer.y)
        }
        this.animationFrame = null
      }
    }

    this.animationFrame = window.requestAnimationFrame(tick)
  }
}
