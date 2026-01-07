class AddTimezoneToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :timezone, :string, default: 'Asia/Tokyo', null: false, comment: 'IANA timezone'
  end
end
