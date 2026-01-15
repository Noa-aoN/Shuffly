FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "test#{n}@example.com" }
    password { 'password123' }
    password_confirmation { 'password123' }
    timezone { 'Asia/Tokyo' }
    theme_preference { 'simple' }

    trait :with_member_lists do
      after(:create) { |user| create_list(:member_list, 3, user: user) }
    end
  end
end
