module Users
  class RegistrationsController < Devise::RegistrationsController
    def destroy
      self.resource = resource_class.to_adapter.get(send(:"current_#{resource_name}").to_key)

      unless resource.valid_password?(params.dig(resource_name, :current_password).to_s)
        resource.errors.add(:current_password, :invalid)
        clean_up_passwords(resource)
        set_minimum_password_length
        render :edit, status: :unprocessable_entity
        return
      end

      super
    end

    protected

    def after_update_path_for(_resource)
      mypage_path(tab: "account")
    end
  end
end
