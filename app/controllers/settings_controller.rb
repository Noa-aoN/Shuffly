class SettingsController < ApplicationController
  before_action :authenticate_user!

  def edit
    @setting = current_user.setting || current_user.build_setting
  end

  def update
    @setting = current_user.setting || current_user.build_setting
    if @setting.update(setting_params)
      redirect_to edit_settings_path, notice: "設定を保存しました"
    else
      render :edit
    end
  end

  private

  def setting_params
    params.require(:setting).permit(:theme, :sound)
  end
end
