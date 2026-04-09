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
    this.burstTriggered = false
    this.ctaBurstLocked = false
    this.ctaNavigationTimer = null
    this.wordmarkBurstTimer = null
    document.addEventListener("keydown", this.boundHandleKeydown)
    this.syncHintVisibility()
  }

  disconnect() {
    document.removeEventListener("keydown", this.boundHandleKeydown)
    if (this.pointerFrame) window.cancelAnimationFrame(this.pointerFrame)
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)
    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)
    if (this.ctaNavigationTimer) window.clearTimeout(this.ctaNavigationTimer)
    if (this.wordmarkBurstTimer) window.clearTimeout(this.wordmarkBurstTimer)
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

  burstCta(event) {
    const target = event.currentTarget
    const href = target.getAttribute("href")
    if (!href || target.getAttribute("target") === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    if (this.prefersReducedMotion || !this.hasCardShellTarget) return

    event.preventDefault()

    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)
    if (this.pointerFrame) window.cancelAnimationFrame(this.pointerFrame)
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)
    if (this.ctaNavigationTimer) window.clearTimeout(this.ctaNavigationTimer)

    this.pointerState = null
    this.burstState = null
    this.burstTriggered = false
    this.ctaBurstLocked = true
    this.cardShellTargets.forEach((shell) => {
      shell.style.transform = ""
    })
    if (this.hasBackgroundTarget) {
      this.backgroundTarget.classList.remove("is-cta-bursting")
      void this.backgroundTarget.offsetWidth
      this.backgroundTarget.classList.add("is-cta-bursting")
    }
    this.ctaNavigationTimer = window.setTimeout(() => {
      window.location.assign(href)
    }, 0)
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
    if (this.prefersReducedMotion || !this.hasCardShellTarget || this.ctaBurstLocked) return
    if (this.pointerFrame) window.cancelAnimationFrame(this.pointerFrame)

    const { clientX, clientY } = event
    this.lastPointer = { x: clientX, y: clientY }
    this.queueBurst(clientX, clientY)
    this.pointerFrame = window.requestAnimationFrame(() => {
      this.applyPointerMotion(clientX, clientY)
    })
  }

  resetPointer() {
    if (this.prefersReducedMotion || !this.hasCardShellTarget || this.ctaBurstLocked) return
    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame)
    this.pointerState = null
    this.burstState = null
    this.lastPointer = null
    this.burstTriggered = false
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

  flashWordmark() {
    if (!this.hasWordmarkTarget) return
    this.wordmarkTarget.classList.add("is-shuffling")
    if (this.wordmarkBurstTimer) window.clearTimeout(this.wordmarkBurstTimer)
    this.wordmarkBurstTimer = window.setTimeout(() => {
      this.wordmarkTarget.classList.remove("is-shuffling")
      this.wordmarkBurstTimer = null
    }, 420)
  }

  syncHintVisibility() {
    if (!this.hasCtaHintTarget) return

    const hasText = this.ctaHintTarget.textContent.trim().length > 0
    this.ctaHintTarget.classList.toggle("lp-cta-hint-visible", hasText)
    this.ctaHintTarget.setAttribute("aria-hidden", hasText ? "false" : "true")
  }

  applyPointerMotion(clientX, clientY) {
    const radius = 220
    const maxRepel = 18
    const maxRotate = 4
    const maxScaleBoost = 0.02
    const now = Date.now()
    const burstActive = this.burstState?.until && this.burstState.until > now

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

      if (distance < radius && !(burstActive && this.burstState.primaryIndex === index)) {
        const force = (1 - distance / radius) * maxRepel
        const nx = distance === 0 ? 0 : dx / distance
        const ny = distance === 0 ? -1 : dy / distance
        offsetX += nx * force
        offsetY += ny * force
        rotation = (nx - ny) * maxRotate * (force / maxRepel)
        scale += maxScaleBoost * (force / maxRepel)
      }

      if (burstActive) {
        const burst = this.burstState.offsets[index]
        if (burst) {
          const progress = 1 - (this.burstState.until - now) / this.burstState.duration
          const exitPhase = this.burstState.oneWay ? 1 : 0.56
          if (progress <= exitPhase) {
            const t = progress / exitPhase
            offsetX += burst.x * t
            offsetY += burst.y * t
            rotation += burst.rotate * t
            scale += burst.scale * t
          } else if (!this.burstState.oneWay) {
            const t = (progress - exitPhase) / (1 - exitPhase)
            offsetX += burst.reentryX * (1 - t)
            offsetY += burst.reentryY * (1 - t)
            rotation += burst.reentryRotate * (1 - t)
            scale += burst.scale * (1 - t) * 0.8
          }

          if (!this.burstState.oneWay && (burst.swapX || burst.swapY)) {
            const swapExitPhase = 0.36
            const swapReturnPhase = 0.7
            if (progress <= swapExitPhase) {
              const t = progress / swapExitPhase
              offsetX += burst.swapExitX * t
              offsetY += burst.swapExitY * t
            } else if (progress <= swapReturnPhase) {
              offsetX += burst.swapExitX
              offsetY += burst.swapExitY
            } else {
              const t = (progress - swapReturnPhase) / (1 - swapReturnPhase)
              offsetX += burst.swapX * (1 - t)
              offsetY += burst.swapY * (1 - t)
            }
          }
        }
      }

      shell.style.transform = `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`
    })
  }

  queueBurst(clientX, clientY) {
    if (this.ctaBurstLocked) return
    const hoveredIndex = this.findNearestCardIndex(clientX, clientY, 220)

    if (this.burstTriggered) {
      const movedFarEnough =
        !this.pointerState ||
        Math.hypot((this.pointerState.x || 0) - clientX, (this.pointerState.y || 0) - clientY) > 54

      if (!movedFarEnough) return
    }

    if (this.pointerState && this.pointerState.hoveredIndex === hoveredIndex) {
      const microMove = Math.hypot(this.pointerState.x - clientX, this.pointerState.y - clientY) < 26
      if (microMove) {
        this.pointerState.x = clientX
        this.pointerState.y = clientY
        return
      }
    }

    if (this.pointerState?.timer) window.clearTimeout(this.pointerState.timer)

    this.pointerState = {
      x: clientX,
      y: clientY,
      hoveredIndex,
      timer: window.setTimeout(() => {
        this.triggerBurst(clientX, clientY)
      }, 3000)
    }
  }

  triggerBurst(clientX, clientY, options = {}) {
    if (this.burstTriggered) return
    const oneWay = Boolean(options.oneWay)
    const duration = oneWay ? 420 : 1120
    const centers = this.cardShellTargets.map((shell) => {
      const rect = shell.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    })

    let primaryIndex = -1
    let primaryDistance = Infinity

    centers.forEach((center, index) => {
      const distance = Math.hypot(center.x - clientX, center.y - clientY)
      if (distance < primaryDistance) {
        primaryDistance = distance
        primaryIndex = index
      }
    })

    if (primaryIndex === -1 || primaryDistance > 220) return

    const primary = centers[primaryIndex]
    let denseX = 0
    let denseY = 0

    centers.forEach((center, index) => {
      if (index === primaryIndex) return
      const dx = center.x - primary.x
      const dy = center.y - primary.y
      const distance = Math.max(Math.hypot(dx, dy), 24)
      const weight = 1 / distance
      denseX += dx * weight
      denseY += dy * weight
    })

    if (Math.abs(denseX) < 0.01 && Math.abs(denseY) < 0.01) {
      denseX = primary.x - clientX
      denseY = primary.y - clientY
    }

    const denseLength = Math.max(Math.hypot(denseX, denseY), 1)
    const directionX = denseX / denseLength
    const directionY = denseY / denseLength
    const tangentX = -directionY
    const tangentY = directionX
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const distanceToEdgeX = directionX > 0
      ? (viewportWidth + 120 - primary.x) / directionX
      : (-120 - primary.x) / directionX
    const distanceToEdgeY = directionY > 0
      ? (viewportHeight + 120 - primary.y) / directionY
      : (-120 - primary.y) / directionY

    const travel = Math.min(
      Number.isFinite(distanceToEdgeX) ? Math.abs(distanceToEdgeX) : Infinity,
      Number.isFinite(distanceToEdgeY) ? Math.abs(distanceToEdgeY) : Infinity
    )
    const oppositeTravel = travel + 240
    const offsets = this.cardShellTargets.map((_, index) => {
      if (index === primaryIndex) {
        const curveSide = Math.random() > 0.5 ? 1 : -1
        return {
          x: directionX * travel,
          y: directionY * travel,
          reentryX: -directionX * oppositeTravel + tangentX * curveSide * Math.min(travel * 0.1, 64),
          reentryY: -directionY * oppositeTravel + tangentY * curveSide * Math.min(travel * 0.1, 64),
          rotate: (directionX >= 0 ? 1 : -1) * 620,
          reentryRotate: (directionX >= 0 ? -1 : 1) * 420,
          scale: 0.1,
          swapExitX: 0,
          swapExitY: 0,
          swapX: 0,
          swapY: 0
        }
      }

      const center = centers[index]
      const relX = center.x - primary.x
      const relY = center.y - primary.y
      const projection = relX * directionX + relY * directionY
      const perpendicularSigned = relX * tangentX + relY * tangentY
      const perpendicular = Math.abs(perpendicularSigned)

      if (oneWay) {
        const exit = this.buildScatterExitVector(center, index + primaryIndex + 1)
        const rotateDirection = exit.x >= 0 ? 1 : -1
        return {
          x: exit.x,
          y: exit.y,
          reentryX: 0,
          reentryY: 0,
          rotate: rotateDirection * (180 + (index % 3) * 36),
          reentryRotate: 0,
          scale: 0.04,
          swapExitX: 0,
          swapExitY: 0,
          swapX: 0,
          swapY: 0
        }
      }

      if (projection < -30 || projection > travel * 0.7 || perpendicular > 120) {
        return null
      }

      const side = perpendicularSigned >= 0 ? 1 : -1
      const force = Math.max(0.28, 1 - perpendicular / 120)
      const impact = {
        x: directionX * (36 + force * 40) + tangentX * side * (30 + force * 24),
        y: directionY * (36 + force * 40) + tangentY * side * (30 + force * 24),
        reentryX: 0,
        reentryY: 0,
        rotate: side * (118 + force * 54),
        reentryRotate: side * (12 + force * 12),
        scale: 0.07 + force * 0.05,
        swapExitX: 0,
        swapExitY: 0,
        swapX: 0,
        swapY: 0
      }
      return impact
    })

    offsets.forEach((offset, index) => {
      if (index === primaryIndex || offset) return
      offsets[index] = {
        x: 0,
        y: 0,
        reentryX: 0,
        reentryY: 0,
        rotate: 0,
        reentryRotate: 0,
        scale: 0,
        swapExitX: 0,
        swapExitY: 0,
        swapX: 0,
        swapY: 0
      }
    })

    const swapCandidates = this.cardShellTargets
      .map((_, index) => index)
      .filter((index) => index !== primaryIndex)
      .sort(() => Math.random() - 0.5)

    for (let i = 0; i < swapCandidates.length - 1; i += 2) {
      const a = swapCandidates[i]
      const b = swapCandidates[i + 1]
      const deltaX = centers[b].x - centers[a].x
      const deltaY = centers[b].y - centers[a].y
      if (offsets[a]) {
        const exitA = this.buildScatterExitVector(centers[a], i)
        offsets[a].swapExitX = exitA.x
        offsets[a].swapExitY = exitA.y
        offsets[a].swapX = deltaX * 0.52
        offsets[a].swapY = deltaY * 0.52
      }
      if (offsets[b]) {
        const exitB = this.buildScatterExitVector(centers[b], i + 1)
        offsets[b].swapExitX = exitB.x
        offsets[b].swapExitY = exitB.y
        offsets[b].swapX = -deltaX * 0.52
        offsets[b].swapY = -deltaY * 0.52
      }
    }

    if (swapCandidates.length % 2 === 1) {
      const leftover = swapCandidates[swapCandidates.length - 1]
      if (offsets[leftover]) {
        const exit = this.buildScatterExitVector(centers[leftover], swapCandidates.length + 1)
        offsets[leftover].swapExitX = exit.x
        offsets[leftover].swapExitY = exit.y
        offsets[leftover].swapX = exit.x * -0.18
        offsets[leftover].swapY = exit.y * -0.18
        offsets[leftover].rotate += (Math.random() > 0.5 ? 1 : -1) * 48
      }
    }

    this.burstState = {
      start: Date.now(),
      until: Date.now() + duration,
      duration,
      primaryIndex,
      offsets,
      oneWay
    }
    this.burstTriggered = true

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
        const wasOneWay = this.burstState.oneWay
        this.burstState = null
        this.burstTriggered = false
        if (this.lastPointer && !wasOneWay) {
          this.applyPointerMotion(this.lastPointer.x, this.lastPointer.y)
        }
        this.animationFrame = null
      }
    }

    this.animationFrame = window.requestAnimationFrame(tick)
  }

  findNearestCardIndex(clientX, clientY, maxDistance = Infinity) {
    let nearestIndex = -1
    let nearestDistance = Infinity

    this.cardShellTargets.forEach((shell, index) => {
      const rect = shell.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const distance = Math.hypot(centerX - clientX, centerY - clientY)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return nearestDistance <= maxDistance ? nearestIndex : -1
  }

  buildScatterExitVector(center, seed) {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const margin = 150

    const distances = [
      { edge: "left", distance: center.x },
      { edge: "right", distance: viewportWidth - center.x },
      { edge: "top", distance: center.y },
      { edge: "bottom", distance: viewportHeight - center.y }
    ].sort((a, b) => a.distance - b.distance)

    const chosen = distances[seed % 2]
    let x = 0
    let y = 0
    const spread = ((seed % 4) - 1.5) * 36

    if (chosen.edge === "left") {
      x = -center.x - margin
      y = spread
    } else if (chosen.edge === "right") {
      x = viewportWidth - center.x + margin
      y = spread
    } else if (chosen.edge === "top") {
      x = spread
      y = -center.y - margin
    } else {
      x = spread
      y = viewportHeight - center.y + margin
    }

    return { x, y }
  }
}
