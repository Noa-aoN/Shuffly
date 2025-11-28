class Event < ApplicationRecord
  belongs_to :user, optional: true
  has_many :members
  has_many :results
end