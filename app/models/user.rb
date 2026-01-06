class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :events, dependent: :nullify
  has_many :member_lists, dependent: :destroy

  # テーマ設定
  THEME_OPTIONS = ['simple', 'school', 'work', 'sports', 'party', 'casino'].freeze
  THEME_LABELS = {
    'simple' => 'シンプル',
    'school' => 'スクール',
    'work' => 'ワーク',
    'sports' => 'スポーツ',
    'party' => 'パーティ',
    'casino' => 'カジノ'
  }.freeze
end
