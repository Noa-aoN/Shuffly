require 'rails_helper'

RSpec.describe 'shared/_button', type: :view do
  it 'button_to と confirm_message がある場合は確認用の属性をフォームに付与する' do
    render partial: 'shared/button', locals: {
      button_text: '削除する',
      path: '/events/1',
      button_to_method: :delete,
      confirm_message: '本当に削除しますか？',
      id: 'delete-button'
    }

    expect(rendered).to include('data-turbo-confirm="本当に削除しますか？"')
    expect(rendered).to include('data-confirm="本当に削除しますか？"')
    expect(rendered).to include('onsubmit="return window.confirm(&#39;本当に削除しますか？&#39;)"')
    expect(rendered).to include('id="delete-button"')
  end

  it 'confirm_message がない場合は確認用の属性を付与しない' do
    render partial: 'shared/button', locals: {
      button_text: '削除する',
      path: '/events/1',
      button_to_method: :delete
    }

    expect(rendered).not_to include('data-turbo-confirm=')
    expect(rendered).not_to include('data-confirm=')
    expect(rendered).not_to include('window.confirm(')
  end
end
