/*
  JavaScript 部分：UI / データ変換 / 操作ロジック
  - 内部データは membersRaw（hidden textarea）に保持
  - 表示用は membersInput（ユーザ編集領域）
  - グループ割当・順番・役割はそれぞれ assignGroups / assignOrder / assignRoles
  - 表示切替は switchResultTab / switchSettingsTab
*/

// グローバル変数をモジュールパターンでカプセル化
const ShufflyApp = (function() {
  let shufflyHistory = [];
  let currentHistoryIndex = -1;
  let statsCollapsed = true; // 統計は初期折りたたみ
  let optionsCollapsed = true; // グループ表示オプションは初期折りたたみ（デフォルト閉じる）
  let groupsAssigned = false; // グループ分け実行が行われたかどうかのフラグ
  let IS_SIGNED_IN = false; // 初期化時に設定される

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

  function getCurrentRound(entries){
    let max=0;
    for(const e of entries) for(const h of e.history) {
      const m = h.match(/^#(\d+)/);
      if(m) max=Math.max(max, parseInt(m[1]));
    }
    return max+1;
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
    for(let i=0;i<shufflyHistory.length;i++){
      const v = shufflyHistory[i] || "";
      if(/#1[A-Z]/.test(v)) return i;
    }
    // 無ければ 0 を返し、従来の振る舞い（先頭まで戻れる）と互換性を保つ
    return 0;
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
  function formatEntryForDisplay(entry){
    const name = entry.split('#')[0].trim();
    const hist = entry.match(/#\d+[A-Z]/g) || [];
    const { idToName } = buildGroupIdsAndNames();
    const formattedHist = hist.map(h=>{
      const m=h.match(/^#(\d+)([A-Z])$/);
      if(m){
        const num=m[1], id=m[2];
        const gname = idToName[id] || id;
        return ` [ ${num}回目：${gname} ]`;
      }
      return h;
    }).join('');
    return `${name}${formattedHist}`;
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

    try{
      document.getElementById('membersJsonInput').value = JSON.stringify(entries);
      document.getElementById('resultsJsonInput').value = JSON.stringify({ groups: groups, group_names: buildGroupIdsAndNames().idToName });
      document.getElementById('settingsJsonInput').value = JSON.stringify({
        roles: document.getElementById('rolesInput').value,
        group_count: groupCount,
        custom_group_names: (document.getElementById('customGroupNames').value || "").split(/[\r\n,]+/).map(n=>n.trim()).filter(Boolean)
      });
    }catch(e){
      console.warn("JSON シリアライズ失敗:", e);
    }

    updateParticipantCount(); showGroups(); showStats(); pushToHistory();
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
      if(settingsField) settingsField.value = JSON.stringify(settings);
    } catch(e){
      const settingsField = document.getElementById('settingsJsonInput');
      if(settingsField) settingsField.value = JSON.stringify({ role_assignments: assignments.map(a=>({ name:a.name, role: a.role })) });
    }

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

    const showLabel=document.getElementById('showGroupLabel').checked;
    const showCount=document.getElementById('showGroupCount') ? document.getElementById('showGroupCount').checked : true;
    const breakMemberLine = document.getElementById('breakMemberLine') ? document.getElementById('breakMemberLine').checked : true;
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

    const groupSepVal = document.getElementById('groupSeparatorSelect') ? document.getElementById('groupSeparatorSelect').value : 'space';
    let groupSep = '\n\n';
    if(groupSepVal === 'none') groupSep = '\n';
    else if(groupSepVal === 'space') groupSep = '\n\n';
    else if(groupSepVal === 'line') groupSep = '\n────────\n';
    else if(groupSepVal === 'wave') groupSep = '\n〜〜〜〜〜〜〜\n';

    const parts = [];
    for(const id of groupIds){
      const members=groupMap[id];
      let total=0;
      const memberLines = [];
      for(const m of members){
        const mk=members.reduce((sum,other)=>sum+(m!==other?(coMap[m][other]||0):0),0);
        memberLines.push(`${m}：同グループ回数＝${mk}`);
        total+=mk;
      }
      const header = `${idToName[id] ? `グループ ${idToName[id]}` : `グループ ${id}`}（同グループ回数平均＝${members.length? (total/members.length).toFixed(2):0}）：`;
      const block = [header].concat(memberLines).join("\n");
      parts.push(block);
    }

    document.getElementById('statsOutput').value = parts.join(groupSep).trim();

    // 回次表示を更新
    updateGroupRoundDisplay();
  }

  // 新規: グループ分け回次を計算して表示するヘルパ
  function getDisplayRound(entries){
    let max = 0;
    let found = false;
    for(const e of entries){
      for(const h of e.history){
        const m = h.match(/^#(\d+)/);
        if(m){
          found = true;
          const num = parseInt(m[1],10);
          if(num > max) max = num;
        }
      }
    }
    return found ? max : null;
  }

  function updateGroupRoundDisplay(){
    const el = document.getElementById('groupRoundHint');
    if(!el) return;
    const raw = getRawValue().trim();
    const rawList = raw ? raw.split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean) : [];
    const entries = rawList.map(parseEntry);
    const round = getDisplayRound(entries);
    if(round === null){
      el.innerHTML = '現在のグループ分け表示：<span class="font-bold">未実施</span>';
    } else {
      el.innerHTML = `現在のグループ分け表示：<span class="font-bold">${round}回目</span>`;
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

  function pushToHistory(){
    const text = getRawValue();
    // 変更: 履歴が空で現在の raw が空文字列の場合は履歴に追加しない
    if (shufflyHistory.length === 0 && text.trim() === "") return;
    if(currentHistoryIndex>=0 && shufflyHistory[currentHistoryIndex]===text) return;
    shufflyHistory = shufflyHistory.slice(0,currentHistoryIndex+1);
    shufflyHistory.push(text);
    currentHistoryIndex++;
    const histField = document.getElementById('historyJsonInput');
    if(histField) histField.value=JSON.stringify(shufflyHistory);
  }

  function undoHistory(){
    const firstIndex = findFirstGroupHistoryIndex();
    // 1回目より前へは戻れない（安全策）
    if(currentHistoryIndex <= firstIndex){
      showToast("これ以上戻れません");
      return;
    }
    currentHistoryIndex--;
    const val = shufflyHistory[currentHistoryIndex];
    // もし new index が 1回目より前になってしまった場合の安全策（念のため）
    if(currentHistoryIndex < firstIndex){
      // グループ表示領域をクリア／非表示化する
      const gOut = document.getElementById('groupOutput');
      const sOut = document.getElementById('statsOutput');
      const gr = document.getElementById('groupRoundHint');
      if(gOut) gOut.value = "";
      if(sOut) sOut.value = "";
      if(gr) gr.textContent = ''; // 非表示にする安全策
      // 内部 raw は履歴値に戻すが、グループ表示は表示しない
      setRawAndRefreshDisplay(val || "");
      updateParticipantCount();
      showToast("1ステップ戻しました");
      switchResultTab('groups');
      return;
    }

    setRawAndRefreshDisplay(val);
    updateParticipantCount();
    showGroups();
    showStats();
    try{
      const entries = val ? val.split(/[\r\n,]+/).map(s=>parseEntry(s.trim())) : [];
      if(document.getElementById('membersJsonInput')) document.getElementById('membersJsonInput').value = JSON.stringify(entries);
    }catch(e){}
    showToast("1ステップ戻しました");
    switchResultTab('groups');
  }

  function redoHistory(){
    if(currentHistoryIndex<shufflyHistory.length-1){
      currentHistoryIndex++;
      const val = shufflyHistory[currentHistoryIndex];
      setRawAndRefreshDisplay(val);
      updateParticipantCount();
      showGroups();
      showStats();
      try{
        const entries = val ? val.split(/[\r\n,]+/).map(s=>parseEntry(s.trim())) : [];
        if(document.getElementById('membersJsonInput')) document.getElementById('membersJsonInput').value = JSON.stringify(entries);
      }catch(e){}
      showToast("1ステップ進めました");
      switchResultTab('groups');
    } else showToast("これ以上進めません");
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
    }
    if(name==='order'){
      const panel = document.getElementById('panel-order'); if(panel) panel.classList.remove('hidden');
      const el=document.getElementById('tab-order');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
    }
    if(name==='roles'){
      const panel = document.getElementById('panel-roles'); if(panel) panel.classList.remove('hidden');
      const el=document.getElementById('tab-roles');
      if(el){
        el.classList.remove('border-transparent','text-gray-600');
        el.classList.add('border-blue-500','text-blue-600','font-semibold','bg-blue-50','ring-1','ring-blue-100','shadow-sm');
      }
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
      if(document.getElementById('membersJsonInput')) document.getElementById('membersJsonInput').value = JSON.stringify(entries);
    }catch(e){}
    showToast("サンプルデータを入力しました");
  }
  /* --- end 追加 --- */

  function clearMemberHistories(){
    const confirmed = window.confirm("メンバーリストに含まれる全メンバーの履歴を一括で削除します。よろしいですか？");
    if(!confirmed) return;

    const cur = getRawValue() || "";
    const cleaned = cur.split(/[\r\n,]+/).map(s=>s.split('#')[0].trim()).filter(Boolean);
    setRawAndRefreshDisplay(cleaned.join("\n"));

    try{
      const entries = cleaned.map(s=>parseEntry(s));
      const mj = document.getElementById('membersJsonInput');
      if(mj) mj.value = JSON.stringify(entries);
    }catch(e){}

    // 履歴配列を再初期化して同期する（履歴をクリアしたら内部履歴も消す）
    if(cleaned.length === 0){
      shufflyHistory = [];
      currentHistoryIndex = -1;
    } else {
      const currentRaw = getRawValue().trim();
      shufflyHistory = [ currentRaw ];
      currentHistoryIndex = 0;
    }
    const histField = document.getElementById('historyJsonInput');
    if(histField) histField.value = shufflyHistory.length ? JSON.stringify(shufflyHistory) : "";

    // グループ表示は安全に非表示化（文言を消す）
    const gOut = document.getElementById('groupOutput');
    const sOut = document.getElementById('statsOutput');
    const gr = document.getElementById('groupRoundHint');
    if(gOut) gOut.value = "";
    if(sOut) sOut.value = "";
    if(gr) gr.textContent = '';

    updateParticipantCount();
    // pushToHistory() は不要（既に同期済み）
    showToast("履歴をクリアしました");
  }

  function togglePresentationMode(){
    try{
      const payload = {
        members_json: (()=>{ try { return JSON.parse(document.getElementById('membersJsonInput')?.value || '[]'); } catch(e){ return getRawValue() || ""; } })(),
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
      const membersRaw = getRawValue().trim().split(/[\r\n,]+/).map(s=>s.trim()).filter(Boolean);
      const entries = membersRaw.map(m=> parseEntry(m) );
      document.getElementById('membersJsonInput').value = JSON.stringify(entries);
    }catch(e){}

    if(!document.getElementById('resultsJsonInput').value){
      try { document.getElementById('resultsJsonInput').value = JSON.stringify({ groups: {}, group_names: {} }); } catch(e){}
    }
    if(!document.getElementById('settingsJsonInput').value){
      try {
        document.getElementById('settingsJsonInput').value = JSON.stringify({
          roles: document.getElementById('rolesInput') ? document.getElementById('rolesInput').value : '',
          group_count: (document.getElementById('groupCount') ? document.getElementById('groupCount').value : '')
        });
      } catch(e){}
    }
    if(!document.getElementById('orderJsonInput').value){
      try {
        const orderText = document.getElementById('orderOutput').value || '';
        const names = orderText.split(/\r?\n/).map(l=>l.replace(/^\d+\.\s*/,'')).filter(Boolean);
        document.getElementById('orderJsonInput').value = JSON.stringify(names.map((n,i)=>({name:n, order:i+1})));
      }catch(e){}
    }
    if(!document.getElementById('historyJsonInput').value){
      try{ document.getElementById('historyJsonInput').value=JSON.stringify(shufflyHistory); }catch(e){}
    }

    const titleField = document.getElementById('hiddenEventTitle');
    if(titleField) titleField.value = document.getElementById('shareEventTitle').value;

    const payloadPreview = {
      members_json: document.getElementById('membersJsonInput').value,
      results_json: document.getElementById('resultsJsonInput').value,
      order_json: document.getElementById('orderJsonInput').value,
      settings_json: document.getElementById('settingsJsonInput').value,
      history_json: document.getElementById('historyJsonInput').value,
      title: document.getElementById('hiddenEventTitle') ? document.getElementById('hiddenEventTitle').value : ''
    };

    if(IS_SIGNED_IN){
      const form = document.getElementById('saveForm');
      if(form) {
        form.submit();
      } else {
        showToast("フォームが見つかりません");
      }
    } else {
      try {
        try {
          localStorage.setItem('pending_shuffly_event', JSON.stringify(payloadPreview));
        } catch(storageError) {
          if (storageError.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded', storageError);
            showToast('ストレージ容量が不足しています');
            return;
          } else {
            throw storageError;
          }
        }
        const loginUrl = new_user_session_path + "?redirect_to=" + encodeURIComponent(window.location.href);
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
    const new_user_session_path = config.newUserSessionPath || '/users/sign_in';

    const histField = document.getElementById('historyJsonInput');
    if(histField && histField.value){
      try {
        shufflyHistory = JSON.parse(histField.value);
        currentHistoryIndex = shufflyHistory.length - 1;
        if (currentHistoryIndex >= 0) {
          const val = shufflyHistory[currentHistoryIndex];
          setRawAndRefreshDisplay(val);
        }
      } catch(e) {
        shufflyHistory=[]; currentHistoryIndex=-1;
      }
    } else {
      updateDisplayFromRaw();
    }
    updateParticipantCount();
    // 変更: 初回 push は現在の raw が空でない場合のみ行う（空状態を履歴に残さない）
    if(shufflyHistory.length === 0 && getRawValue().trim() !== "") pushToHistory();
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
          if(p.members_json) document.getElementById('membersJsonInput').value = p.members_json;
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
      pushToHistory();
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
    bindIf('showGroupLabel', 'change', ()=>{ if(groupsAssigned){ showGroups(); showStats(); } });
    bindIf('showGroupCount', 'change', ()=>{ if(groupsAssigned){ showGroups(); showStats(); } });
    bindIf('breakMemberLine', 'change', ()=>{ if(groupsAssigned) showGroups(); });
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

    // 結果の履歴移動
    bindIf('btn-prev-group', 'click', (e)=>{
      if(e) e.preventDefault();
      const firstIndex = findFirstGroupHistoryIndex();
      if(currentHistoryIndex <= firstIndex){
        showToast("これ以上戻れません");
        return;
      }
      undoHistory();
    });
    bindIf('btn-next-group', 'click', (e)=>{
      if(e) e.preventDefault();
      if(currentHistoryIndex >= shufflyHistory.length-1){
        showToast("これ以上進めません");
        return;
      }
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

  // 公開API
  return {
    initialize,
    bindEvents
  };
})();

// Export for use in ERB
if (typeof window !== 'undefined') {
  window.ShufflyApp = ShufflyApp;
}
