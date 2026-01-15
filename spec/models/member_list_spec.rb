require 'rails_helper'

RSpec.describe MemberList, type: :model do
  describe '関連' do
    it { should belong_to(:user) }
  end

  describe 'バリデーション' do
    subject { build(:member_list) }

    it { should validate_length_of(:name).is_at_most(100) }

    context '名前検証' do
      it '名前の存在を要求' do
        member_list = build(:member_list, name: '')
        expect(member_list).not_to be_valid
        expect(member_list.errors[:name]).to be_present
      end
    end

    context 'members_json検証' do
      it 'members_jsonの存在を要求' do
        member_list = build(:member_list, members_json: nil)
        expect(member_list).not_to be_valid
        expect(member_list.errors[:members_json]).to be_present
      end

      it '有効なJSONを要求' do
        member_list = build(:member_list, members_json: 'invalid json')
        expect(member_list).not_to be_valid
        expect(member_list.errors[:members_json]).to be_present
      end

      it 'JSONが配列であることを要求' do
        member_list = build(:member_list, members_json: '{"not": "an array"}')
        expect(member_list).not_to be_valid
        expect(member_list.errors[:members_json]).to include('must be a JSON array')
      end

      it '少なくとも1つのメンバーを要求' do
        member_list = build(:member_list, members_json: '[]')
        expect(member_list).not_to be_valid
        expect(member_list.errors[:members_json]).to include('must have at least one member')
      end

      it '有効なメンバー配列で検証通過' do
        member_list = build(:member_list, members_json: '["Alice", "Bob", "Charlie"]')
        expect(member_list).to be_valid
      end
    end
  end

  describe '#members' do
    it 'メンバーを配列として返却' do
      member_list = build(:member_list, members_json: '["Alice", "Bob", "Charlie"]')
      expect(member_list.members).to eq([ 'Alice', 'Bob', 'Charlie' ])
    end

    it 'members_jsonが空白の場合は空配列を返却' do
      member_list = build(:member_list, members_json: nil)
      expect(member_list.members).to eq([])
    end

    it 'JSONが無効な場合は空配列を返却' do
      member_list = build(:member_list, members_json: 'invalid')
      expect(member_list.members).to eq([])
    end
  end

  describe '#members=' do
    it '配列からメンバーを設定' do
      member_list = build(:member_list)
      member_list.members = [ 'Alice', 'Bob', 'Charlie' ]
      expect(member_list.members_json).to eq('["Alice","Bob","Charlie"]')
    end
  end

  describe '#members_text' do
    it 'メンバーを改行区切りテキストとして返却' do
      member_list = build(:member_list, members_json: '["Alice", "Bob", "Charlie"]')
      expect(member_list.members_text).to eq("Alice\nBob\nCharlie")
    end

    it 'members_jsonが空白の場合は空文字列を返却' do
      member_list = build(:member_list, members_json: nil)
      expect(member_list.members_text).to eq('')
    end
  end

  describe '#members_text=' do
    it '改行区切りテキストをJSONに変換' do
      member_list = build(:member_list)
      member_list.members_text = "Alice\nBob\nCharlie"
      expect(member_list.members).to eq([ 'Alice', 'Bob', 'Charlie' ])
    end

    it '各行の空白を削除' do
      member_list = build(:member_list)
      member_list.members_text = "  Alice  \n  Bob  \n  Charlie  "
      expect(member_list.members).to eq([ 'Alice', 'Bob', 'Charlie' ])
    end

    it '空白行を無視' do
      member_list = build(:member_list)
      member_list.members_text = "Alice\n\nBob\n\n\nCharlie"
      expect(member_list.members).to eq([ 'Alice', 'Bob', 'Charlie' ])
    end

    it 'テキストが空白の場合は空配列を設定' do
      member_list = build(:member_list)
      member_list.members_text = ""
      expect(member_list.members_json).to eq("[]")
    end
  end
end
