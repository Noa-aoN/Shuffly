// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"
import "./shared/toast"

// Turbo Driveを無効化（frame_ant.jsとの競合回避）
Turbo.session.drive = false;

function initPageReveal() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const targets = Array.from(document.querySelectorAll("[data-page-reveal]"))
  if (targets.length === 0) return

  targets.forEach((target, index) => {
    target.style.setProperty("--shuffly-reveal-delay", `${Math.min(index * 55, 220)}ms`)
    if (prefersReducedMotion) {
      target.classList.add("is-revealed")
      return
    }

    requestAnimationFrame(() => {
      target.classList.add("is-revealed")
    })
  })
}

document.addEventListener("DOMContentLoaded", initPageReveal)
document.addEventListener("turbo:load", initPageReveal)
window.addEventListener("pageshow", initPageReveal)
