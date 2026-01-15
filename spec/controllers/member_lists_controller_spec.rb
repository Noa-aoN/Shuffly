require 'rails_helper'

RSpec.describe MemberListsController, type: :controller do
  render_views

  let(:user) { create(:user) }
  let(:member_list) { create(:member_list, user: user) }
  let(:other_user) { create(:user) }
  let(:other_list) { create(:member_list, user: other_user) }

  describe 'GET #index' do
    context 'ログイン時' do
      before { login_as(user) }

      context 'JSON形式' do
        it 'JSONでメンバーリスト一覧を返却' do
          # member_listを作成
          create(:member_list, user: user)
          get :index, format: :json
          json = JSON.parse(response.body)
          expect(json).to be_an(Array)
          expect(json.first).to include('id', 'name', 'members', 'members_count', 'created_at')
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :index
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'GET #show' do
    context 'ログイン時' do
      before { login_as(user) }

      context '自分のメンバーリストの場合' do
        it 'JSONでメンバーリスト詳細を返却' do
          get :show, format: :json, params: { id: member_list.id }
          json = JSON.parse(response.body)
          expect(json['id']).to eq(member_list.id)
          expect(json['name']).to eq(member_list.name)
        end
      end

      context '他ユーザーのメンバーリストの場合' do
        it '見つからずリダイレクト' do
          get :show, format: :json, params: { id: other_list.id }
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
          expect(flash[:alert]).to eq('メンバーリストが見つかりません')
        end
      end

      context '存在しないIDの場合' do
        it '見つからずリダイレクト' do
          get :show, format: :json, params: { id: 99999 }
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :show, params: { id: member_list.id }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'GET #new' do
    context 'ログイン時' do
      before { login_as(user) }

      it '新規作成画面を表示' do
        get :new
        expect(assigns(:member_list)).to be_a_new(MemberList)
        expect(response).to have_http_status(:ok)
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :new
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'POST #create' do
    context 'ログイン時' do
      before { login_as(user) }

      context '有効なパラメータの場合' do
        it 'メンバーリストを作成' do
          expect {
            post :create, params: { member_list: { name: '新規リスト', members_text: "山田\n田中" } }
          }.to change(MemberList, :count).by(1)
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
          expect(flash[:notice]).to eq('メンバーリストを作成しました')
        end
      end

      context '名前が空の場合' do
        it '作成に失敗' do
          post :create, params: { member_list: { name: '', members_text: "山田" } }
          expect(response).to render_template(:new)
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      context 'メンバーが空の場合' do
        it '作成に失敗' do
          post :create, params: { member_list: { name: 'テスト', members_text: '' } }
          expect(response).to render_template(:new)
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        post :create, params: { member_list: { name: 'テスト', members_text: "山田" } }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'GET #edit' do
    context 'ログイン時' do
      before { login_as(user) }

      context '自分のメンバーリストの場合' do
        it '編集画面を表示' do
          get :edit, params: { id: member_list.id }
          expect(assigns(:member_list)).to eq(member_list)
          expect(response).to have_http_status(:ok)
        end
      end

      context '他ユーザーのメンバーリストの場合' do
        it '見つからずリダイレクト' do
          get :edit, params: { id: other_list.id }
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        get :edit, params: { id: member_list.id }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'PATCH #update' do
    context 'ログイン時' do
      before { login_as(user) }

      context '有効なパラメータの場合' do
        it 'メンバーリストを更新' do
          patch :update, params: { id: member_list.id, member_list: { name: '更新後の名前' } }
          expect(member_list.reload.name).to eq('更新後の名前')
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
          expect(flash[:notice]).to eq('メンバーリストを更新しました')
        end
      end

      context 'メンバーを更新する場合' do
        it 'メンバーテキストを解析して更新' do
          patch :update, params: { id: member_list.id, member_list: { name: member_list.name, members_text: "鈴木\n佐藤" } }
          expect(member_list.reload.members).to eq([ '鈴木', '佐藤' ])
        end
      end

      context '無効なパラメータの場合' do
        it '更新に失敗' do
          patch :update, params: { id: member_list.id, member_list: { name: '' } }
          expect(response).to render_template(:edit)
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      context '他ユーザーのメンバーリストの場合' do
        it '見つからずリダイレクト' do
          patch :update, params: { id: other_list.id, member_list: { name: '不正更新' } }
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        patch :update, params: { id: member_list.id, member_list: { name: 'テスト' } }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end

  describe 'DELETE #destroy' do
    context 'ログイン時' do
      before { login_as(user) }

      context '自分のメンバーリストの場合' do
        it 'メンバーリストを削除' do
          list_to_delete = create(:member_list, user: user)
          expect {
            delete :destroy, params: { id: list_to_delete.id }
          }.to change(MemberList, :count).by(-1)
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
          expect(flash[:notice]).to eq('メンバーリストを削除しました')
        end
      end

      context '他ユーザーのメンバーリストの場合' do
        it '見つからずリダイレクト' do
          delete :destroy, params: { id: other_list.id }
          expect(response).to redirect_to(mypage_path(tab: 'member_lists'))
        end
      end
    end

    context '非ログイン時' do
      before { logout }

      it 'ログイン画面にリダイレクト' do
        delete :destroy, params: { id: member_list.id }
        expect(response).to redirect_to(new_user_session_path)
      end
    end
  end
end
