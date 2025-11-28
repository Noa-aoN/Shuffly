class CreateEvents < ActiveRecord::Migration[7.2]
  def change
    create_table :events do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title
      t.text :config_json
      t.text :members_json

      t.timestamps
    end
  end
end
