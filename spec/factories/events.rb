FactoryBot.define do
  factory :event do
    title { 'Test Event' }
    memo { 'Test memo' }
    members_data { { 'members' => [ 'Alice', 'Bob', 'Charlie' ] }.to_json }
    data_version { 2 }
    user

    trait :with_group_history do
      group_rounds { [ { round: 1, groups: [ [ 'Alice', 'Bob' ], [ 'Charlie' ] ] } ].to_json }
    end

    trait :with_order_history do
      order_rounds { [ { round: 1, order: [ 'Alice', 'Bob', 'Charlie' ] } ].to_json }
    end

    trait :with_role_history do
      role_rounds { [ { round: 1, roles: { 'Alice' => 'Leader' } } ].to_json }
    end
  end
end
