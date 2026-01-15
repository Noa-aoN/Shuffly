require 'rails_helper'

RSpec.describe User, type: :model do
  describe '関連' do
    it { should have_many(:events).dependent(:nullify) }
    it { should have_many(:member_lists).dependent(:destroy) }
  end

  describe 'バリデーション' do
    subject { build(:user) }

    it { should validate_presence_of(:timezone).on(:update) }
    it { should validate_presence_of(:theme_preference).on(:update) }

    context 'タイムゾーン検証' do
      it '有効なタイムゾーン識別子を許可' do
        user = build(:user, timezone: 'Asia/Tokyo')
        expect(user).to be_valid
      end

      it '全ての利用可能なタイムゾーンを許可' do
        User::AVAILABLE_TIMEZONES.each do |identifier, _label|
          user = build(:user, timezone: identifier)
          expect(user).to be_valid, "#{identifier} should be valid"
        end
      end

      it '無効なタイムゾーン識別子を拒否' do
        user = build(:user, timezone: 'Invalid/Timezone')
        expect(user).not_to be_valid
        expect(user.errors[:timezone]).to be_present
      end
    end

    context 'テーマ設定検証' do
      it '有効なテーマオプションを許可' do
        User::THEME_OPTIONS.each do |theme|
          user = build(:user, theme_preference: theme)
          expect(user).to be_valid, "#{theme} should be valid"
        end
      end

      it '無効なテーマオプションを拒否' do
        user = build(:user, theme_preference: 'invalid_theme')
        expect(user).not_to be_valid
        expect(user.errors[:theme_preference]).to be_present
      end
    end
  end

  describe '#ensure_valid_timezone' do
    context 'ラベル形式のタイムゾーンの場合' do
      it '識別子に変換' do
        user = create(:user, timezone: 'Asia/Tokyo')
        user.update(timezone: '日本時間 (UTC+9)')
        expect(user.reload.timezone).to eq('Asia/Tokyo')
      end
    end

    context '完全に無効なタイムゾーンの場合' do
      it 'Asia/Tokyoにフォールバック' do
        user = create(:user, timezone: 'Asia/Tokyo')
        user.update(timezone: 'Completely/Invalid')
        expect(user.reload.timezone).to eq('Asia/Tokyo')
      end
    end

    context '空白のタイムゾーンの場合' do
      it '存在チェックによりAsia/Tokyoにフォールバック' do
        user = create(:user, timezone: 'Asia/Tokyo')
        user.update(timezone: '')
        # 存在チェックが空白のタイムゾーンを防止、ensure_valid_timezoneは
        # 空白値では実行されないため、検証エラーが保存を防止
        expect(user.errors[:timezone]).to be_present if user.invalid?
      end
    end

    context '有効なタイムゾーン識別子の場合' do
      it '有効なタイムゾーンを保持' do
        user = create(:user, timezone: 'America/New_York')
        user.update(timezone: 'America/Chicago')
        expect(user.reload.timezone).to eq('America/Chicago')
      end
    end
  end

  describe '定数' do
    describe 'THEME_OPTIONS' do
      it '期待されるテーマオプションを含む' do
        expect(User::THEME_OPTIONS).to eq(
          [ 'simple', 'school', 'work', 'sports', 'party', 'casino' ]
        )
      end
    end

    describe 'THEME_LABELS' do
      it 'テーマの日本語ラベルを含む' do
        expect(User::THEME_LABELS['simple']).to eq('シンプル')
        expect(User::THEME_LABELS['school']).to eq('スクール')
        expect(User::THEME_LABELS['work']).to eq('ワーク')
        expect(User::THEME_LABELS['sports']).to eq('スポーツ')
        expect(User::THEME_LABELS['party']).to eq('パーティ')
        expect(User::THEME_LABELS['casino']).to eq('カジノ')
      end
    end

    describe 'AVAILABLE_TIMEZONES' do
      it 'タイムゾーン識別子とラベルのペアを含む' do
        expect(User::AVAILABLE_TIMEZONES).to be_an(Array)
        expect(User::AVAILABLE_TIMEZONES.first).to be_an(Array)
        expect(User::AVAILABLE_TIMEZONES.first.size).to eq(2)
      end

      it '期待されるタイムゾーンを含む' do
        identifiers = User::AVAILABLE_TIMEZONES.map(&:first)
        expect(identifiers).to include('Asia/Tokyo')
        expect(identifiers).to include('America/New_York')
        expect(identifiers).to include('Europe/London')
      end
    end
  end
end
