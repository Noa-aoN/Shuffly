# セキュリティ関連のヘルパーメソッド
module SecurityHelper
  # XSS対策：HTMLタグを除去してテキストのみを返す
  def sanitize_user_input(text)
    return "" if text.blank?

    # HTMLタグを除去し、許可された文字のみを残す
    ActionController::Base.helpers.sanitize(text, tags: [], attributes: [])
  end

  # タイトルのサニタイゼーション（255文字制限付き）
  def sanitize_title(title)
    return "" if title.blank?

    sanitized = sanitize_user_input(title)
    sanitized.truncate(255, omission: "...")
  end

  # メモのサニタイゼーション（基本的なHTML許可）
  def sanitize_memo(memo)
    return "" if memo.blank?

    # 改行とリンクのみ許可
    ActionController::Base.helpers.sanitize(memo,
      tags: %w[br p],
      attributes: []
    )
  end
end
