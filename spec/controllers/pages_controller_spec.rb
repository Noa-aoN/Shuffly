require 'rails_helper'

RSpec.describe PagesController, type: :controller do
  describe 'GET #privacy' do
    it 'プライバシーポリシーを表示' do
      get :privacy
      expect(response).to have_http_status(:ok)
    end
  end

  describe 'GET #terms' do
    it '利用規約を表示' do
      get :terms
      expect(response).to have_http_status(:ok)
    end
  end
end
