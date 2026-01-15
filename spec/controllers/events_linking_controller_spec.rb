require 'rails_helper'

RSpec.describe EventsLinkingController, type: :controller do
  render_views

  let(:user) { create(:user) }

  describe 'GET #show' do
    context 'ログイン時' do
      before { login_as(user) }

      context 'pending_tokenがある場合' do
        it 'リンク画面を表示' do
          session[:pending_event_token] = 'test_token'
          get :show
          expect(assigns(:pending_token)).to eq('test_token')
          expect(response).to have_http_status(:ok)
        end
      end

      context 'pending_tokenがない場合' do
        it 'rootにリダイレクト' do
          get :show
          expect(response).to redirect_to(root_path)
          expect(flash[:alert]).to eq('無効なリンクです')
        end
      end

      context 'just_signed_upフラグがある場合' do
        it 'フラグを取得して削除' do
          session[:pending_event_token] = 'test_token'
          session[:just_signed_up] = true
          get :show
          expect(assigns(:just_signed_up)).to be true
          expect(session[:just_signed_up]).to be_nil
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :show
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'POST #create' do
    context 'ログイン時' do
      before { login_as(user) }

      context '有効なパラメータの場合' do
        let(:valid_params) do
          {
            event: {
              title: 'Linked Event',
              members_data: { 'members' => [ 'Alice', 'Bob' ] }.to_json,
              group_rounds: [ { 'round' => 1, 'timestamp' => 1704067200000 } ].to_json
            }
          }
        end

        it 'イベントを作成して紐付け' do
          session[:pending_event_token] = 'test_token'
          expect {
            post :create, params: valid_params
          }.to change(user.events, :count).by(1)
          expect(Event.last.user).to eq(user)
          expect(session[:pending_event_token]).to be_nil
        end

        it 'HTML形式で成功時リダイレクト' do
          session[:pending_event_token] = 'test_token'
          post :create, params: valid_params
          expect(response).to redirect_to(event_path(Event.last))
          expect(flash[:notice]).to eq('ログインしたのでイベントを保存しました')
        end

        it 'JSON形式で成功時JSONを返却' do
          session[:pending_event_token] = 'test_token'
          post :create, format: :json, params: valid_params
          json = JSON.parse(response.body)
          expect(json['success']).to be true
          expect(json['redirect_url']).to eq("/events/#{Event.last.id}")
          expect(json['message']).to eq('イベントを保存しました')
        end

        it '履歴のタイムスタンプからcreated_atを設定' do
          session[:pending_event_token] = 'test_token'
          post :create, params: valid_params
          created_event = Event.last
          expect(created_event.created_at).to be_within(1.second).of(Time.at(1704067200).in_time_zone('Tokyo'))
        end
      end

      context 'JSON文字列のパラメータを正規化' do
        it 'members_dataをHashに変換' do
          session[:pending_event_token] = 'test_token'
          post :create, params: {
            event: { title: 'Test', members_data: '{"members": ["A"]}' }
          }
          expect(Event.last.members_data).to be_a(Hash)
        end

        it 'group_roundsをArrayに変換' do
          session[:pending_event_token] = 'test_token'
          post :create, params: {
            event: { title: 'Test', group_rounds: '[{"round": 1}]' }
          }
          expect(Event.last.group_rounds).to be_an(Array)
        end
      end

      context '無効なパラメータの場合' do
        it '保存に失敗' do
          session[:pending_event_token] = 'test_token'
          post :create, params: { event: { title: 'a' * 256 } }
          expect(response).to render_template(:show)
        end

        it 'JSON形式で失敗時エラーを返却' do
          session[:pending_event_token] = 'test_token'
          post :create, format: :json, params: { event: { title: 'a' * 256 } }
          json = JSON.parse(response.body)
          expect(json['success']).to be false
          expect(json['errors']).to be_an(Array)
        end
      end

      context '無効なJSON文字列の場合' do
        it 'デフォルト値にフォールバックして保存成功' do
          session[:pending_event_token] = 'test_token'
          post :create, params: {
            event: { title: 'Test Event', members_data: 'invalid json' }
          }
          expect(response).to redirect_to(event_path(Event.last))
          expect(Event.last.members_data).to eq({})
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        post :create, params: { event: { title: 'Test' } }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end
end
