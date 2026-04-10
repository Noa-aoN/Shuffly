import { buildCoOccurrenceCacheFromRounds } from "./history_utils"

/**
 * イベント履歴データを正規化JSON形式にシリアライズ
 *
 * @param {Object} historyData - グループ・順番・役割の履歴データ
 * @param {Array} historyData.groups - グループ分け履歴
 * @param {Array} historyData.order - 順番決め履歴
 * @param {Array} historyData.roles - 役割決め履歴
 * @param {Array<Object>} members - メンバーオブジェクトの配列
 * @param {string|number} members[].id - メンバーID
 * @param {string} members[].name - メンバー名
 * @returns {Object} 正規化されたイベントデータ
 * @returns {Object} returns.membersData - メンバーデータ
 * @returns {Array} returns.groupRounds - グループ分けラウンド配列
 * @returns {Array} returns.orderRounds - 順番決めラウンド配列
 * @returns {Array} returns.roleRounds - 役割決めラウンド配列
 * @returns {Object} returns.coOccurrenceCache - 組み合わせキャッシュ
 */
export function serializeEventPayload(historyData, members) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const membersByName = new Map(members.map((member) => [member.name, member]))

  const groupRounds = historyData.groups.map((entry, idx) => {
    const assignments = (entry.data?.assignments || []).map((assignment) => ({
      group_id: assignment.group_id,
      group_name: assignment.group_name,
      members: (assignment.members || []).map((memberRef) => {
        const member = membersById.get(memberRef.member_id) || membersByName.get(memberRef.name)
        return member ? { member_id: member.id, name: member.name } : null
      }).filter(Boolean)
    }))
    const groups = Object.fromEntries(assignments.map((assignment) => [
      assignment.group_id,
      assignment.members
    ]))

    return {
      round: entry.round || (idx + 1),
      timestamp: entry.timestamp,
      assignments,
      groups,
      settings: entry.data?.settings || {}
    }
  })

  const orderRounds = historyData.order.map((entry, idx) => ({
    round: entry.round || (idx + 1),
    timestamp: entry.timestamp,
    result: entry.data?.result || [],
    settings: entry.data?.settings || {},
    order: entry.data?.result?.map((name) => {
      const member = membersByName.get(name)
      return member ? { member_id: member.id, name: member.name } : null
    }).filter(Boolean) || []
  }))

  const roleRounds = historyData.roles.map((entry, idx) => ({
    round: entry.round || (idx + 1),
    timestamp: entry.timestamp,
    definitions: entry.data?.definitions || [],
    settings: entry.data?.settings || {},
    assignments: (entry.data?.assignments || []).map((assignment) => {
      const member = membersByName.get(assignment.name)
      return member ? {
        member_id: member.id,
        name: member.name,
        role: assignment.role
      } : null
    }).filter(Boolean)
  }))

  return {
    membersData: { members: members.map(({ id, name }) => ({ id, name })) },
    groupRounds,
    orderRounds,
    roleRounds,
    coOccurrenceCache: buildCoOccurrenceCacheFromRounds(groupRounds)
  }
}
