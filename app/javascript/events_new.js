/*
  JavaScript 部分：UI / データ変換 / 操作ロジック
  - 内部データは membersRaw（hidden textarea）に保持
  - 表示用は membersInput（ユーザ編集領域）
  - グループ割当・順番・役割はそれぞれ assignGroups / assignOrder / assignRoles
  - 表示切替は switchResultTab / switchSettingsTab
*/

// グローバル変数をモジュールパターンでカプセル化
const ShufflyApp = (function() {
  // 【旧】時系列で全タイプを管理（後方互換性のため残す）
  let shufflyHistory = [];
  let currentHistoryIndex = -1;

  // 【新】タイプ別に履歴を管理（提案1の実装）
  let historyData = {
    groups: [],  // グループ分けの履歴
    order: [],   // 順番決めの履歴
    roles: []    // 役割分担の履歴
  };

  // 【新】各タイプの現在表示位置（提案1の実装）
  let currentRoundIndex = {
    groups: -1,  // -1: 未実施、0以上: 該当インデックスを表示中
    order: -1,
    roles: -1
  };

  let statsCollapsed = true; // 統計は初期折りたたみ
  let optionsCollapsed = true; // グループ表示オプションは初期折りたたみ（デフォルト閉じる）
  let groupsAssigned = false; // グループ分け実行が行われたかどうかのフラグ
  let IS_SIGNED_IN = false; // 初期化時に設定される
  let new_user_session_path = '/users/sign_in'; // ログインページのパス

  // アイコンパス（assets pipeline 経由）
  let ICON_EXPAND = '';
  let ICON_COLLAPSE = '';

  // --- 定数 ---
  const MAX_GROUPS = 26;
  const MIN_GROUPS = 1;
  const SAMPLE_POOL_SIZE = 15;
  const SAMPLE_SELECT_SIZE = 10;
  const TOAST_DURATION = 1200;
  const TOAST_TOP_POSITION = '35px';

  // --- ユーティリティ ---
  function clampGroupCount(v){
    return Math.min(Math.max(parseInt(v) || MIN_GROUPS, MIN_GROUPS), MAX_GROUPS);
  }

  function parseEntry(entry){
    const name = entry.split('#')[0].trim();
    const hist = entry.match(/#\d+[A-Z]/g) || [];
    return {name, history: hist};
  }

  // グループ分けの現在のラウンド数を取得
  // 返値: ラウンド数（1始まり）、グループ割当がない場合は null
  function getGroupRound(entries, nextRound = false){
    let max = 0;
    let found = false;
    for(const e of entries) for(const h of e.history) {
      const m = h.match(/^#(\d+)/);
      if(m){
        found = true;
        const num = parseInt(m[1], 10);
        if(num > max) max = num;
      }
    }
    if(!found) return null;
    return nextRound ? max + 1 : max;
  }

  // 互換性のためのエイリアス（次のラウンド番号を取得）
  function getCurrentRound(entries){
    return getGroupRound(entries, true) || 1;
  }

  function getCoOccurrenceMap(entries, ignoreLast=true){
    const map={}, histories={};
    for(const e of entries) histories[e.name]=ignoreLast?e.history.slice(0,-1):e.history;
    for(const e of entries) map[e.name]={};
    for(const a of entries){
      for(const b of entries){
        if(a.name===b.name) continue;
        const overlap=histories[a.name].filter(h=>histories[b.name].includes(h));
        map[a.name][b.name]=overlap.length;
      }
    }
    return map;
  }

  // 新規: 履歴内で「1回目のグループ割当」が最初に発生したインデックスを返す
  function findFirstGroupHistoryIndex(){
    // まずグループ履歴の最初のインデックスを取得
    let firstGroupIndex = -1;
    for(let i=0;i<shufflyHistory.length;i++){
      const entry = shufflyHistory[i];
      if(!entry) continue;

      // 新形式の場合
      if(entry.type === 'groups' && entry.data && entry.data.membersRaw) {
        if(firstGroupIndex === -1) firstGroupIndex = i;
        if(/#1[A-Z]/.test(entry.data.membersRaw)) return i;
      }
      // 旧形式との互換性（文字列の場合）
      else if(typeof entry === 'string') {
        if(firstGroupIndex === -1) firstGroupIndex = i;
        if(/#1[A-Z]/.test(entry)) return i;
      }
    }
    // グループ履歴がある場合はそのインデックスを返す（回次の1回目までしか遡れないようにする）
    if(firstGroupIndex !== -1) return firstGroupIndex;
    // 無ければ -1 を返す（履歴がないことを示す）
    return -1;
  }

  // グループIDと表示名を決定（A,B,C...）
  function buildGroupIdsAndNames(){
    const groupCountInputEl = document.getElementById('groupCount');
    const inputGroupCount = clampGroupCount(groupCountInputEl ? groupCountInputEl.value : 3);
    const customNamesEl = document.getElementById('customGroupNames');
    const customNames = (customNamesEl ? customNamesEl.value : "").split(/[\r\n,]+/).map(n=>n.trim()).filter(Boolean);

    let groupCount;
    let ids = [];
    let displayNames = [];

    if(customNames.length > 0){
      groupCount = Math.min(customNames.length, MAX_GROUPS);
      ids = Array.from({length: groupCount}, (_,i)=>String.fromCharCode(65+i));
      displayNames = customNames.slice(0, groupCount);
    } else {
      groupCount = inputGroupCount;
      ids = Array.from({length: groupCount}, (_,i)=>String.fromCharCode(65+i));
      displayNames = ids.slice();
    }

    const idToName = {};
    ids.forEach((id, idx) => idToName[id] = displayNames[idx] || id);
    return { ids, displayNames, idToName, groupCount };
  }

  // 表示用履歴フォーマット処理（表示 ↔ 内部 raw の相互変換）
  let suppressDisplayInput = false;
  function getRawValue(){ return (document.getElementById('membersRaw') || {value:''}).value || ""; }
  function setRawValue(v){ const el = document.getElementById('membersRaw'); if(el) el.value = v; }
  function getDisplayValue(){ return (document.getElementById('membersInput') || {value:''}).value || ""; }
  function setDisplayValue(v){ const el = document.getElementById('membersInput'); if(el) el.value = v; }

  // 表示用に履歴を整形
  // 変更: 履歴情報を表示せず、純粋なメンバー名のみを返す
  function formatEntryForDisplay(entry){
    const name = entry.split('#')[0].trim();
    return name;
  }

  function updateDisplayFromRaw(){
    const raw = getRawValue();
    const lines = raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean);
    const formatted = lines.map(formatEntryForDisplay).join("\n");
    suppressDisplayInput = true;
    setDisplayValue(formatted);
    setTimeout(()=>{ suppressDisplayInput = false; }, 0);
  }

  function parseDisplayToRaw(displayText){
    const { idToName } = buildGroupIdsAndNames();
    const nameToId = {};
    for(const k in idToName) nameToId[idToName[k]] = k;

    const lines = displayText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const rawLines = lines.map(line=>{
      const parts = line.split('#').filter(Boolean);
      if(parts.length === 0) return "";
      const base = parts[0].trim();
      const tokens = parts.slice(1);
      const rawTokens = tokens.map(tok=>{
        const mRaw = tok.match(/^(\d+)([A-Z])$/);
        if(mRaw) return `#${mRaw[1]}${mRaw[2]}`;
        const m = tok.match(/^(\d+)\s*巡目\s*[:：]\s*(.+)$/);
        if(m){
          const num=m[1];
          const gname = m[2].trim();
          let id = nameToId[gname];
          if(!id){
            const stripped = gname.replace(/^グループ\s*/i,'').trim();
            id = nameToId[stripped];
          }
          if(id) return `#${num}${id}`;
          return `#${num}`;
        }
        return `#${tok.replace(/^#?/,'')}`;
      }).filter(Boolean);
      return base + rawTokens.join('');
    }).filter(Boolean);
    return rawLines.join("\n");
  }

  function setRawAndRefreshDisplay(rawText){
    setRawValue(rawText);
    updateDisplayFromRaw();
  }

  // --- コア処理: グループ / 順番 / 役割 ---
  function assignGroups(){
    let raw = getRawValue().trim();
    let rawList = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [];

    // 追加: メンバーが空ならトースト表示のみ行い、グループ表示はクリアして処理を中断する
    if(rawList.length === 0){
      showToast("メンバーがいません");
      const gOut = document.getElementById('groupOutput');
      const sOut = document.getElementById('statsOutput');
      const gr = document.getElementById('groupRoundHint');
      if(gOut) gOut.value = "";
      if(sOut) sOut.value = "";
      if(gr) gr.innerHTML = '現在のグループ分け表示：<span class="font-bold">未実施</span>';
      groupsAssigned = false;
      return;
    }

    let entries = rawList.map(parseEntry);
    const round=getCurrentRound(entries);

    const { ids: groupIds, idToName, groupCount } = buildGroupIdsAndNames();
    const groups=Object.fromEntries(groupIds.map(g=>[g,[]]));
    const coMap=getCoOccurrenceMap(entries);

    const fixedRaw = (document.getElementById('fixedMembersInput').value || "").split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean);
    const fixedSet = new Set(fixedRaw);
    const fixedEntries = entries.filter(e=>fixedSet.has(e.name));
    const otherEntries = entries.filter(e=>!fixedSet.has(e.name));

    function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

    // 変更点：分散固定メンバーは初回はランダムに各グループへ割当てるが、
    // 2回目以降はできるかぎり直前の割当（履歴の最後のグループ）に固定する。
    // ただしバランスが大きく崩れる場合は空きグループや最小グループへ割当てる。
    for(const p of fixedEntries){
      const emptyGroups = groupIds.filter(g=>groups[g].length===0);
      let chosen = null;

      // 最後の履歴から直前のグループを取得
      const last = p.history.at(-1);
      const m = last ? last.match(/#\d+([A-Z])$/) : null;
      const preferred = m ? m[1] : null;

      if(preferred && groupIds.includes(preferred)){
        // 現在の最小グループサイズを取得
        const minSize = Math.min(...groupIds.map(g=>groups[g].length));
        // できるだけ同じグループに戻す：ただしそのグループが最小サイズよりも大きすぎるときは避ける
        // （バランスを保つために minSize + 1 を許容上限とする）
        if(groups[preferred].length <= minSize + 1){
          chosen = preferred;
        } else if(emptyGroups.length > 0){
          chosen = pickRandom(emptyGroups);
        } else {
          const candidates = groupIds.filter(g=>groups[g].length===minSize);
          chosen = pickRandom(candidates);
        }
      } else {
        // preferred が無い（初回）または無効な場合は既存のルールに従う
        if(emptyGroups.length>0){
          chosen = pickRandom(emptyGroups);
        } else {
          const minSize = Math.min(...groupIds.map(g=>groups[g].length));
          const candidates = groupIds.filter(g=>groups[g].length===minSize);
          chosen = pickRandom(candidates);
        }
      }

      if(!chosen){
        // 最終手段：最小グループに入れる
        const minSize = Math.min(...groupIds.map(g=>groups[g].length));
        const candidates = groupIds.filter(g=>groups[g].length===minSize);
        chosen = pickRandom(candidates);
      }

      groups[chosen].push(p);
      p.assignedGroup = chosen;
    }

    for(const p of otherEntries){
      const emptyGroups = groupIds.filter(g=>groups[g].length===0);
      if(emptyGroups.length>0){
        const chosen = pickRandom(emptyGroups);
        groups[chosen].push(p);
        p.assignedGroup = chosen;
        continue;
      }

      const minSize=Math.min(...groupIds.map(g=>groups[g].length));
      const candidates=groupIds.filter(g=>groups[g].length===minSize);

      let minMK=Infinity;
      const scores=[];
      for(const g of candidates){
        const mk=groups[g].reduce((acc,q)=>acc+(coMap[p.name][q.name]||0),0);
        scores.push({g, mk});
        if(mk<minMK) minMK=mk;
      }
      const tied = scores.filter(s=>s.mk===minMK).map(s=>s.g);
      const selected = pickRandom(tied);
      groups[selected].push(p);
      p.assignedGroup = selected;
    }

    // 役割がある場合は順番に割当
    const rolesForGroups = document.getElementById('rolesInput').value.split(/[\r\n,]+/).map(r=>r.trim()).filter(Boolean);
    if(rolesForGroups.length>0){
      for(const g of groupIds){
        const members=groups[g];
        members.forEach((m,i)=>m.role=rolesForGroups[i%rolesForGroups.length]);
      }
    }

    // 履歴追記を反映して内部 raw を更新
    const updated = entries.map(e => {
      const assigned = e.assignedGroup || (()=>{
        for(const g of groupIds) if(groups[g].some(x=>x.name===e.name)) return g;
        return groupIds[0];
      })();
      return `${e.name}${e.history.join('')}#${round}${assigned}`;
    });

    setRawAndRefreshDisplay(updated.join("\n"));

    // 変更点：グループ分けが実行されたことをフラグに記録
    groupsAssigned = true;

    // 正規化形式では履歴から構築するため、ここでの保存は不要

    updateParticipantCount(); showGroups(); showStats(); pushToHistory();
    // 回次表示を更新（履歴を追加した後に確実に更新）
    updateGroupRoundDisplay();
    // 追加: 実行成功時にトースト表示
    showToast("グループに振り分けました");
    switchResultTab('groups');
  }

  function assignOrder(){
    const raw = getRawValue().trim();
    const rawList = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [];
    let members = rawList.map(s=>s.split('#')[0].trim());
    if(members.length === 0){
      document.getElementById('orderOutput').value = "";
      if(document.getElementById('orderJsonInput')) document.getElementById('orderJsonInput').value = "[]";
      showToast("メンバーがいません");
      return;
    }

    const fixedRaw = (document.getElementById('fixedOrderInput')?.value || "").split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean);
    const fixedMap = {};
    const invalids = [];
    for(const line of fixedRaw){
      if(!line) continue;
      const m = line.match(/^(\d+)\s*[:=]\s*(.+)$/) || line.match(/^(\d+)\s+(.+)$/);
      if(m){
        const pos = parseInt(m[1],10);
        const name = m[2].trim();
        if(pos >= 1 && pos <= members.length){
          fixedMap[pos] = name;
        } else {
          invalids.push(line);
        }
      } else {
        invalids.push(line);
      }
    }

    const namesSet = new Set(members);
    const assignedFixedNames = new Set();
    const invalidNameEntries = [];
    for(const posStr in fixedMap){
      const pos = parseInt(posStr,10);
      const name = fixedMap[pos];
      if(!namesSet.has(name)){
        invalidNameEntries.push(`${pos}: ${name}`);
        delete fixedMap[pos];
      } else {
        assignedFixedNames.add(name);
      }
    }

    if(invalids.length>0 || invalidNameEntries.length>0){
      const msgs = [];
      if(invalids.length>0) msgs.push("固定指定の書式が不正な行があります");
      if(invalidNameEntries.length>0) msgs.push("メンバーに存在しない名前の固定指定があります");
      showToast(msgs.join('、') + "（無視されます）");
    }

    const pool = members.filter(m=>!assignedFixedNames.has(m));
    for(let i=pool.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [pool[i], pool[j]]=[pool[j], pool[i]];
    }

    const result = Array(members.length).fill(null);
    for(const posStr in fixedMap){
      const pos = parseInt(posStr,10);
      result[pos-1] = fixedMap[pos];
    }

    let poolIdx = 0;
    for(let i=0;i<result.length;i++){
      if(result[i] === null){
        result[i] = pool[poolIdx++] || "";
      }
    }

    const lines = result.map((name, idx) => `${idx+1}. ${name}`);
    document.getElementById('orderOutput').value = lines.join("\n");

    const orderJson = result.map((name, idx) => ({ name, order: idx+1 }));
    if(document.getElementById('orderJsonInput')) document.getElementById('orderJsonInput').value = JSON.stringify(orderJson);

    // 履歴に保存
    pushToHistory('order', { result: result });
    // 回次表示を更新（履歴を追加した後に確実に更新）
    updateOrderRoundDisplay();

    showToast("順番を割り当てました");
    switchResultTab('order');
  }

  function assignRoles(){
    const raw = getRawValue().trim();
    const rawList = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [];
    let members = rawList.map(s=>s.split('#')[0].trim());
    if(members.length===0){ showToast("メンバーがいません"); return; }

    const roles = document.getElementById('rolesInput').value.split(/[\r\n,]+/).map(r=>r.trim()).filter(Boolean);
    if(roles.length===0){ showToast("役割が未入力です"); return; }

    function shuffleArray(arr){
      for(let i=arr.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [arr[i], arr[j]]=[arr[j], arr[i]];
      }
    }

    const pool = members.slice();
    shuffleArray(pool);

    const assignments = [];
    for(let i=0;i<roles.length && i<pool.length;i++){
      assignments.push({ name: pool[i], role: roles[i] });
    }
    const assignedNames = new Set(assignments.map(a=>a.name));
    for(const m of members){
      if(!assignedNames.has(m)) assignments.push({ name: m, role: null });
    }

    const displayLines = assignments.map(a => a.role ? `${a.name}: ${a.role}` : `${a.name}: `);
    document.getElementById('rolesOutput').value = displayLines.join("\n");

    try {
      const settingsField = document.getElementById('settingsJsonInput');
      let settings = {};
      if(settingsField && settingsField.value) {
        try { settings = JSON.parse(settingsField.value); } catch(e){ settings = {}; }
      }
      settings.role_assignments = assignments.map(a => ({ name: a.name, role: a.role }));
      // 役割名も保存（復元用）
      settings.roles = roles.join('\n');
      if(settingsField) settingsField.value = JSON.stringify(settings);
    } catch(e){
      const settingsField = document.getElementById('settingsJsonInput');
      if(settingsField) settingsField.value = JSON.stringify({
        role_assignments: assignments.map(a=>({ name:a.name, role: a.role })),
        roles: roles.join('\n')
      });
    }

    // 履歴に保存
    pushToHistory('roles', { assignments: assignments });
    // 回次表示を更新（履歴を追加した後に確実に更新）
    updateRolesRoundDisplay();

    showToast("役割を割り当てました");
    switchResultTab('roles');
  }

  function showGroups(){
    const raw = getRawValue().trim();
    const rawList = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [];
    const entries = rawList.map(parseEntry);

    const { ids: groupIds, idToName } = buildGroupIdsAndNames();
    const groups=Object.fromEntries(groupIds.map(g=>[g,[]]));
    for(const e of entries){
      const last=e.history.at(-1);
      const m = last ? last.match(/#\d+([A-Z])$/) : null;
      let id = m ? m[1] : null;
      if(!id || !groupIds.includes(id)) {
        let empty = groupIds.find(g=>groups[g].length===0);
        if(empty) id = empty;
        else {
          const minSize = Math.min(...groupIds.map(g=>groups[g].length));
          id = groupIds.find(g=>groups[g].length===minSize);
        }
      }
      groups[id].push(e.name);
    }

    const sepVal = document.getElementById('separatorSelect').value;
    // sepVal が "\\n" や "\\t" のようにエスケープ表現で入っている場合でも
    // 正しく改行・タブ文字に変換して表示する
    let memberSep;
    if (sepVal === '\\t' || sepVal === '\\\\t' || sepVal === '\t') {
      memberSep = '\t';
    } else if (sepVal === '\\n' || sepVal === '\\\\n' || sepVal === '\n') {
      memberSep = '\n';
    } else {
      memberSep = sepVal;
    }

    // 表示内容の取得
    const displayFormat = document.getElementById('displayFormatSelect') ? document.getElementById('displayFormatSelect').value : 'name_count_break';

    // 表示内容から設定を決定
    let showLabel, showCount, breakMemberLine;
    switch(displayFormat) {
      case 'name':
        showLabel = true;
        showCount = false;
        breakMemberLine = false;
        break;
      case 'name_break':
        showLabel = true;
        showCount = false;
        breakMemberLine = true;
        break;
      case 'name_count':
        showLabel = true;
        showCount = true;
        breakMemberLine = false;
        break;
      case 'name_count_break':
        showLabel = true;
        showCount = true;
        breakMemberLine = true;
        break;
      case 'none':
        showLabel = false;
        showCount = false;
        breakMemberLine = false;
        break;
      default:
        showLabel = true;
        showCount = true;
        breakMemberLine = true;
    }

    const groupSepVal = document.getElementById('groupSeparatorSelect') ? document.getElementById('groupSeparatorSelect').value : 'space';

    let groupSep = '\n\n';
    if(groupSepVal === 'none') groupSep = '\n';
    else if(groupSepVal === 'space') groupSep = '\n\n';
    else if(groupSepVal === 'line') groupSep = '\n────────\n';
    else if(groupSepVal === 'wave') groupSep = '\n〜〜〜〜〜〜〜\n';

    const parts = [];
    for(const id of groupIds){
      const members=groups[id];
      const label = idToName[id] || id;
      let block = '';
      if(showLabel){
        const countText = showCount ? `（${members.length}人）` : '';
        block += breakMemberLine ? `${label}${countText}：\n` : `${label}${countText}： `;
      }
      block += members.join(memberSep);
      parts.push(block);
    }

    const display = parts.join(groupSep);
    document.getElementById('groupOutput').value=display.trim();

    // 回次表示を更新
    updateGroupRoundDisplay();
  }

  function showStats(){
    const raw = getRawValue().trim();
    const rawList = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [];
    const entries=rawList.map(parseEntry);
    const coMap=getCoOccurrenceMap(entries,true);

    const { ids: groupIds, idToName } = buildGroupIdsAndNames();
    const groupMap=Object.fromEntries(groupIds.map(g=>[g,[]]));
    for(const e of entries){
      const last=e.history.at(-1);
      const m = last ? last.match(/#\d+([A-Z])$/) : null;
      let id = m ? m[1] : null;
      if(!id || !groupIds.includes(id)){
        let empty = groupIds.find(g=>groupMap[g].length===0);
        if(empty) id = empty;
        else {
          const minSize = Math.min(...groupIds.map(g=>groupMap[g].length));
          id = groupIds.find(g=>groupMap[g].length===minSize);
        }
      }
      groupMap[id].push(e.name);
    }

    // 被り確認の計算
    const output = [];

    // 1. グループごとのメンバー被り率を計算
    const groupOverlapRates = [];
    for(const id of groupIds){
      const members = groupMap[id];
      if(members.length < 2) continue;

      let totalOverlap = 0;
      let pairCount = 0;
      for(let i = 0; i < members.length; i++){
        for(let j = i + 1; j < members.length; j++){
          const m1 = members[i];
          const m2 = members[j];
          const overlap = (coMap[m1] && coMap[m1][m2]) ? coMap[m1][m2] : 0;
          totalOverlap += overlap;
          pairCount++;
        }
      }
      const avgOverlap = pairCount > 0 ? (totalOverlap / pairCount) : 0;
      if(avgOverlap > 0){
        groupOverlapRates.push({
          id: id,
          label: idToName[id] || id,
          rate: avgOverlap
        });
      }
    }

    // メンバー被り率でソート（高い順）
    groupOverlapRates.sort((a, b) => b.rate - a.rate);

    // 2. 被りがあったメンバーを回数ごとにグループ化して抽出
    const allMembers = new Set();
    for(const members of Object.values(groupMap)){
      for(const m of members) allMembers.add(m);
    }
    const memberList = Array.from(allMembers);

    // メンバーごとの最大被り回数を記録
    const memberMaxOverlap = {}; // { メンバー名: 最大被り回数 }

    // 今回一緒になったメンバーの被りをチェック
    for(const members of Object.values(groupMap)){
      if(members.length < 2) continue;

      // このグループ内で被りがあるメンバーを抽出
      for(let i = 0; i < members.length; i++){
        for(let j = i + 1; j < members.length; j++){
          const m1 = members[i];
          const m2 = members[j];
          const count = (coMap[m1] && coMap[m1][m2]) ? coMap[m1][m2] : 0;

          if(count > 0){
            // 各メンバーの最大被り回数を更新
            memberMaxOverlap[m1] = Math.max(memberMaxOverlap[m1] || 0, count);
            memberMaxOverlap[m2] = Math.max(memberMaxOverlap[m2] || 0, count);
          }
        }
      }
    }

    // 最大被り回数ごとにメンバーをグループ化
    const memberOverlapGroups = {}; // { 回数: Set(メンバー名) }
    for(const [member, maxCount] of Object.entries(memberMaxOverlap)){
      if(!memberOverlapGroups[maxCount]){
        memberOverlapGroups[maxCount] = new Set();
      }
      memberOverlapGroups[maxCount].add(member);
    }

    // 3. 新しい組み合わせのメンバーを抽出
    const newCombinationMembers = [];
    for(const member of memberList){
      // このメンバーが今回一緒になった全員との被り回数をチェック
      let allNew = true;
      for(const members of Object.values(groupMap)){
        if(!members.includes(member)) continue;
        for(const other of members){
          if(other === member) continue;
          const count = (coMap[member] && coMap[member][other]) ? coMap[member][other] : 0;
          if(count > 0){
            allNew = false;
            break;
          }
        }
        if(!allNew) break;
      }
      if(allNew && memberList.length > 1){
        newCombinationMembers.push(member);
      }
    }

    // 出力の構築
    if(groupOverlapRates.length > 0){
      output.push('⚠ 被りがあったグループ：');
      for(const g of groupOverlapRates){
        output.push(`  ${g.label}（メンバー被り率${g.rate.toFixed(2)}）`);
      }
    }

    // 被り回数の多い順にソートして表示
    const sortedCounts = Object.keys(memberOverlapGroups).map(Number).sort((a, b) => b - a);
    if(sortedCounts.length > 0){
      if(groupOverlapRates.length > 0) output.push('');
      output.push('⚠ 被りがあったメンバー：');
      for(const count of sortedCounts){
        const members = Array.from(memberOverlapGroups[count]);
        members.sort(); // メンバー名をソート
        output.push(`  ${members.join(' & ')}（メンバー被り${count}回目）`);
      }
    }

    if(newCombinationMembers.length > 0){
      if(groupOverlapRates.length > 0 || sortedCounts.length > 0) output.push('');
      output.push('✓ 全員が新しい組み合わせのメンバー：');
      output.push(`  ${newCombinationMembers.join(', ')}`);
    }

    // 「全員が新しい組み合わせのメンバー：」が表示されていない場合のみ表示
    if(groupOverlapRates.length === 0 && sortedCounts.length === 0 && newCombinationMembers.length === 0){
      output.push('未実施');
    }

    document.getElementById('statsOutput').value = output.join('\n');

    // 回次表示を更新
    updateGroupRoundDisplay();
  }

  function updateGroupRoundDisplay(){
    const el = document.getElementById('groupRoundHint');
    if(!el) return;

    // 【新】タイプ別履歴から取得（提案1の実装）
    const groupsHistory = historyData.groups;
    if(groupsHistory.length === 0){
      el.innerHTML = '現在のグループ分け表示：<span class="font-bold">未実施</span>';
      return;
    }

    // 【新】currentRoundIndexを使用して現在の位置を表示
    const currentIdx = currentRoundIndex.groups;
    if(currentIdx >= 0 && currentIdx < groupsHistory.length){
      const currentRound = currentIdx + 1;
      el.innerHTML = `現在のグループ分け表示：<span class="font-bold">${currentRound}/${groupsHistory.length}回目</span>`;
    } else {
      // 最新のグループ分けを表示
      el.innerHTML = `現在のグループ分け表示：<span class="font-bold">${groupsHistory.length}/${groupsHistory.length}回目</span>`;
    }

    // ボタンの無効化ロジックを更新
    updateNavigationButtons('groups');
  }

  function updateOrderRoundDisplay(){
    const el = document.getElementById('orderRoundHint');
    if(!el) return;

    // 【新】タイプ別履歴から取得（提案1の実装）
    const orderEntries = historyData.order;
    if(orderEntries.length === 0){
      el.innerHTML = '現在の順番決め表示：<span class="font-bold">未実施</span>';
      return;
    }

    // 【新】currentRoundIndexを使用して現在の位置を表示
    const currentIdx = currentRoundIndex.order;
    if(currentIdx >= 0 && currentIdx < orderEntries.length){
      const currentRound = currentIdx + 1;
      el.innerHTML = `現在の順番決め表示：<span class="font-bold">${currentRound}/${orderEntries.length}回目</span>`;
    } else {
      // 最新の順番決めを表示
      el.innerHTML = `現在の順番決め表示：<span class="font-bold">${orderEntries.length}/${orderEntries.length}回目</span>`;
    }

    // ボタンの無効化ロジックを更新
    updateNavigationButtons('order');
  }

  function updateRolesRoundDisplay(){
    const el = document.getElementById('rolesRoundHint');
    if(!el) return;

    // 【新】タイプ別履歴から取得（提案1の実装）
    const rolesEntries = historyData.roles;
    if(rolesEntries.length === 0){
      el.innerHTML = '現在の役割分担表示：<span class="font-bold">未実施</span>';
      return;
    }

    // 【新】currentRoundIndexを使用して現在の位置を表示
    const currentIdx = currentRoundIndex.roles;
    if(currentIdx >= 0 && currentIdx < rolesEntries.length){
      const currentRound = currentIdx + 1;
      el.innerHTML = `現在の役割分担表示：<span class="font-bold">${currentRound}/${rolesEntries.length}回目</span>`;
    } else {
      // 最新の役割分担を表示
      el.innerHTML = `現在の役割分担表示：<span class="font-bold">${rolesEntries.length}/${rolesEntries.length}回目</span>`;
    }

    // ボタンの無効化ロジックを更新
    updateNavigationButtons('roles');
  }

  // ナビゲーションボタンの無効化ロジックを更新
  function updateNavigationButtons(type) {
    const prevBtn = document.getElementById('btn-prev-' + type);
    const nextBtn = document.getElementById('btn-next-' + type);

    if(!prevBtn || !nextBtn) return;

    // 【新】タイプ別履歴から取得（提案1の実装）
    const entries = historyData[type];

    if(entries.length === 0){
      // 履歴がない場合、両方のボタンを無効化
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    // 【新】currentRoundIndexを使用
    const currentIdx = currentRoundIndex[type];

    if(currentIdx < 0){
      // 現在の位置が無効な場合、最新を表示しているとみなす
      prevBtn.disabled = false;
      nextBtn.disabled = true;
    } else {
      // 最初と最後を判定
      prevBtn.disabled = (currentIdx <= 0);
      nextBtn.disabled = (currentIdx >= entries.length - 1);
    }
  }

  function updateParticipantCount(){
    const raw = getRawValue().trim();
    const count = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean).length : 0;
    const span=document.getElementById('groupSizeHint');
    const memberSpan=document.getElementById('memberCountHint');

    const customNamesEl = document.getElementById('customGroupNames');
    let groupCount;
    if(customNamesEl){
      const customNames = (customNamesEl.value || "").split(/[\r\n,]+/).map(n=>n.trim()).filter(Boolean);
      if(customNames.length > 0) groupCount = Math.min(customNames.length, MAX_GROUPS);
    }
    if(!groupCount){
      const groupCountInputEl = document.getElementById('groupCount');
      groupCount = clampGroupCount(groupCountInputEl ? groupCountInputEl.value : 3);
    }

    if(memberSpan){
      if(count){
        memberSpan.innerHTML = `現在のメンバー数：<span class="font-bold">${count}人</span>`;
      } else {
        memberSpan.innerHTML = '現在のメンバー数：<span class="font-bold">未入力</span>';
      }
    }

    if(span){
      if(count === 0){
        span.innerHTML = '現在の1グループあたり：<span class="font-bold">未計算</span>';
      } else {
        const min=Math.floor(count/groupCount), max=Math.ceil(count/groupCount);
        if(min===max){
          span.innerHTML = `現在の1グループあたり：<span class="font-bold">${min}人</span>`;
        } else {
          span.innerHTML = `現在の1グループあたり：<span class="font-bold">${min}〜${max}人</span>`;
        }
      }
    }

    // 回次表示を更新（メンバーや履歴が変わったときに反映）
    updateGroupRoundDisplay();
  }

  function copyGroupOutput(){ navigator.clipboard.writeText(document.getElementById('groupOutput').value).then(()=>showToast("コピーしました！")).catch(()=>showToast("コピーに失敗しました")); }
  function copyOrderOutput(){ navigator.clipboard.writeText(document.getElementById('orderOutput').value).then(()=>showToast("コピーしました！")).catch(()=>showToast("コピーに失敗しました")); }
  function copyRolesOutput(){ navigator.clipboard.writeText(document.getElementById('rolesOutput').value).then(()=>showToast("コピーしました！")).catch(()=>showToast("コピーに失敗しました")); }

  // showToast の位置を常に上から100pxの位置に表示するよう変更
  function showToast(msg){
    const toast = document.getElementById('toast');
    if(!toast) return;
    // 優先して top を固定、bottom は解除
    toast.style.top = TOAST_TOP_POSITION;
    toast.style.bottom = 'auto';
    // 中央揃えの transform / left を確実に適用
    toast.style.left = '50%';
    // 前面に出す
    toast.style.zIndex = '1000';
    toast.textContent = msg;
    toast.classList.remove('opacity-0');
    setTimeout(()=>toast.classList.add('opacity-0'), TOAST_DURATION);
  }

  // 統一された履歴保存関数
  function pushToHistory(type = 'groups', data = null){
    // データの準備
    let entryData = data;
    if (type === 'groups') {
      const text = getRawValue();
      // 履歴が空で現在の raw が空文字列の場合は履歴に追加しない
      if (shufflyHistory.length === 0 && text.trim() === "") return;
      // グループ分けが実行されているかチェック（履歴情報 #1A などが含まれているか）
      // これによりメンバー入力時の「未実施」状態が履歴に保存されるのを防ぐ
      const hasGroupHistory = /#\d+[A-Z]/.test(text);
      if (!hasGroupHistory) {
        // グループ分けが実行されていない場合は履歴に追加しない
        return;
      }
      // 最後の履歴と同じ場合は追加しない
      if(currentHistoryIndex>=0) {
        const lastEntry = shufflyHistory[currentHistoryIndex];
        if(lastEntry && lastEntry.type === 'groups' && lastEntry.data && lastEntry.data.membersRaw === text) return;
      }
      entryData = { membersRaw: text };
    }

    // 履歴エントリの作成
    const historyEntry = {
      type: type,                    // 'groups', 'order', 'roles'
      timestamp: Date.now(),          // タイムスタンプ（ミリ秒）
      data: entryData
    };

    // グループ分けの場合は round 情報も追加
    if (type === 'groups' && entryData.membersRaw) {
      const entries = entryData.membersRaw.split(/[\r\n,]+/).map(s=>parseEntry(s.trim())).filter(Boolean);
      historyEntry.round = getCurrentRound(entries);
    }

    // 【旧】時系列履歴を追加（後方互換性のため残す）
    shufflyHistory = shufflyHistory.slice(0, currentHistoryIndex + 1);
    shufflyHistory.push(historyEntry);
    currentHistoryIndex++;

    // 【新】タイプ別履歴に追加（提案1の実装）
    // 重要: ここでは履歴を削除せず、常に追加のみ行う
    // これにより「他の項目の履歴がクリアされる」問題を解決
    const newRound = historyData[type].length + 1;  // 提案2の実装: round番号を自動採番
    const newEntry = {
      round: newRound,
      timestamp: historyEntry.timestamp,
      data: entryData
    };
    historyData[type].push(newEntry);
    currentRoundIndex[type] = historyData[type].length - 1;  // 最新を表示

    // 正規化形式では履歴は保存時に構築されるため、リアルタイム更新は不要
  }

  function undoHistory(){
    // 現在表示中のタブによって、対象となる履歴を判定
    const activeTab = document.querySelector('#tab-groups:not(.border-transparent)') ? 'groups' :
                      document.querySelector('#tab-order:not(.border-transparent)') ? 'order' :
                      document.querySelector('#tab-roles:not(.border-transparent)') ? 'roles' : 'groups';

    // 【新】タイプ別履歴から前の履歴を取得（提案1の実装）
    const currentIdx = currentRoundIndex[activeTab];
    if (currentIdx <= 0) {
      // これ以上戻れない
      return;
    }

    // 1つ前の履歴に移動
    currentRoundIndex[activeTab] = currentIdx - 1;
    const entry = historyData[activeTab][currentRoundIndex[activeTab]];

    // タイプごとに表示を更新
    if(activeTab === 'groups') {
      const val = entry.data.membersRaw;
      setRawAndRefreshDisplay(val || "");
      updateParticipantCount();
      showGroups();
      showStats();
      try{
        const entries = val ? val.split(/[\r\n,]+/).map(s=>parseEntry(s.trim())) : [];
        if(document.getElementById('membersDataInput')) document.getElementById('membersDataInput').value = JSON.stringify(entries);
      }catch(e){}
      updateGroupRoundDisplay();
      switchResultTab('groups');
    } else if(activeTab === 'order') {
      const result = entry.data.result || [];
      const lines = result.map((name, idx) => `${idx+1}. ${name}`);
      document.getElementById('orderOutput').value = lines.join("\n");
      const orderJson = result.map((name, idx) => ({ name, order: idx+1 }));
      if(document.getElementById('orderJsonInput')) document.getElementById('orderJsonInput').value = JSON.stringify(orderJson);
      updateOrderRoundDisplay();
      switchResultTab('order');
    } else if(activeTab === 'roles') {
      const assignments = entry.data.assignments || [];
      const displayLines = assignments.map(a => a.role ? `${a.name}: ${a.role}` : `${a.name}: `);
      document.getElementById('rolesOutput').value = displayLines.join("\n");
      updateRolesRoundDisplay();
      switchResultTab('roles');
    }
  }

  function redoHistory(){
    // 現在表示中のタブによって、対象となる履歴を判定
    const activeTab = document.querySelector('#tab-groups:not(.border-transparent)') ? 'groups' :
                      document.querySelector('#tab-order:not(.border-transparent)') ? 'order' :
                      document.querySelector('#tab-roles:not(.border-transparent)') ? 'roles' : 'groups';

    // 【新】タイプ別履歴から次の履歴を取得（提案1の実装）
    const currentIdx = currentRoundIndex[activeTab];
    const maxIdx = historyData[activeTab].length - 1;
    if (currentIdx >= maxIdx) {
      // これ以上進めない
      return;
    }

    // 1つ次の履歴に移動
    currentRoundIndex[activeTab] = currentIdx + 1;
    const entry = historyData[activeTab][currentRoundIndex[activeTab]];

    // タイプごとに表示を更新
    if(activeTab === 'groups') {
      const val = entry.data.membersRaw;
      setRawAndRefreshDisplay(val || "");
      updateParticipantCount();
      showGroups();
      showStats();
      try{
        const entries = val ? val.split(/[\r\n,]+/).map(s=>parseEntry(s.trim())) : [];
        if(document.getElementById('membersDataInput')) document.getElementById('membersDataInput').value = JSON.stringify(entries);
      }catch(e){}
      updateGroupRoundDisplay();
      switchResultTab('groups');
    } else if(activeTab === 'order') {
      const result = entry.data.result || [];
      const lines = result.map((name, idx) => `${idx+1}. ${name}`);
      document.getElementById('orderOutput').value = lines.join("\n");
      const orderJson = result.map((name, idx) => ({ name, order: idx+1 }));
      if(document.getElementById('orderJsonInput')) document.getElementById('orderJsonInput').value = JSON.stringify(orderJson);
      updateOrderRoundDisplay();
      switchResultTab('order');
    } else if(activeTab === 'roles') {
      const assignments = entry.data.assignments || [];
      const displayLines = assignments.map(a => a.role ? `${a.name}: ${a.role}` : `${a.name}: `);
      document.getElementById('rolesOutput').value = displayLines.join("\n");
      updateRolesRoundDisplay();
      switchResultTab('roles');
    }
  }

  function switchResultTab(name){
    // hide all panels
    document.querySelectorAll('.result-panel').forEach(el=>el.classList.add('hidden'));

    // normalize tab styles: remove active styles (including pill background/ring/shadow)
    document.querySelectorAll('#tab-groups, #tab-order, #tab-roles').forEach(b=>{
      b.classList.remove('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      b.classList.add('border-transparent','text-gray-600');
    });

    if(name==='groups'){
      const panel = document.getElementById('panel-groups'); if(panel) panel.classList.remove('hidden');
      const el=document.getElementById('tab-groups');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
      // Update navigation buttons
      updateNavigationButtons('groups');
    }
    if(name==='order'){
      const panel = document.getElementById('panel-order'); if(panel) panel.classList.remove('hidden');
      const el=document.getElementById('tab-order');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
      // Update navigation buttons
      updateNavigationButtons('order');
    }
    if(name==='roles'){
      const panel = document.getElementById('panel-roles'); if(panel) panel.classList.remove('hidden');
      const el=document.getElementById('tab-roles');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
      // Update navigation buttons
      updateNavigationButtons('roles');
    }
  }

  function switchSettingsTab(name){
    document.querySelectorAll('.settings-panel').forEach(el=>el.classList.add('hidden'));

    // normalize settings tab styles and remove pill active styles
    document.querySelectorAll('#tab-settings-groups, #tab-settings-order, #tab-settings-roles').forEach(b=>{
      b.classList.remove('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      b.classList.add('border-transparent','text-gray-600');
    });

    if(name==='groups'){
      document.getElementById('panel-settings-groups').classList.remove('hidden');
      const el=document.getElementById('tab-settings-groups');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
    }
    if(name==='order'){
      document.getElementById('panel-settings-order').classList.remove('hidden');
      const el=document.getElementById('tab-settings-order');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
    }
    if(name==='roles'){
      document.getElementById('panel-settings-roles').classList.remove('hidden');
      const el=document.getElementById('tab-settings-roles');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
    }

    const gAct = document.getElementById('settings-action-groups');
    const oAct = document.getElementById('settings-action-order');
    const rAct = document.getElementById('settings-action-roles');
    if(gAct) gAct.classList.add('hidden');
    if(oAct) oAct.classList.add('hidden');
    if(rAct) rAct.classList.add('hidden');
    if(name==='groups' && gAct) gAct.classList.remove('hidden');
    if(name==='order' && oAct) oAct.classList.remove('hidden');
    if(name==='roles' && rAct) rAct.classList.remove('hidden');
  }

  function triggerImport(){ const f = document.getElementById('importFile'); if(f) f.click(); }

  function handleImportFile(e){
    const file = e.target.files ? e.target.files[0] : null;
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const text = ev.target.result;
      const cur = getRawValue().trim();
      const merged = (cur?cur + "\n":"") + text.replace(/\r/g,'').trim();
      setRawAndRefreshDisplay(merged);
      updateParticipantCount(); pushToHistory();
      showToast("ファイルをインポートしました");
    };
    reader.readAsText(file, 'utf-8');
  }

  function pasteFromClipboard(){
    navigator.clipboard.readText().then(txt=>{
      const cur = getRawValue().trim();
      const merged = (cur?cur + "\n":"") + txt.replace(/\r/g,'').trim();
      setRawAndRefreshDisplay(merged);
      updateParticipantCount(); pushToHistory();
      showToast("クリップボードから貼り付けました");
    }).catch(()=>showToast("クリップボードにアクセスできません"));
  }

  /* --- 追加: サンプルデータ挿入機能（15人プール、ランダムで10人選択） --- */
  function insertSampleData(){
    const confirmed = window.confirm("メンバーリスト欄にサンプルデータ10人分を上書きします。よろしいですか？");
    if(!confirmed) return;

    const samplePool = [
      "佐藤 太郎",
      "鈴木 花子",
      "高橋 一郎",
      "田中 愛",
      "伊藤 健",
      "渡辺 真由美",
      "山本 大輔",
      "中村 彩",
      "小林 翼",
      "加藤 恵",
      "斎藤 翔",
      "井上 真由",
      "木村 拓也",
      "清水 直子",
      "長谷川 智子"
    ];

    // Fisher-Yates shuffle
    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    const chosen = shuffle(samplePool).slice(0, SAMPLE_SELECT_SIZE);
    const sample = chosen.join("\n");

    setRawAndRefreshDisplay(sample);
    updateParticipantCount();
    pushToHistory();
    try{
      const entries = sample.split(/[\r\n,]+/).map(s=>parseEntry(s.trim()));
      if(document.getElementById('membersDataInput')) document.getElementById('membersDataInput').value = JSON.stringify(entries);
    }catch(e){}
    showToast("サンプルデータを入力しました");
  }
  /* --- end 追加 --- */

  function clearMemberHistories(){
    const confirmed = window.confirm("全てのシャッフル履歴を一括で削除します。よろしいですか？");
    if(!confirmed) return;

    const cur = getRawValue() || "";
    const cleaned = cur.split(/[\r\n,]+/).map(s=>s.split('#')[0].trim()).filter(Boolean);
    setRawAndRefreshDisplay(cleaned.join("\n"));

    try{
      const entries = cleaned.map(s=>parseEntry(s));
      const mj = document.getElementById('membersDataInput');
      if(mj) mj.value = JSON.stringify(entries);
    }catch(e){}

    // 履歴配列を完全にクリア（全てのタイプの履歴を削除）
    shufflyHistory = [];
    currentHistoryIndex = -1;

    const histField = document.getElementById('historyJsonInput');
    if(histField) histField.value = "";

    // グループ表示をクリア
    const gOut = document.getElementById('groupOutput');
    const sOut = document.getElementById('statsOutput');
    const gr = document.getElementById('groupRoundHint');
    if(gOut) gOut.value = "";
    if(sOut) sOut.value = "";
    if(gr) gr.innerHTML = '現在のグループ分け表示：<span class="font-bold">未実施</span>';

    // 順番表示をクリア
    const oOut = document.getElementById('orderOutput');
    const or = document.getElementById('orderRoundHint');
    const oJson = document.getElementById('orderJsonInput');
    if(oOut) oOut.value = "";
    if(or) or.innerHTML = '現在の順番決め表示：<span class="font-bold">未実施</span>';
    if(oJson) oJson.value = "[]";

    // 役割表示をクリア
    const rOut = document.getElementById('rolesOutput');
    const rr = document.getElementById('rolesRoundHint');
    const sJson = document.getElementById('settingsJsonInput');
    if(rOut) rOut.value = "";
    if(rr) rr.innerHTML = '現在の役割分担表示：<span class="font-bold">未実施</span>';
    if(sJson) {
      try {
        const settings = JSON.parse(sJson.value || '{}');
        delete settings.role_assignments;
        sJson.value = JSON.stringify(settings);
      } catch(e) {
        sJson.value = "{}";
      }
    }

    updateParticipantCount();
    showToast("全ての履歴をクリアしました");
  }

  function togglePresentationMode(){
    try{
      const payload = {
        members_json: (()=>{ try { return JSON.parse(document.getElementById('membersDataInput')?.value || '[]'); } catch(e){ return getRawValue() || ""; } })(),
        results_json: (()=>{ try { return JSON.parse(document.getElementById('resultsJsonInput')?.value || '{}'); } catch(e){ return document.getElementById('resultsJsonInput')?.value || ""; } })(),
        order_json: (()=>{ try { return JSON.parse(document.getElementById('orderJsonInput')?.value || '[]'); } catch(e){ return document.getElementById('orderOutput')?.value || ""; } })(),
        settings_json: (()=>{ try { return JSON.parse(document.getElementById('settingsJsonInput')?.value || '{}'); } catch(e){ return document.getElementById('settingsJsonInput')?.value || ""; } })(),
        history_json: document.getElementById('historyJsonInput')?.value || "",
        title: document.getElementById('shareEventTitle')?.value || document.title || ''
      };
      try {
        localStorage.setItem('presentation_shuffly_event', JSON.stringify(payload));
      } catch(storageError) {
        if (storageError.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded', storageError);
          showToast('ストレージ容量が不足しています');
        } else {
          throw storageError;
        }
      }
    }catch(e){
      console.warn('presentation payload store failed', e);
    }

    const presentationPath = '/events/show';
    const w = window.open(presentationPath, '_blank', 'noopener');
    if(!w) showToast("ポップアップがブロックされました。ポップアップを許可してください");

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('shuffly_channel');
        setTimeout(()=> {
          try {
            const initPayload = {
              type: 'init',
              payload: payload,
              timestamp: Date.now()
            };
            bc.postMessage(initPayload);
          } catch(err){
            console.warn('BroadcastChannel post failed', err);
          } finally {
            try { bc.close(); } catch(e){}
          }
        }, 150);
      }
    } catch(e){
      console.warn('BroadcastChannel unavailable', e);
    }
  }

  function exportResults(){
    const groups = document.getElementById('groupOutput').value;
    const order = document.getElementById('orderOutput').value;
    const roles = document.getElementById('rolesOutput').value;
    const blob = new Blob([`グループ:\n${groups}\n\n順番:\n${order}\n\n役割:\n${roles}`], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (document.getElementById('shareEventTitle').value || 'shuffly_result') + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("結果を出力しました");
  }

  function saveResults(){
    try{
      // 正規化形式でデータを準備
      const membersRaw = getRawValue().trim().split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean);
      const members = membersRaw.map((name, idx) => ({ id: idx + 1, name: name.split('#')[0].trim() }));

      // members_dataを設定
      document.getElementById('membersDataInput').value = JSON.stringify({ members: members });

      // group_roundsを設定（履歴から構築）
      document.getElementById('groupRoundsInput').value = JSON.stringify(shufflyHistory.filter(h => h.type === 'groups').map(h => {
        // membersRawからグループ情報を抽出
        const membersRaw = h.data?.membersRaw || '';
        const groups = {};

        if (membersRaw) {
          const lines = membersRaw.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
          lines.forEach(line => {
            const name = line.split('#')[0].trim();
            const historyMatch = line.match(/#\d+([A-Z])$/);
            if (historyMatch && name) {
              const groupId = historyMatch[1];
              if (!groups[groupId]) {
                groups[groupId] = [];
              }
              const member = members.find(m => m.name === name);
              if (member) {
                groups[groupId].push({
                  member_id: member.id,
                  name: member.name
                });
              }
            }
          });
        }

        // groups形式をassignments形式に変換
        const assignments = Object.keys(groups).map(groupId => ({
          group_id: groupId,
          group_name: `グループ${groupId}`,
          members: groups[groupId]
        }));

        return {
          round: h.round,
          timestamp: h.timestamp,
          assignments: assignments,
          groups: groups,  // 互換性のため
          settings: h.data?.settings || {}
        };
      }));

      // order_roundsを設定
      document.getElementById('orderRoundsInput').value = JSON.stringify(shufflyHistory.filter(h => h.type === 'order').map((h, idx) => ({
        round: h.round || (idx + 1),
        timestamp: h.timestamp,
        result: h.data?.result || [],  // 名前の配列をそのまま保存
        order: h.data?.result?.map(name => {
          const member = members.find(m => m.name === name);
          return member ? { member_id: member.id, name: member.name } : null;
        }).filter(Boolean) || []
      })));

      // role_roundsを設定
      document.getElementById('roleRoundsInput').value = JSON.stringify(shufflyHistory.filter(h => h.type === 'roles').map((h, idx) => ({
        round: h.round || (idx + 1),
        timestamp: h.timestamp,
        assignments: (h.data?.assignments || []).map(a => {
          const member = members.find(m => m.name === a.name);
          return member ? {
            member_id: member.id,
            name: member.name,
            role: a.role
          } : null;
        }).filter(Boolean)
      })));

      // co_occurrence_cacheを設定（簡易版）
      const cache = {};
      shufflyHistory.filter(h => h.type === 'groups').forEach(() => {
        // 履歴から被り回数を計算（簡易実装）
        // TODO: 将来的に実装
      });
      document.getElementById('coOccurrenceCacheInput').value = JSON.stringify(cache);

    }catch(e){
      console.warn('JSON シリアライズ失敗:', e);
    }

    // タイトルを設定
    const titleField = document.getElementById('hiddenEventTitle');
    if(titleField) titleField.value = document.getElementById('shareEventTitle').value;

    // メモを設定
    const memoField = document.getElementById('hiddenEventMemo');
    const memoText = document.getElementById('memoText');
    if(memoField && memoText) memoField.value = memoText.value;

    if(IS_SIGNED_IN){
      const form = document.getElementById('saveForm');
      if(form) {
        form.submit();
      } else {
        showToast("フォームが見つかりません");
      }
    } else {
      try {
        // ログインしていない場合のローカルストレージ保存（正規化形式）
        const payloadPreview = {
          data_version: 2,
          members_data: document.getElementById('membersDataInput').value,
          group_rounds: document.getElementById('groupRoundsInput').value,
          order_rounds: document.getElementById('orderRoundsInput').value,
          role_rounds: document.getElementById('roleRoundsInput').value,
          co_occurrence_cache: document.getElementById('coOccurrenceCacheInput').value,
          title: document.getElementById('hiddenEventTitle') ? document.getElementById('hiddenEventTitle').value : ''
        };

        // トークンを生成（Cookie Overflow対策）
        const token = 'shuffly_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);

        try {
          // データとトークンを保存
          localStorage.setItem('pending_shuffly_event', JSON.stringify(payloadPreview));
          localStorage.setItem('pending_shuffly_token', token);
        } catch(storageError) {
          if (storageError.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded', storageError);
            showToast('ストレージ容量が不足しています');
            return;
          } else {
            throw storageError;
          }
        }

        // トークンをクエリパラメータで渡す
        const loginUrl = new_user_session_path + "?redirect_to=" + encodeURIComponent(window.location.href) + "&pending_event_token=" + encodeURIComponent(token);
        window.location.href = loginUrl;
      } catch(e){
        showToast("保存処理に失敗しました");
      }
    }
  }

  // --- 初期化: ページ読み込み時に状態を復元 / UI 初期化 ---
  function initialize(config) {
    // 設定を受け取る
    IS_SIGNED_IN = config.isSignedIn || false;
    ICON_EXPAND = config.iconExpand || '';
    ICON_COLLAPSE = config.iconCollapse || '';
    new_user_session_path = config.newUserSessionPath || '/users/sign_in';

    const histField = document.getElementById('historyJsonInput');
    if(histField && histField.value){
      try {
        const rawHistory = JSON.parse(histField.value);

        // 既存の履歴データを新しい形式に移行
        if(Array.isArray(rawHistory) && rawHistory.length > 0) {
          // 最初の要素が文字列の場合は旧形式（移行が必要）
          if(typeof rawHistory[0] === 'string') {
            shufflyHistory = rawHistory.map((membersRaw, index) => ({
              type: 'groups',
              timestamp: Date.now() - (rawHistory.length - index) * 1000, // 過去に遡るタイムスタンプ
              data: { membersRaw: membersRaw }
            }));
            // 移行後のデータを保存
            histField.value = JSON.stringify(shufflyHistory);
          } else {
            // すでに新形式の場合はそのまま使用
            shufflyHistory = rawHistory;
          }
        }

        currentHistoryIndex = shufflyHistory.length - 1;
        if (currentHistoryIndex >= 0) {
          const entry = shufflyHistory[currentHistoryIndex];
          // 最新の履歴がグループ分けの場合のみ復元
          if(entry.type === 'groups') {
            const val = entry.data.membersRaw;
            setRawAndRefreshDisplay(val);
          }
        }
      } catch(e) {
        console.error('履歴の読み込みに失敗:', e);
        shufflyHistory=[]; currentHistoryIndex=-1;
      }
    } else {
      updateDisplayFromRaw();
    }
    updateParticipantCount();
    // 初期化時には履歴を作成しない（グループ分け実行時のみ履歴を保存）
    // これにより「0回目（未実施）」が履歴として保存される問題を回避
    // if(shufflyHistory.length === 0 && getRawValue().trim() !== "") pushToHistory('groups');
    switchResultTab('groups');
    switchSettingsTab('groups');

    const sc = document.getElementById('statsContainer');
    const btn = document.getElementById('btn-toggle-stats');
    const textSpan = document.getElementById('btn-toggle-stats-text');
    const icon = document.getElementById('btn-toggle-stats-icon');
    if(sc && btn && textSpan && icon){
      if(statsCollapsed){
        sc.classList.add('hidden');
        textSpan.innerHTML = '<span class="text-sm text-blue-500">●</span> 統計情報';
        btn.setAttribute('aria-expanded', 'false');
        icon.src = ICON_EXPAND;
      } else {
        sc.classList.remove('hidden');
        textSpan.innerHTML = '<span class="text-sm text-blue-500">●</span> 統計情報';
        btn.setAttribute('aria-expanded', 'true');
        icon.src = ICON_COLLAPSE;
      }
    }

    const oc = document.getElementById('optionsContainer');
    const obtn = document.getElementById('btn-toggle-options');
    const otext = document.getElementById('btn-toggle-options-text');
    const oicon = document.getElementById('btn-toggle-options-icon');
    if(oc && obtn && otext && oicon){
      if(optionsCollapsed){
        oc.classList.add('hidden');
        // preserve dot styling by setting innerHTML so the dot keeps text-blue-500
        otext.innerHTML = '<span class="text-sm text-blue-500">●</span> グループ表示オプション';
        obtn.setAttribute('aria-expanded', 'false');
        oicon.src = ICON_EXPAND;
      } else {
        oc.classList.remove('hidden');
        otext.innerHTML = '<span class="text-sm text-blue-500">●</span> グループ表示オプション';
        obtn.setAttribute('aria-expanded', 'true');
        oicon.src = ICON_COLLAPSE;
      }
    }

    if(IS_SIGNED_IN){
      const pending = localStorage.getItem('pending_shuffly_event');
      if(pending){
        try {
          const p = JSON.parse(pending);
          // データ検証: オブジェクトであることと、想定外のプロパティがないかチェック
          if (typeof p !== 'object' || p === null || Array.isArray(p)) {
            console.warn('Invalid pending event data structure');
            localStorage.removeItem('pending_shuffly_event');
            return;
          }
          // 許可されたプロパティのみを処理（XSS等の防止）
          const allowedProps = ['members_json', 'results_json', 'order_json', 'settings_json', 'history_json', 'title'];
          const hasValidProps = Object.keys(p).every(key => allowedProps.includes(key));
          if (!hasValidProps) {
            console.warn('Pending event data contains unexpected properties');
            localStorage.removeItem('pending_shuffly_event');
            return;
          }
          if(p.members_json) document.getElementById('membersDataInput').value = p.members_json;
          if(p.results_json) document.getElementById('resultsJsonInput').value = p.results_json;
          if(p.order_json) document.getElementById('orderJsonInput').value = p.order_json;
          if(p.settings_json) document.getElementById('settingsJsonInput').value = p.settings_json;
          if(p.history_json) document.getElementById('historyJsonInput').value = p.history_json;
          if(p.title && document.getElementById('hiddenEventTitle')) document.getElementById('hiddenEventTitle').value = p.title;
          const form = document.getElementById('saveForm');
          if(form){
            localStorage.removeItem('pending_shuffly_event');
            form.submit();
          }
        } catch(e){
          // 復元に失敗した場合は無視し、不正なデータを削除
          console.warn('Failed to restore pending event', e);
          localStorage.removeItem('pending_shuffly_event');
        }
      }
    }
  }

  function bindEvents() {
    // 簡易バインドヘルパ: 存在する要素にだけイベントを登録
    function bindIf(id, evt, handler){
      const el = document.getElementById(id);
      if(el) el.addEventListener(evt, handler);
    }

    // 表示用 textarea の変更を内部 raw に反映
    bindIf('membersInput', 'input', ()=>{
      if(suppressDisplayInput) return;
      const disp = getDisplayValue();
      const raw = parseDisplayToRaw(disp);
      setRawValue(raw);
      updateParticipantCount();
      // メンバー入力の変更は履歴に保存しない（グループ分け実行時のみ保存）
    });

    // 入力関連のイベント
    bindIf('groupCount', 'input', ()=>{ updateParticipantCount(); });
    bindIf('customGroupNames', 'input', ()=>{ updateParticipantCount(); });
    bindIf('rolesInput', 'input', ()=>{
      const settingsField = document.getElementById('settingsJsonInput');
      if(settingsField) settingsField.value=JSON.stringify({
        roles:document.getElementById('rolesInput').value,
        group_count: buildGroupIdsAndNames().groupCount
      });
    });

    // インポート / サンプルデータ / クリア
    bindIf('btn-trigger-import', 'click', (e)=>{ e.preventDefault(); triggerImport(); });
    bindIf('importFile', 'change', handleImportFile);
    bindIf('btn-insert-sample', 'click', (e)=>{ e.preventDefault(); insertSampleData(); });
    bindIf('btn-clear-history', 'click', (e)=>{ e.preventDefault(); clearMemberHistories(); });

    // タブ操作
    bindIf('tab-settings-groups', 'click', ()=>switchSettingsTab('groups'));
    bindIf('tab-settings-order', 'click', ()=>switchSettingsTab('order'));
    bindIf('tab-settings-roles', 'click', ()=>switchSettingsTab('roles'));

    bindIf('tab-groups', 'click', ()=>switchResultTab('groups'));
    bindIf('tab-order', 'click', ()=>switchResultTab('order'));
    bindIf('tab-roles', 'click', ()=>switchResultTab('roles'));

    // グループ表示オプションの変更（変更してもグループ分け実行前は結果反映しない）
    bindIf('displayFormatSelect', 'change', ()=>{ if(groupsAssigned){ showGroups(); showStats(); } });
    bindIf('separatorSelect', 'change', ()=>{ if(groupsAssigned){ showGroups(); showStats(); } });
    bindIf('groupSeparatorSelect', 'change', ()=>{ if(groupsAssigned){ showGroups(); showStats(); } });

    // コピー / ナビ操作
    bindIf('btn-copy-groupoutput', 'click', (e)=>{
      if(e) e.preventDefault();
      copyGroupOutput();
    });
    bindIf('btn-copy-orderoutput', 'click', (e)=>{
      if(e) e.preventDefault();
      copyOrderOutput();
    });
    bindIf('btn-copy-rolesoutput', 'click', (e)=>{
      if(e) e.preventDefault();
      copyRolesOutput();
    });

    // 統計表示トグル
    bindIf('btn-toggle-stats', 'click', (e)=>{
      if(e) e.preventDefault();
      const sc = document.getElementById('statsContainer');
      const btn = document.getElementById('btn-toggle-stats');
      const textSpan = document.getElementById('btn-toggle-stats-text');
      const icon = document.getElementById('btn-toggle-stats-icon');
      if(!sc || !btn || !textSpan || !icon) return;
      sc.classList.toggle('hidden');
      const expanded = !sc.classList.contains('hidden');
      statsCollapsed = sc.classList.contains('hidden');
      textSpan.innerHTML = '<span class="text-sm text-blue-500">●</span> 統計情報';
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      icon.src = expanded ? ICON_COLLAPSE : ICON_EXPAND;
      if(!statsCollapsed) showStats();
    });

    // グループ表示オプション折りたたみトグル（開閉自体は可能だが、結果表示はグループ分け実行後のみ反映）
    bindIf('btn-toggle-options', 'click', (e)=>{
      if(e) e.preventDefault();
      const oc = document.getElementById('optionsContainer');
      const btn = document.getElementById('btn-toggle-options');
      const textSpan = document.getElementById('btn-toggle-options-text');
      const icon = document.getElementById('btn-toggle-options-icon');
      if(!oc || !btn || !textSpan || !icon) return;
      oc.classList.toggle('hidden');
      const expanded = !oc.classList.contains('hidden');
      optionsCollapsed = oc.classList.contains('hidden');
      // preserve dot styling by setting innerHTML so the dot keeps text-blue-500
      textSpan.innerHTML = '<span class="text-sm text-blue-500">●</span> グループ表示オプション';
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      icon.src = expanded ? ICON_COLLAPSE : ICON_EXPAND;
      // 変更点：グループ分け実行が行われていない限り、開閉時に groupOutput を更新しない
      if(!optionsCollapsed && groupsAssigned) { showGroups(); showStats(); }
    });

    // 結果の履歴移動（グループ）
    bindIf('btn-prev-groups', 'click', (e)=>{
      if(e) e.preventDefault();
      undoHistory();
    });
    bindIf('btn-next-groups', 'click', (e)=>{
      if(e) e.preventDefault();
      redoHistory();
    });

    // 結果の履歴移動（順番）
    bindIf('btn-prev-order', 'click', (e)=>{
      if(e) e.preventDefault();
      undoHistory();
    });
    bindIf('btn-next-order', 'click', (e)=>{
      if(e) e.preventDefault();
      redoHistory();
    });

    // 結果の履歴移動（役割）
    bindIf('btn-prev-roles', 'click', (e)=>{
      if(e) e.preventDefault();
      undoHistory();
    });
    bindIf('btn-next-roles', 'click', (e)=>{
      if(e) e.preventDefault();
      redoHistory();
    });

    // 共有 / エクスポート / 保存
    bindIf('btn-toggle-presentation', 'click', (e)=>{ if(e) e.preventDefault(); togglePresentationMode(); });
    bindIf('btn-export-results', 'click', (e)=>{ if(e) e.preventDefault(); exportResults(); });
    bindIf('btn-save-results', 'click', (e)=>{ if(e) e.preventDefault(); saveResults(); });

    // 設定パネル内の実行ボタンに処理を紐付け
    const gAct = document.getElementById('settings-action-groups');
    if (gAct) {
      const btns = gAct.querySelectorAll('button, a[role="button"], a');
      if (btns[0]) btns[0].addEventListener('click', (e)=>{ if(e) e.preventDefault(); assignGroups(); });
    }
    const oAct = document.getElementById('settings-action-order');
    if (oAct) {
      const b = oAct.querySelector('button, a[role="button"], a');
      if (b) b.addEventListener('click', (e)=>{ if(e) e.preventDefault(); assignOrder(); });
    }
    const rAct = document.getElementById('settings-action-roles');
    if (rAct) {
      const b = rAct.querySelector('button, a[role="button"], a');
      if (b) b.addEventListener('click', (e)=>{ if(e) e.preventDefault(); assignRoles(); });
    }
  }

  // 履歴データをロードする関数（「続きからシャッフル」機能用）
  function loadHistory(historyArray) {
    if (Array.isArray(historyArray)) {
      shufflyHistory = historyArray;
      currentHistoryIndex = shufflyHistory.length - 1;

      // 【新】タイプ別履歴にもデータを復元
      // shufflyHistory（時系列）からhistoryData（タイプ別）を再構築
      historyData.groups = [];
      historyData.order = [];
      historyData.roles = [];

      historyArray.forEach(entry => {
        if (entry.type === 'groups') {
          historyData.groups.push({
            round: entry.round || historyData.groups.length + 1,
            timestamp: entry.timestamp,
            data: entry.data
          });
        } else if (entry.type === 'order') {
          historyData.order.push({
            round: entry.round || historyData.order.length + 1,
            timestamp: entry.timestamp,
            data: entry.data
          });
        } else if (entry.type === 'roles') {
          historyData.roles.push({
            round: entry.round || historyData.roles.length + 1,
            timestamp: entry.timestamp,
            data: entry.data
          });
        }
      });

      // 【新】currentRoundIndexを最新に設定
      currentRoundIndex.groups = historyData.groups.length > 0 ? historyData.groups.length - 1 : -1;
      currentRoundIndex.order = historyData.order.length > 0 ? historyData.order.length - 1 : -1;
      currentRoundIndex.roles = historyData.roles.length > 0 ? historyData.roles.length - 1 : -1;

      // 履歴データを読み込んだ後に、各回数表示を更新
      if (typeof updateOrderRoundDisplay === 'function') {
        updateOrderRoundDisplay();
      }
      if (typeof updateRolesRoundDisplay === 'function') {
        updateRolesRoundDisplay();
      }

      // 最新の履歴を表示する処理を追加
      if (shufflyHistory.length > 0) {
        // ステップ1: メンバーデータを復元（グループ履歴から）
        const groupsHistory = shufflyHistory.filter(e => e.type === 'groups' && e.data && e.data.membersRaw);

        if (groupsHistory.length > 0) {
          const latestGroups = groupsHistory[groupsHistory.length - 1];
          setRawAndRefreshDisplay(latestGroups.data.membersRaw);
          groupsAssigned = true;
        }

        // ステップ2: グループ分けのデータがあれば必ず表示を更新
        if (groupsHistory.length > 0) {
          showGroups();
          showStats();
        }

        // ステップ3: 最新の履歴エントリーのタイプに応じてタブを切り替え・表示を更新
        const latestEntry = shufflyHistory[shufflyHistory.length - 1];

        if (latestEntry) {
          if (latestEntry.type === 'groups' && latestEntry.data && latestEntry.data.membersRaw) {
            // グループ分けが最新の場合
            switchResultTab('groups');
          } else if (latestEntry.type === 'order' && latestEntry.data && latestEntry.data.result) {
            // 順番決めが最新の場合
            const result = latestEntry.data.result;
            const lines = result.map((name, idx) => `${idx+1}. ${name}`);
            const outputEl = document.getElementById('orderOutput');
            if (outputEl) {
              outputEl.value = lines.join("\n");
            }
            const orderJson = result.map((name, idx) => ({ name, order: idx+1 }));
            const jsonEl = document.getElementById('orderJsonInput');
            if (jsonEl) {
              jsonEl.value = JSON.stringify(orderJson);
            }
            switchResultTab('order');
          } else if (latestEntry.type === 'roles' && latestEntry.data && latestEntry.data.assignments) {
            // 役割分担が最新の場合
            const assignments = latestEntry.data.assignments;
            const displayLines = assignments.map(a => a.role ? `${a.name}: ${a.role}` : `${a.name}: `);
            const outputEl = document.getElementById('rolesOutput');
            if (outputEl) {
              outputEl.value = displayLines.join("\n");
            }
            switchResultTab('roles');
          }
        }
      }
    }
  }

  // ロードしたデータの表示を更新する関数（続きからシャッフル用）
  function refreshDisplayFromLoadedData() {
    // メンバー数表示を更新
    updateParticipantCount();

    // 履歴があれば最新の履歴を表示
    const histField = document.getElementById('historyJsonInput');
    if (histField && histField.value) {
      try {
        const history = JSON.parse(histField.value);
        if (Array.isArray(history) && history.length > 0) {
          // currentHistoryIndexを最新の履歴エントリーに設定
          currentHistoryIndex = shufflyHistory.length - 1;

          // ステップ1: メンバーデータを復元（グループ履歴から）- 表示はまだしない
          const groupsHistory = history.filter(e => e.type === 'groups' && e.data && e.data.membersRaw);
          if (groupsHistory.length > 0) {
            const latestGroups = groupsHistory[groupsHistory.length - 1];
            setRawAndRefreshDisplay(latestGroups.data.membersRaw);
            groupsAssigned = true;
          }

          // ステップ2: グループ分けのデータがあれば必ず表示を更新
          if (groupsHistory.length > 0) {
            showGroups();
            showStats();
          }

          // ステップ3: 最新の履歴エントリーのタイプに応じてタブを切り替え・表示を更新
          const latestEntry = history[history.length - 1];
          if (latestEntry) {
            if (latestEntry.type === 'groups' && latestEntry.data && latestEntry.data.membersRaw) {
              // グループ分けが最新の場合
              switchResultTab('groups');
            } else if (latestEntry.type === 'order' && latestEntry.data && latestEntry.data.result) {
              // 順番決めが最新の場合
              const result = latestEntry.data.result;
              const lines = result.map((name, idx) => `${idx+1}. ${name}`);
              const outputEl = document.getElementById('orderOutput');
              if (outputEl) {
                outputEl.value = lines.join("\n");
              }
              const orderJson = result.map((name, idx) => ({ name, order: idx+1 }));
              const jsonEl = document.getElementById('orderJsonInput');
              if (jsonEl) {
                jsonEl.value = JSON.stringify(orderJson);
              }
              switchResultTab('order');
            } else if (latestEntry.type === 'roles' && latestEntry.data && latestEntry.data.assignments) {
              // 役割分担が最新の場合
              const assignments = latestEntry.data.assignments;
              const displayLines = assignments.map(a => a.role ? `${a.name}: ${a.role}` : `${a.name}: `);
              const outputEl = document.getElementById('rolesOutput');
              if (outputEl) {
                outputEl.value = displayLines.join("\n");
              }
              switchResultTab('roles');
            }
          }
        } else {
          // 履歴がない場合、currentHistoryIndexを-1に設定
          currentHistoryIndex = -1;
        }
      } catch(e) {
        console.error('Failed to restore history display:', e);
      }
    }

    // 【新】正規化形式の場合、historyDataを使用して履歴を表示
    // historyJsonInputがない場合、または履歴がある場合でshufflyHistoryが空でない場合はhistoryDataを使用
    if ((!histField || !histField.value) && (shufflyHistory.length > 0 || historyData.groups.length > 0 || historyData.order.length > 0 || historyData.roles.length > 0)) {
      // グループ履歴から最新のメンバーデータを復元
      if (historyData.groups.length > 0) {
        const latestGroups = historyData.groups[historyData.groups.length - 1];
        if (latestGroups.data && latestGroups.data.membersRaw) {
          setRawAndRefreshDisplay(latestGroups.data.membersRaw);
          groupsAssigned = true;
          showGroups();
          showStats();
        }
      }

      // 最新の履歴エントリーのタイプに応じてタブを切り替え
      if (historyData.roles.length > 0) {
        switchResultTab('roles');
      } else if (historyData.order.length > 0) {
        // 順番決めの表示を更新
        const latestOrder = historyData.order[historyData.order.length - 1];
        if (latestOrder.data && latestOrder.data.result) {
          const result = latestOrder.data.result;
          const lines = result.map((name, idx) => `${idx+1}. ${name}`);
          const outputEl = document.getElementById('orderOutput');
          if (outputEl) {
            outputEl.value = lines.join("\n");
          }
          const orderJson = result.map((name, idx) => ({ name, order: idx+1 }));
          const jsonEl = document.getElementById('orderJsonInput');
          if (jsonEl) {
            jsonEl.value = JSON.stringify(orderJson);
          }
        }
        switchResultTab('order');
      } else if (historyData.groups.length > 0) {
        switchResultTab('groups');
      }
    }

    // 回次表示を更新（履歴がない場合は「未実施」が表示される）
    updateGroupRoundDisplay();
    updateOrderRoundDisplay();
    updateRolesRoundDisplay();

    // 設定データをUIに復元
    restoreSettingsUI();
  }

  // 設定データをUIに復元する関数
  function restoreSettingsUI() {
    const settingsField = document.getElementById('settingsJsonInput');
    if (!settingsField || !settingsField.value) return;

    try {
      const settings = JSON.parse(settingsField.value);
      if (!settings) return;

      // グループ数を復元
      if (settings.group_count) {
        const groupCountEl = document.getElementById('groupCount');
        if (groupCountEl) {
          groupCountEl.value = settings.group_count;
        }
      }

      // カスタムグループ名を復元
      if (settings.custom_group_names && Array.isArray(settings.custom_group_names) && settings.custom_group_names.length > 0) {
        const customNamesEl = document.getElementById('customGroupNames');
        if (customNamesEl) {
          customNamesEl.value = settings.custom_group_names.join('\n');
        }
      }

      // 役割名を復元（settings.rolesがある場合のみ）
      if (settings.roles && typeof settings.roles === 'string' && settings.roles.trim()) {
        const rolesEl = document.getElementById('rolesInput');
        if (rolesEl && !rolesEl.value) {
          // 既に値がない場合のみ設定（既存の設定を上書きしない）
          rolesEl.value = settings.roles;
        }
      }

      // settingsJsonInputを整理（role_assignmentsとrolesを保持）
      const cleanedSettings = {};
      if (settings.role_assignments) {
        cleanedSettings.role_assignments = settings.role_assignments;
      }
      if (settings.roles && typeof settings.roles === 'string' && settings.roles.trim()) {
        cleanedSettings.roles = settings.roles.trim();
      }
      if (settings.group_count) {
        cleanedSettings.group_count = settings.group_count;
      }
      if (settings.custom_group_names && Array.isArray(settings.custom_group_names) && settings.custom_group_names.length > 0) {
        cleanedSettings.custom_group_names = settings.custom_group_names;
      }

      // 設定がある場合のみ保存
      if (Object.keys(cleanedSettings).length > 0) {
        settingsField.value = JSON.stringify(cleanedSettings);
      } else {
        settingsField.value = '';
      }
    } catch(e) {
      console.error('Failed to restore settings UI:', e);
    }
  }

  // 公開API
  return {
    initialize,
    bindEvents,
    showToast,
    updateMemberCount: updateParticipantCount,
    loadHistory,
    refreshDisplayFromLoadedData
  };
})();

// Export for use in ERB
if (typeof window !== 'undefined') {
  window.ShufflyApp = ShufflyApp;
}

// JavaScriptの初期化（DOMContentLoaded時に自動実行）
document.addEventListener('DOMContentLoaded', () => {
  if (window.ShufflyApp) {
    // data属性から設定を読み取る
    const container = document.querySelector('[data-is-signed-in]');
    if (container) {
      const config = {
        isSignedIn: container.dataset.isSignedIn === 'true',
        iconExpand: container.dataset.iconExpand || '',
        iconCollapse: container.dataset.iconCollapse || '',
        newUserSessionPath: container.dataset.newUserSessionPath || '/users/sign_in'
      };
      window.ShufflyApp.initialize(config);
      window.ShufflyApp.bindEvents();

      // 「続きからシャッフル」機能：ロードされたイベントデータを反映
      if (container.dataset.loadEvent) {
        try {
          const loadedData = JSON.parse(container.dataset.loadEvent);

          if (loadedData) {
            // データバージョンを確認（2以上は正規化形式）
            const isNormalized = loadedData.data_version >= 2;

            // メンバーデータをロード
            if (isNormalized && loadedData.members_data) {
              // 正規化形式：members_dataから復元
              const membersRawEl = document.getElementById('membersRaw');
              if (membersRawEl) {
                const membersData = loadedData.members_data;
                const members = membersData.members || [];

                // メンバー名の配列を作成（履歴は後で追加）
                const membersText = members.map(m => m.name).join('\n');
                membersRawEl.value = membersText;

                const membersInputEl = document.getElementById('membersInput');
                if (membersInputEl) {
                  membersInputEl.value = membersText;
                }

                window.ShufflyApp.updateMemberCount();
              }
            } else if (loadedData.members_json) {
              // レガシー形式：members_jsonから復元
              const membersRawEl = document.getElementById('membersRaw');
              if (membersRawEl) {
                const members = JSON.parse(loadedData.members_json);
                const membersText = members.map(m => {
                  if (typeof m === 'object' && m.name) {
                    return m.name + (m.history || []).join('');
                  }
                  return m;
                }).join('\n');
                // Rawエリアには履歴付きの完全なデータを設定
                membersRawEl.value = membersText;
                // 表示エリアには履歴なしの名前のみを表示（formatEntryForDisplayを使用）
                const membersInputEl = document.getElementById('membersInput');
                if (membersInputEl) {
                  const displayNames = members.map(m => {
                    if (typeof m === 'object' && m.name) {
                      return m.name;
                    }
                    return m.split('#')[0].trim();
                  }).join('\n');
                  membersInputEl.value = displayNames;
                }
                // メンバー数表示を更新
                window.ShufflyApp.updateMemberCount();
              }
            }

            // 履歴データをロード
            if (isNormalized && (loadedData.group_rounds || loadedData.order_rounds || loadedData.role_rounds)) {
              // 正規化形式：group_rounds, order_rounds, role_roundsから履歴を復元
              const reconstructedHistory = [];

              // グループ履歴を復元
              if (loadedData.group_rounds && Array.isArray(loadedData.group_rounds)) {
                loadedData.group_rounds.forEach(round => {
                  // assignmentsまたはgroupsからmembersRawを再構築
                  let membersRaw = '';
                  const members = loadedData.members_data?.members || [];

                  if (round.groups) {
                    // groups形式の場合
                    const lines = [];
                    members.forEach(member => {
                      let groupId = null;
                      // このメンバーがどのグループに属しているか検索
                      for (const [gid, gMembers] of Object.entries(round.groups)) {
                        if (gMembers.includes(member.name) ||
                            (Array.isArray(gMembers) && gMembers.some(m =>
                              (typeof m === 'object' && m.name === member.name) || m === member.name
                            ))) {
                          groupId = gid;
                          break;
                        }
                      }
                      const history = groupId ? `#${round.round}${groupId}` : '';
                      lines.push(`${member.name}${history}`);
                    });
                    membersRaw = lines.join('\n');
                  } else if (round.assignments && Array.isArray(round.assignments)) {
                    // assignments形式の場合
                    const lines = [];
                    members.forEach(member => {
                      let groupId = null;
                      // このメンバーがどのグループに属しているか検索
                      for (const assignment of round.assignments) {
                        if (assignment.members && Array.isArray(assignment.members)) {
                          const found = assignment.members.some(m =>
                            (typeof m === 'object' && (m.member_id === member.id || m.name === member.name)) ||
                            m === member.name
                          );
                          if (found) {
                            groupId = assignment.group_id;
                            break;
                          }
                        }
                      }
                      const history = groupId ? `#${round.round}${groupId}` : '';
                      lines.push(`${member.name}${history}`);
                    });
                    membersRaw = lines.join('\n');
                  }

                  if (membersRaw) {
                    reconstructedHistory.push({
                      type: 'groups',
                      round: round.round,
                      timestamp: round.timestamp || Date.now(),
                      data: {
                        membersRaw: membersRaw,
                        settings: round.settings || {}
                      }
                    });
                  }
                });
              }

              // 順番履歴を復元
              if (loadedData.order_rounds && Array.isArray(loadedData.order_rounds)) {
                loadedData.order_rounds.forEach(round => {
                  let orderResult = [];
                  if (round.result && Array.isArray(round.result)) {
                    // result形式（名前の配列）
                    orderResult = round.result;
                  } else if (round.order && Array.isArray(round.order)) {
                    // order形式（{member_id, name}の配列）
                    orderResult = round.order.map(o =>
                      typeof o === 'object' ? (o.name || `メンバー${o.member_id}`) : o
                    );
                  }

                  if (orderResult.length > 0) {
                    reconstructedHistory.push({
                      type: 'order',
                      round: round.round,
                      timestamp: round.timestamp || Date.now(),
                      data: {
                        result: orderResult
                      }
                    });
                  }
                });
              }

              // 役割履歴を復元
              if (loadedData.role_rounds && Array.isArray(loadedData.role_rounds)) {
                loadedData.role_rounds.forEach(round => {
                  if (round.assignments && Array.isArray(round.assignments) && round.assignments.length > 0) {
                    const roleAssignments = round.assignments.map(a => ({
                      name: a.name || `メンバー${a.member_id}`,
                      role: a.role || ''
                    }));

                    reconstructedHistory.push({
                      type: 'roles',
                      round: round.round,
                      timestamp: round.timestamp || Date.now(),
                      data: {
                        assignments: roleAssignments
                      }
                    });
                  }
                });
              }

              // 履歴をロード
              if (reconstructedHistory.length > 0) {
                window.ShufflyApp.loadHistory(reconstructedHistory);
              }
            } else if (loadedData.history_json) {
              // レガシー形式：history_jsonから復元
              const historyJsonEl = document.getElementById('historyJsonInput');
              if (historyJsonEl) {
                historyJsonEl.value = loadedData.history_json;
              }
              window.ShufflyApp.loadHistory(JSON.parse(loadedData.history_json));
            }

            // グループ結果をロードして表示（正規化形式では履歴から自動復元）
            if (!isNormalized && loadedData.member_results_json) {
              const resultsJsonEl = document.getElementById('resultsJsonInput');
              if (resultsJsonEl) {
                resultsJsonEl.value = loadedData.member_results_json;
              }
            }

            // 順番結果をロードして表示
            if (!isNormalized && loadedData.member_order_json) {
              const orderJsonEl = document.getElementById('orderJsonInput');
              if (orderJsonEl) {
                orderJsonEl.value = loadedData.member_order_json;
                // 順番表示を更新
                const order = JSON.parse(loadedData.member_order_json);
                if (Array.isArray(order) && order.length > 0) {
                  const orderOutputEl = document.getElementById('orderOutput');
                  if (orderOutputEl) {
                    const lines = order.map((o, i) => `${i + 1}. ${o.name || o}`).join('\n');
                    orderOutputEl.value = lines;
                  }
                }
              }
            }

            // 役割結果をロードして表示
            if (!isNormalized && loadedData.setting_json) {
              const settingsJsonEl = document.getElementById('settingsJsonInput');
              if (settingsJsonEl) {
                settingsJsonEl.value = loadedData.setting_json;
                // 役割表示を更新
                const settings = JSON.parse(loadedData.setting_json);
                if (settings && settings.role_assignments && Array.isArray(settings.role_assignments)) {
                  const rolesOutputEl = document.getElementById('rolesOutput');
                  if (rolesOutputEl) {
                    const displayLines = settings.role_assignments.map(a => a.role ? `${a.name}: ${a.role}` : `${a.name}: `);
                    rolesOutputEl.value = displayLines.join('\n');
                  }
                }
              }
            }

            // メモをロードして表示
            if (loadedData.memo !== undefined && loadedData.memo !== null) {
              const memoTextarea = document.getElementById('memoText');
              if (memoTextarea) {
                memoTextarea.value = loadedData.memo;
              }
            }

            // タイトルは既にコントローラーで設定されているのでJSでは不要

            // 全データのロード後に表示を更新
            window.ShufflyApp.refreshDisplayFromLoadedData();

            // 更新モードの場合、フォームのactionを変更
            if (loadedData.original_id) {
              const form = document.querySelector('form[id^="edit_event"], form[action*="/events/"]');
              if (form) {
                // 既存のイベントを更新するURLに変更
                form.action = `/events/${loadedData.original_id}`;
                form.method = 'post'; // POSTメソッド（_method: patchで偽装）

                // _method: patch を追加
                let methodInput = form.querySelector('input[name="_method"]');
                if (!methodInput) {
                  methodInput = document.createElement('input');
                  methodInput.type = 'hidden';
                  methodInput.name = '_method';
                  methodInput.value = 'patch';
                  form.appendChild(methodInput);
                } else {
                  methodInput.value = 'patch';
                }

                // update_modeパラメータを追加
                let updateModeInput = form.querySelector('input[name="update_mode"]');
                if (!updateModeInput) {
                  updateModeInput = document.createElement('input');
                  updateModeInput.type = 'hidden';
                  updateModeInput.name = 'update_mode';
                  updateModeInput.value = 'true';
                  form.appendChild(updateModeInput);
                } else {
                  updateModeInput.value = 'true';
                }

                // 保存ボタンのテキストを変更
                const saveButton = form.querySelector('button[type="submit"], input[type="submit"]');
                if (saveButton) {
                  const originalText = saveButton.textContent || saveButton.value;
                  saveButton.textContent = '更新';
                  saveButton.dataset.originalText = originalText;
                }
              }
            }

            // トースト通知を表示
            window.ShufflyApp.showToast('イベントデータを読み込みました', 2000);
          }
        } catch (e) {
          console.error('Failed to load event data:', e);
        }
      }
    }
  }
});
