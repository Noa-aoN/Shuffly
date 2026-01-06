class ChangeDataVersionDefault < ActiveRecord::Migration[7.2]
  def change
    # data_versionのデフォルト値を2（正規化形式）に変更
    change_column_default :events, :data_version, from: 1, to: 2
  end
end
