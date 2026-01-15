# Pagyヘルパー - Tailwind CSSスタイルのページネーション
module PagyHelper
  # Tailwind CSSスタイルのページネーションナビ
  def pagy_nav(pagy, tab_param = nil)
    return "" unless pagy
    return "" if pagy.pages <= 1

    # pagyのpage_paramからパラメータ名を取得
    page_param = pagy.vars[:page_param]

    html = %(<nav class="flex items-center justify-center gap-2" aria-label="ページネーション">)

    # 前ボタン
    if pagy.prev
      html += link_to(
        "← 前",
        mypage_path(tab: tab_param, page_param => pagy.prev),
        class: "px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 text-gray-700 transition"
      )
    else
      html += %(<span class="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">← 前</span>)
    end

    # ページ番号
    pagy.series.each do |item|
      if item.is_a?(Integer)
        if item == pagy.page
          html += %(<span class="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg border border-blue-500">#{item}</span>)
        else
          html += link_to(
            item.to_s,
            mypage_path(tab: tab_param, page_param => item),
            class: "px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 text-gray-700 transition"
          )
        end
      elsif item == :gap
        html += %(<span class="px-2 text-sm text-gray-400">...</span>)
      end
    end

    # 次ボタン
    if pagy.next
      html += link_to(
        "次 →",
        mypage_path(tab: tab_param, page_param => pagy.next),
        class: "px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 text-gray-700 transition"
      )
    else
      html += %(<span class="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">次 →</span>)
    end

    html += %(</nav>)
    html.html_safe
  end
end
