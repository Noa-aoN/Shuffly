// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"
import "./shared/toast"

// Turbo Driveを無効化（frame_ant.jsとの競合回避）
Turbo.session.drive = false;
