import { buildCoOccurrenceCacheFromRounds } from "./history_utils"

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
