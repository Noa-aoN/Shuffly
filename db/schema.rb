# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_01_08_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "events", force: :cascade do |t|
    t.bigint "user_id"
    t.string "title"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "memo"
    t.integer "data_version", default: 2, null: false, comment: "1=legacy JSON format, 2=normalized format, 3=hybrid (both formats present)"
    t.jsonb "members_data", default: {}, comment: "Normalized members data with unique IDs: [{id: 1, name: \"John\"}, ...]"
    t.jsonb "group_rounds", default: [], comment: "Group shuffle history: [{round: 1, assignments: [...], settings: {...}}, ...]"
    t.jsonb "order_rounds", default: [], comment: "Order shuffle history: [{round: 1, order: [member_ids], ...}, ...]"
    t.jsonb "role_rounds", default: [], comment: "Role assignment history: [{round: 1, assignments: [...], ...}, ...]"
    t.jsonb "co_occurrence_cache", default: {}, comment: "Pre-calculated co-occurrence counts: {\"1_2\": 3, ...}"
    t.index ["data_version"], name: "index_events_on_data_version"
    t.index ["user_id"], name: "index_events_on_user_id"
  end

  create_table "member_lists", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.jsonb "members_json", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "name"], name: "index_member_lists_on_user_id_and_name"
    t.index ["user_id"], name: "index_member_lists_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.string "theme_preference", default: "simple", null: false
    t.string "timezone", default: "Asia/Tokyo", null: false, comment: "IANA timezone"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["theme_preference"], name: "index_users_on_theme_preference"
  end

  add_foreign_key "events", "users"
  add_foreign_key "member_lists", "users"
end
