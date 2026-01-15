require 'rails_helper'

RSpec.describe Event, type: :model do
  describe '関連' do
    it { should belong_to(:user).optional(true) }
  end

  describe 'バリデーション' do
    subject { build(:event) }

    it { should validate_length_of(:title).is_at_most(255).on(:update) }
    it { should validate_length_of(:memo).is_at_most(10000).on(:update) }
  end

  describe '#members_list' do
    context '正規化データの場合（data_version >= 2）' do
      it 'members_dataからメンバー配列を返却' do
        event = Event.new(
          members_data: { 'members' => [ 'Alice', 'Bob', 'Charlie' ] }.to_json,
          data_version: 2
        )
        expect(event.members_list).to eq([ 'Alice', 'Bob', 'Charlie' ])
      end
    end

    context '文字列JSONデータの場合' do
      it 'パースしてメンバー配列を返却' do
        event = Event.new(
          members_data: '{"members": ["Dave", "Eve"]}',
          data_version: 2
        )
        expect(event.members_list).to eq([ 'Dave', 'Eve' ])
      end
    end

    context '無効なJSONの場合' do
      it '空配列を返却' do
        event = Event.new(
          members_data: 'invalid json',
          data_version: 2
        )
        expect(event.members_list).to eq([])
      end
    end

    context 'members_dataがnilの場合' do
      it '空配列を返却' do
        event = Event.new(members_data: nil, data_version: 2)
        expect(event.members_list).to eq([])
      end
    end
  end

  describe '#group_history' do
    it 'グループラウンド配列を返却' do
      event = Event.new(
        group_rounds: [ { round: 1, groups: [ [ 'A', 'B' ], [ 'C', 'D' ] ] } ].to_json
      )
      expect(event.group_history).to be_an(Array)
      expect(event.group_history.first['round']).to eq(1)
    end
  end

  describe '#order_history' do
    it '順番ラウンド配列を返却' do
      event = Event.new(
        order_rounds: [ { round: 1, order: [ 'A', 'B', 'C' ] } ].to_json
      )
      expect(event.order_history).to be_an(Array)
    end
  end

  describe '#role_history' do
    it '役割ラウンド配列を返却' do
      event = Event.new(
        role_rounds: [ { round: 1, roles: { 'A' => 'Leader' } } ].to_json
      )
      expect(event.role_history).to be_an(Array)
    end
  end

  describe '#co_occurrence' do
    it '共起動ハッシュを返却' do
      event = Event.new(
        co_occurrence_cache: { 'A-B' => 2, 'A-C' => 1 }.to_json
      )
      expect(event.co_occurrence).to be_a(Hash)
    end
  end

  describe '#normalized?' do
    it 'data_version >= 2の場合にtrueを返却' do
      event = Event.new(data_version: 2)
      expect(event.normalized?).to be true
    end

    it 'data_version < 2の場合にfalseを返却' do
      event = Event.new(data_version: 1)
      expect(event.normalized?).to be false
    end
  end
end
