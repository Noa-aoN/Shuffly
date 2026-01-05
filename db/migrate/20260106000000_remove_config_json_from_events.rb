class RemoveConfigJsonFromEvents < ActiveRecord::Migration[7.2]
  def change
    # config_jsonカラムは使用されていないため削除
    remove_column :events, :config_json, :jsonb
  end
end
