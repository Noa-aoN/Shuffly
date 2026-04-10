/**
 * メンバー間の共同出現回数マップを生成
 *
 * @param {Array<Object>} entries - メンバーのエントリ配列
 * @param {string} entries[].name - メンバー名
 * @param {Array} entries[].history - メンバーのグループ履歴（グループIDの配列）
 * @param {boolean} [ignoreLast=true] - 最新の履歴を無視するかどうか
 * @returns {Object<string, Object<string, number>>} メンバー名をキーとした共同出現回数マップ
 */
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

/**
 * 生テキストから正規化されたメンバーリストを構築
 *
 * @param {string} rawText - メンバー情報の生テキスト（改行またはカンマ区切り）
 * @param {Function} parseEntry - 各行をパースする関数
 * @param {string} parseEntry.name - パースされたメンバー名
 * @param {Array} parseEntry.history - メンバーの履歴データ
 * @returns {Array<Object>} 正規化されたメンバーオブジェクトの配列
 * @returns {number} returns[].id - メンバーID（1から始まる連番）
 * @returns {string} returns[].name - メンバー名
 * @returns {Array} returns[].history - メンバーの履歴データ
 */
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

/**
 * グループ分けラウンドから組み合わせキャッシュを構築
 *
 * @param {Array<Object>} groupRounds - グループ分けラウンドの配列
 * @param {Array<Object>} groupRounds[].assignments - グループ割り当て情報
 * @param {Array<Object>} groupRounds[].assignments[].members - メンバー配列
 * @param {number|string} groupRounds[].assignments[].members[].member_id - メンバーID
 * @returns {Object<string, number>} メンバーIDペアをキー（"id1-id2"形式）とした出現回数マップ
 */
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
