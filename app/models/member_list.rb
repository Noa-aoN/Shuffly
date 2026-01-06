class MemberList < ApplicationRecord
  belongs_to :user

  validates :name, presence: true, length: { maximum: 100 }
  validate :validate_members_json

  # メンバーリストのメンバーを配列として返す
  def members
    JSON.parse(members_json || "[]")
  rescue JSON::ParserError
    []
  end

  # メンバーを配列として設定する
  def members=(members_array)
    self.members_json = members_array.to_json
  end

  # フォーム用の仮想属性：改行区切りのテキストとして取得
  def members_text
    return "" if members_json.blank?
    members.join("\n")
  end

  # フォーム用の仮想属性：改行区切りのテキストを配列に変換してJSON保存
  def members_text=(text)
    return self.members_json = "[]" if text.blank?

    members_array = text.split("\n").map(&:strip).reject(&:blank?)
    self.members_json = members_array.to_json
  end

  private

  def validate_members_json
    if members_json.blank?
      errors.add(:members_json, :blank)
      return
    end

    begin
      parsed = JSON.parse(members_json)
      unless parsed.is_a?(Array)
        errors.add(:members_json, "must be a JSON array")
      end
      if parsed.empty?
        errors.add(:members_json, "must have at least one member")
      end
    rescue JSON::ParserError
      errors.add(:members_json, "must be valid JSON")
    end
  end
end
