class AddMemoToEvents < ActiveRecord::Migration[7.2]
  def change
    add_column :events, :memo, :text
  end
end
