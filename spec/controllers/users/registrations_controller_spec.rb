require 'rails_helper'

RSpec.describe Users::RegistrationsController, type: :controller do
  render_views

  let(:user) { create(:user, password: 'password123', password_confirmation: 'password123') }

  before do
    @request.env['devise.mapping'] = Devise.mappings[:user]
    sign_in user
  end

  describe 'PUT #update' do
    context '有効なパラメータの場合' do
      it 'アカウント情報を更新してアカウント設定タブへリダイレクトする' do
        put :update, params: {
          user: {
            name: 'Updated Name',
            current_password: 'password123'
          }
        }

        expect(response).to redirect_to(mypage_path(tab: 'account'))
        expect(user.reload.name).to eq('Updated Name')
      end
    end

    context '無効なパラメータの場合' do
      it '編集画面を再表示し、アカウント情報向けのエラー見出しを表示する' do
        put :update, params: {
          user: {
            name: '',
            current_password: ''
          }
        }

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.body).to include('アカウント情報を保存できませんでした')
      end
    end
  end

  describe 'DELETE #destroy' do
    context '現在のパスワードが正しい場合' do
      it 'アカウントを削除してLPへリダイレクトする' do
        expect {
          delete :destroy, params: { user: { current_password: 'password123' } }
        }.to change(User, :count).by(-1)

        expect(response).to redirect_to(root_path)
      end
    end

    context '現在のパスワードが空または不正な場合' do
      it 'アカウントを削除せず編集画面を再表示する' do
        expect {
          delete :destroy, params: { user: { current_password: '' } }
        }.not_to change(User, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.body).to include('アカウント情報を削除できませんでした')
      end

      it '誤った現在のパスワードでもアカウントを削除しない' do
        expect {
          delete :destroy, params: { user: { current_password: 'wrong-password' } }
        }.not_to change(User, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.body).to include('アカウント情報を削除できませんでした')
      end
    end
  end
end
