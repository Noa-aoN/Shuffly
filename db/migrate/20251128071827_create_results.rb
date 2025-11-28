class CreateResults < ActiveRecord::Migration[7.2]
  def change
    create_table :results do |t|
      t.references :event, null: false, foreign_key: true
      t.text :result_json
      t.bigint :seed

      t.timestamps
    end
  end
end
