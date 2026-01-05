require "test_helper"

class MemberListTest < ActiveSupport::TestCase
  # ============================================
  # 後退防止: バリデーション
  # ============================================

  test "nameは必須" do
    member_list = MemberList.new(user: users(:one), name: "")
    assert_not member_list.valid?
    assert_includes member_list.errors[:name], "can't be blank"
  end

  test "nameは100文字以内" do
    member_list = MemberList.new(user: users(:one), name: "a" * 101)
    assert_not member_list.valid?
    assert_includes member_list.errors[:name], "is too long (maximum is 100 characters)"
  end

  test "nameが100文字以内なら有効" do
    member_list = MemberList.new(user: users(:one), name: "a" * 100, members_json: '["Test"]')
    assert member_list.valid?
  end

  # ============================================
  # 後退防止: members_jsonのバリデーション
  # ============================================

  test "members_jsonは必須" do
    member_list = MemberList.new(user: users(:one), name: "Test")
    assert_not member_list.valid?
    assert_includes member_list.errors[:members_json], "can't be blank"
  end

  test "members_jsonは配列である必要がある" do
    member_list = MemberList.new(user: users(:one), name: "Test", members_json: '{"invalid": "format"}')
    assert_not member_list.valid?
    assert_includes member_list.errors[:members_json], "must be a JSON array"
  end

  test "members_jsonは空配列ではいけない" do
    member_list = MemberList.new(user: users(:one), name: "Test", members_json: '[]')
    assert_not member_list.valid?
    assert_includes member_list.errors[:members_json], "must have at least one member"
  end

  test "members_jsonが不正なJSONの場合はエラー" do
    member_list = MemberList.new(user: users(:one), name: "Test", members_json: 'invalid json')
    assert_not member_list.valid?
    assert_includes member_list.errors[:members_json], "must be valid JSON"
  end

  # ============================================
  # 後退防止: メソッドの動作
  # ============================================

  test "membersで配列を取得できる" do
    member_list = member_lists(:one)
    assert_equal ["Alice", "Bob", "Charlie"], member_list.members
  end

  test "members=で配列を設定できる" do
    member_list = MemberList.new(user: users(:one), name: "Test")
    member_list.members = ["X", "Y", "Z"]
    assert_equal '["X","Y","Z"]', member_list.members_json
  end

  test "members_textで改行区切りのテキストを取得できる" do
    member_list = member_lists(:one)
    assert_equal "Alice\nBob\nCharlie", member_list.members_text
  end

  test "members_text=でテキストを配列に変換して保存できる" do
    member_list = MemberList.new(user: users(:one), name: "Test")
    member_list.members_text = "Alice\nBob\nCharlie"
    assert_equal '["Alice","Bob","Charlie"]', member_list.members_json
  end

  test "members_text=は空白行を無視する" do
    member_list = MemberList.new(user: users(:one), name: "Test")
    member_list.members_text = "Alice\n\nBob\n  \nCharlie"
    assert_equal '["Alice","Bob","Charlie"]', member_list.members_json
  end

  # ============================================
  # セキュリティ: 不正入力対策
  # ============================================

  test "membersが空のJSON配列の場合は空の配列を返す" do
    member_list = MemberList.new(user: users(:one), name: "Test", members_json: '["A", "B"]')
    # JSON.parseに失敗した場合の安全性確認
    member_list.members_json = "invalid"
    assert_equal [], member_list.members
  end

  test "特殊文字を含む名前も安全に処理できる" do
    member_list = MemberList.new(user: users(:one), name: "'; DROP TABLE users; --")
    member_list.members = ["<script>alert('xss')</script>"]
    assert member_list.save
    assert_equal "'; DROP TABLE users; --", member_list.name
    assert_equal ["<script>alert('xss')</script>"], member_list.members
  end

  # ============================================
  # アソシエーション
  # ============================================

  test "userは必須" do
    member_list = MemberList.new(name: "Test", members_json: '["A"]')
    assert_not member_list.valid?
  end

  test "userに属している" do
    assert_equal users(:one), member_lists(:one).user
  end
end
