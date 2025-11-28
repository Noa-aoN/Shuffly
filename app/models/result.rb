class Result < ApplicationRecord
  belongs_to :event
  has_many :result_members
end