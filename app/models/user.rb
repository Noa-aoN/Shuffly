class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :events, dependent: :nullify
  has_many :member_lists, dependent: :destroy

  # テーマ設定
  THEME_OPTIONS = [ "simple", "school", "work", "sports", "party", "casino" ].freeze
  THEME_LABELS = {
    "simple" => "シンプル",
    "school" => "スクール",
    "work" => "ワーク",
    "sports" => "スポーツ",
    "party" => "パーティ",
    "casino" => "カジノ"
  }.freeze

  # タイムゾーン設定
  AVAILABLE_TIMEZONES = [
    [ "Asia/Tokyo", "日本時間 (UTC+9)" ],
    [ "America/New_York", "ニューヨーク (UTC-5/-4)" ],
    [ "America/Chicago", "シカゴ (UTC-6/-5)" ],
    [ "America/Denver", "デンバー (UTC-7/-6)" ],
    [ "America/Los_Angeles", "ロサンゼルス (UTC-8/-7)" ],
    [ "Europe/London", "ロンドン (UTC+0/+1)" ],
    [ "Europe/Paris", "パリ (UTC+1/+2)" ],
    [ "Europe/Berlin", "ベルリン (UTC+1/+2)" ],
    [ "Australia/Sydney", "シドニー (UTC+10/+11)" ],
    [ "Asia/Seoul", "ソウル (UTC+9)" ],
    [ "Asia/Shanghai", "上海 (UTC+8)" ],
    [ "Asia/Singapore", "シンガポール (UTC+8)" ],
    [ "Asia/Dubai", "ドバイ (UTC+4)" ],
    [ "Asia/Kolkata", "コルカタ (UTC+5:30)" ],
    [ "Pacific/Auckland", "オークランド (UTC+12/+13)" ]
  ].freeze

  validates :timezone, presence: true, inclusion: { in: AVAILABLE_TIMEZONES.map(&:first) }
  validates :theme_preference, presence: true, inclusion: { in: THEME_OPTIONS }

  before_validation :ensure_valid_timezone, on: :update

  private

  def ensure_valid_timezone
    return if timezone.blank?

    # ラベル形式（"ニューヨーク (UTC-5/-4)"など）が渡された場合、対応する識別子を探す
    if timezone.to_s.include?("(")
      matching_tz = AVAILABLE_TIMEZONES.find { |identifier, label| timezone == label }
      self.timezone = matching_tz&.first || "Asia/Tokyo"
    elsif !AVAILABLE_TIMEZONES.map(&:first).include?(timezone)
      # 完全に無効な値の場合
      self.timezone = "Asia/Tokyo"
    end
  end
end
