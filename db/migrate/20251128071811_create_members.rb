class CreateMembers < ActiveRecord::Migration[7.2]
  def change
    create_table :members do |t|
      t.references :event, null: false, foreign_key: true
      t.string :name

      t.timestamps
    end
  end
end
