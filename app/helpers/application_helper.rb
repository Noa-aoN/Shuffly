module ApplicationHelper
  def app_timezone
    tz = current_user&.timezone || 'Asia/Tokyo'
    # 無効なタイムゾーン（ラベル形式など）の場合はフォールバック
    if defined?(User::AVAILABLE_TIMEZONES)
      valid_timezones = User::AVAILABLE_TIMEZONES.map(&:first)
      valid_timezones.include?(tz) ? tz : 'Asia/Tokyo'
    else
      tz
    end
  end

  def format_datetime(timestamp)
    return nil unless timestamp
    timestamp.in_time_zone(app_timezone).strftime('%Y年%m月%d日 %H:%M')
  end

  def format_datetime_short(timestamp)
    return nil unless timestamp
    timestamp.in_time_zone(app_timezone).strftime('%Y/%m/%d %H:%M')
  end

  def format_date(timestamp)
    return nil unless timestamp
    timestamp.in_time_zone(app_timezone).strftime('%Y年%m月%d日')
  end
end
