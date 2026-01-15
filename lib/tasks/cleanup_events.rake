namespace :events do
  desc "壊れたイベントデータを削除する"
  task cleanup_invalid: :environment do
    puts "壊れたイベントデータをチェック中..."

    invalid_events = Event.all.select do |event|
      # members_dataが文字列か空の場合は無効
      event.members_data.is_a?(String) || event.members_list.empty?
    end

    if invalid_events.any?
      puts "#{invalid_events.count}件の壊れたイベントを発見しました。"
      puts "削除しますか？ (yes/no)"

      # 自動実行の場合はENV変数で制御
      if ENV["AUTO_CONFIRM"] == "true"
        answer = "yes"
      else
        answer = STDIN.gets.chomp
      end

      if answer.downcase == "yes"
        invalid_events.each do |event|
          puts "イベント ID #{event.id} を削除中..."
          event.destroy
        end
        puts "#{invalid_events.count}件のイベントを削除しました。"
      else
        puts "削除をキャンセルしました。"
      end
    else
      puts "壊れたイベントは見つかりませんでした。"
    end
  end

  desc "古いイベントデータを新形式に移行する"
  task migrate_old_format: :environment do
    puts "古いイベントデータを移行中..."

    migrated_count = 0
    Event.find_each do |event|
      updated = false

      # order_roundsの移行
      if event.order_rounds.present?
        event.order_rounds.each_with_index do |round, idx|
          if round["order"].present? && round["order"].is_a?(Array)
            # 数字の配列の場合、名前も追加
            if round["order"].first.is_a?(Integer)
              members = event.members_list
              round["order"] = round["order"].map do |member_id|
                member = members.find { |m| m["id"] == member_id }
                member ? { "member_id" => member_id, "name" => member["name"] } : nil
              end.compact
              updated = true
            end
          end
        end
      end

      # role_roundsの移行
      if event.role_rounds.present?
        event.role_rounds.each_with_index do |round, idx|
          if round["assignments"].present? && round["assignments"].is_a?(Array)
            round["assignments"].each do |assignment|
              # nameがない場合、member_idから名前を追加
              if assignment["member_id"].present? && assignment["name"].blank?
                members = event.members_list
                member = members.find { |m| m["id"] == assignment["member_id"] }
                assignment["name"] = member ? member["name"] : "不明"
                updated = true
              end
            end
          end
        end
      end

      if updated
        if event.save
          migrated_count += 1
          puts "イベント ID #{event.id} を移行しました。"
        else
          puts "イベント ID #{event.id} の移行に失敗しました: #{event.errors.full_messages.join(', ')}"
        end
      end
    end

    puts "#{migrated_count}件のイベントを移行しました。"
  end
end
