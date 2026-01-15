FactoryBot.define do
  factory :member_list do
    name { 'Test Member List' }
    members_json { '["Alice", "Bob", "Charlie"]' }
    user
  end
end
