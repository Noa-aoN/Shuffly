class ApplicationController < ActionController::Base
  before_action :configure_permitted_parameters, if: :devise_controller?
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  protected

  # def configure_permitted_parameters
  #   # /users/sign_up
  #   devise_parameter_sanitizer.permit(:sign_up, keys: [:username, :phone_number, :full_name])
  # end

  def configure_permitted_parameters
    added_attrs = [:name, :nickname] # 必要なカラムを追加
    devise_parameter_sanitizer.permit(:sign_up, keys: added_attrs)
    devise_parameter_sanitizer.permit(:account_update, keys: added_attrs)
  end

  # option: サインイン後の遷移先
  def after_sign_in_path_for(resource)
    stored_location_for(resource) || mypage_path
  end
end
