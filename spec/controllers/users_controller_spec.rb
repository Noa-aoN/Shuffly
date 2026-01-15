require 'rails_helper'

RSpec.describe UsersController, type: :controller do
  render_views

  let(:user) { create(:user) }

  describe 'GET #mypage' do
    context 'ログイン時' do
      before { login_as(user) }

      it 'マイページを表示' do
        get :mypage
        expect(assigns(:user)).to eq(user)
        expect(response).to have_http_status(:ok)
      end

      it 'イベントとメンバーリストをページネーション' do
        create_list(:event, 15, user: user)
        create_list(:member_list, 15, user: user)

        get :mypage
        expect(assigns(:events).count).to eq(10)
        expect(assigns(:member_lists).count).to eq(10)
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :mypage
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'PATCH #update_preferences' do
    context 'ログイン時' do
      before { login_as(user) }

      context '有効なパラメータの場合' do
        it 'タイムゾーンを更新' do
          patch :update_preferences, params: { user: { timezone: 'America/New_York' } }
          expect(user.reload.timezone).to eq('America/New_York')
          expect(response).to redirect_to(mypage_path(tab: 'account'))
          expect(flash[:notice]).to eq('設定を保存しました')
        end
      end

      context '無効なパラメータの場合' do
        it '無効なタイムゾーンはAsia/Tokyoに変換されて更新成功' do
          # Userモデルのbefore_validationで無効なタイムゾーンはAsia/Tokyoに変換される
          patch :update_preferences, params: { user: { timezone: 'Invalid/Zone' } }
          expect(user.reload.timezone).to eq('Asia/Tokyo')
          expect(response).to redirect_to(mypage_path(tab: 'account'))
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        patch :update_preferences, params: { user: { timezone: 'Asia/Tokyo' } }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'GET #timezone_settings' do
    context 'ログイン時' do
      before { login_as(user) }

      it 'タイムゾーン設定画面を表示' do
        get :timezone_settings
        expect(assigns(:user)).to eq(user)
        expect(response).to have_http_status(:ok)
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :timezone_settings
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'PATCH #update_timezone' do
    context 'ログイン時' do
      before { login_as(user) }

      context '有効なタイムゾーンの場合' do
        it 'タイムゾーンを更新' do
          patch :update_timezone, params: { user: { timezone: 'America/Chicago' } }
          expect(user.reload.timezone).to eq('America/Chicago')
          expect(response).to redirect_to(timezone_settings_path)
          expect(flash[:notice]).to eq('タイムゾーンを保存しました')
        end

        it 'タイムゾーン識別子で更新' do
          User::AVAILABLE_TIMEZONES.each do |identifier, _|
            patch :update_timezone, params: { user: { timezone: identifier } }
            expect(response).to redirect_to(timezone_settings_path)
          end
        end
      end

      context '無効なタイムゾーンの場合' do
        it 'Asia/Tokyoに変換されて更新成功' do
          # Userモデルのbefore_validationで無効なタイムゾーンはAsia/Tokyoに変換される
          patch :update_timezone, params: { user: { timezone: 'Invalid/Zone' } }
          expect(user.reload.timezone).to eq('Asia/Tokyo')
          expect(response).to redirect_to(timezone_settings_path)
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        patch :update_timezone, params: { user: { timezone: 'Asia/Tokyo' } }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'GET #style_settings' do
    context 'ログイン時' do
      before { login_as(user) }

      it 'スタイル設定画面を表示' do
        get :style_settings
        expect(assigns(:user)).to eq(user)
        expect(response).to have_http_status(:ok)
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :style_settings
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'PATCH #update_style' do
    context 'ログイン時' do
      before { login_as(user) }

      context '有効なテーマの場合' do
        it 'テーマを更新' do
          patch :update_style, params: { user: { theme_preference: 'school' } }
          expect(user.reload.theme_preference).to eq('school')
          expect(response).to redirect_to(style_settings_path)
          expect(flash[:notice]).to eq('スタイルを保存しました')
        end

        it '全テーマオプションで更新可能' do
          User::THEME_OPTIONS.each do |theme|
            patch :update_style, params: { user: { theme_preference: theme } }
            expect(response).to redirect_to(style_settings_path)
          end
        end
      end

      context '無効なテーマの場合' do
        it '更新に失敗して設定画面を再表示' do
          patch :update_style, params: { user: { theme_preference: 'invalid_theme' } }
          expect(response).to render_template(:style_settings)
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        patch :update_style, params: { user: { theme_preference: 'simple' } }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end
end
