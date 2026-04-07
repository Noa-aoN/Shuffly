export function getCoOccurrenceMap(entries, ignoreLast = true) {
  const map = {}
  const historySets = {}

  for (const entry of entries) {
    historySets[entry.name] = new Set(ignoreLast ? entry.history.slice(0, -1) : entry.history)
    map[entry.name] = {}
  }

  for (const source of entries) {
    for (const target of entries) {
      if (source.name === target.name) continue

      let overlapCount = 0
      historySets[source.name].forEach((historyToken) => {
        if (historySets[target.name].has(historyToken)) overlapCount += 1
      })
      map[source.name][target.name] = overlapCount
    }
  }

  return map
}

export function buildNormalizedMembers(rawText, parseEntry) {
  return rawText.trim().split(/[\r\n,]+/).map((line, index) => {
    const parsed = parseEntry(line.trim())
    return {
      id: index + 1,
      name: parsed.name,
      history: parsed.history
    }
  }).filter((entry) => entry.name)
}

export function buildCoOccurrenceCacheFromRounds(groupRounds) {
  const cache = {}

  groupRounds.forEach((round) => {
    ;(round.assignments || []).forEach((assignment) => {
      const memberIds = (assignment.members || [])
        .map((member) => member.member_id)
        .filter((memberId) => memberId !== undefined && memberId !== null)

      for (let i = 0; i < memberIds.length; i += 1) {
        for (let j = i + 1; j < memberIds.length; j += 1) {
          const pairKey = [memberIds[i], memberIds[j]].sort((a, b) => a - b).join("-")
          cache[pairKey] = (cache[pairKey] || 0) + 1
        }
      }
    })
  })

  return cache
}
