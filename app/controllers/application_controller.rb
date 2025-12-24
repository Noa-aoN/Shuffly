class ApplicationController < ActionController::Base
  before_action :set_default_meta
  before_action :configure_permitted_parameters, if: :devise_controller?
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  protected

  # def configure_permitted_parameters
  #   # /users/sign_up
  #   devise_parameter_sanitizer.permit(:sign_up, keys: [:username, :phone_number, :full_name])
  # end

  def configure_permitted_parameters
    added_attrs = [ :name, :nickname ] # 必要なカラムを追加
    devise_parameter_sanitizer.permit(:sign_up, keys: added_attrs)
    devise_parameter_sanitizer.permit(:account_update, keys: added_attrs)
  end

  # option: サインイン後の遷移先
  def after_sign_in_path_for(resource)
    stored_location_for(resource) || mypage_path
  end

  private

  def set_default_meta
    # gem 'meta-tags' を利用してデフォルトのメタタグを設定
    set_meta_tags(
      site: "Shuffly",
      title: "Shuffly —グループ・順番・役割決めツール—",
      reverse: true,
      charset: "utf-8",
      description: "Shufflyを使えばランダムなグループ分け・順番決め・役割決めが簡単にできます。",
      keywords: "グループ分け,順番決め,役割決め,ランダム,ツール,Shuffly",
      canonical: request.original_url,
      separator: "|",
      og: {
        site_name: "Shuffly",
        title: "Shuffly",
        description: "Shufflyを使えばランダムなグループ分け・順番決め・役割決めが簡単にできます。",
        type: "website",
        url: request.original_url,
        image: view_context.image_url("ogp.png"),
        locale: "ja_JP"
      },
      twitter: {
        card: "summary_large_image",
        # site: '@',
        image: view_context.image_url("ogp.png")
      }
    )
  end
end
