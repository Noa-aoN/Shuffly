class PwaController < ApplicationController
  # allow_browserフィルターをスキップ（ServiceWorker/MANIFESTはAPIエンドポイント）
  skip_before_action :set_default_meta, only: [ :service_worker, :manifest ]
  skip_before_action :configure_permitted_parameters, only: [ :service_worker, :manifest ], raise: false

  def service_worker
    # Service WorkerのJavaScriptファイルを返す
    render file: Rails.root.join("app", "javascript", "pwa", "service_worker.js"),
           content_type: "application/javascript",
           layout: false
  end

  def manifest
    # manifest.jsonを返す
    if File.exist?(Rails.root.join("public", "manifest.json"))
      render file: Rails.root.join("public", "manifest.json"),
             content_type: "application/manifest+json",
             layout: false
    else
      head :not_found
    end
  end
end
