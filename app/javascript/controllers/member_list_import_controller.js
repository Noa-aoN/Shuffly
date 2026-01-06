import { Controller } from "@hotwired/stimulus"

// メンバーリストインポート用Stimulusコントローラー
export default class extends Controller {
  static targets = ["modal", "methodModal", "container"]
  static values = {
    selectedListId: String,
    selectedMembers: Array
  }

  // メンバーリストモーダルを開く
  openModal(event) {
    if (event) event.preventDefault()
    this.modalTarget.classList.remove('hidden')
    this.modalTarget.classList.add('flex')
    document.body.style.overflow = 'hidden'
    this.loadMemberLists()
  }

  // メンバーリストモーダルを閉じる
  closeModal(event) {
    if (event) event.preventDefault()
    this.modalTarget.classList.add('hidden')
    this.modalTarget.classList.remove('flex')
    document.body.style.overflow = ''
  }

  // インポート方法モーダルを開く
  openMethodModal(listId) {
    this.selectedListIdValue = listId
    this.methodModalTarget.classList.remove('hidden')
    this.methodModalTarget.classList.add('flex')
  }

  // インポート方法モーダルを閉じる
  closeMethodModal(event) {
    if (event) event.preventDefault()
    this.methodModalTarget.classList.add('hidden')
    this.methodModalTarget.classList.remove('flex')
    this.selectedListIdValue = ''
  }

  // メンバーリストを読み込む
  async loadMemberLists() {
    const container = this.containerTarget

    try {
      const response = await fetch('/member_lists.json', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load')
      }

      const data = await response.json()

      if (data.length === 0) {
        container.innerHTML = `
          <div class="text-center text-gray-500 py-8">
            <p>メンバーリストがありません</p>
            <a href="/member_lists/new" class="text-blue-600 hover:underline mt-2 inline-block">
              新規作成 →
            </a>
          </div>
        `
        return
      }

      container.innerHTML = data.map(list => `
        <div class="member-list-item border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
             data-action="click->member-list-import#selectList"
             data-member-list-id="${list.id}">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900">${this.escapeHtml(list.name)}</h4>
              <p class="text-sm text-gray-600 mt-1">
                ${list.members_count}人 • ${list.created_at}
              </p>
            </div>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
          ${list.members.length > 0 ? `
            <div class="mt-2 text-xs text-gray-500">
              ${this.escapeHtml(list.members.slice(0, 3).join('、'))}
              ${list.members.length > 3 ? '...' : ''}
            </div>
          ` : ''}
        </div>
      `).join('')

    } catch (error) {
      console.error('Error loading member lists:', error)
      container.innerHTML = `
        <div class="text-center text-red-500 py-8">
          読み込みに失敗しました
        </div>
      `
    }
  }

  // メンバーリストを選択
  selectList(event) {
    const item = event.currentTarget
    const listId = item.dataset.memberListId
    this.openMethodModal(listId)
  }

  // 上書きインポート
  async importOverwrite(event) {
    if (event) event.preventDefault()
    await this.importMembers('overwrite')
  }

  // 追記インポート
  async importAppend(event) {
    if (event) event.preventDefault()
    await this.importMembers('append')
  }

  // メンバーをインポート
  async importMembers(method) {
    const listId = this.selectedListIdValue
    if (!listId) return

    try {
      const response = await fetch(`/member_lists/${listId}.json`)
      if (!response.ok) throw new Error('Failed to fetch member list')

      const data = await response.json()
      const membersInput = document.getElementById('membersInput')

      if (membersInput && data.members) {
        const currentText = membersInput.value.trim()
        const newMembers = data.members

        if (method === 'overwrite') {
          // 上書きモード
          membersInput.value = newMembers.join('\n')
        } else {
          // 追記モード
          const currentMembers = currentText ? currentText.split('\n').map(m => m.trim()).filter(m => m) : []
          const combinedMembers = [...currentMembers, ...newMembers]
          // 重複を除去
          const uniqueMembers = [...new Set(combinedMembers)]
          membersInput.value = uniqueMembers.join('\n')
        }

        // inputイベントを発火してメンバー数表示を更新
        membersInput.dispatchEvent(new Event('input', { bubbles: true }))

        this.closeMethodModal()
        this.closeModal()

        // 成功トーストを表示
        this.showToast(`${data.members_count}人のメンバーを${method === 'overwrite' ? '上書き' : '追記'}しました`)
      }
    } catch (error) {
      console.error('Error importing members:', error)
      this.showToast('インポートに失敗しました', 'error')
    }
  }

  // トーストを表示
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast')
    if (!toast) {
      const newToast = document.createElement('div')
      newToast.id = 'toast'
      newToast.className = 'fixed top-9 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg opacity-0 transition-opacity duration-300 z-50'
      newToast.style.top = '35px'
      document.body.appendChild(newToast)
    }

    const toastEl = document.getElementById('toast')
    toastEl.textContent = message
    toastEl.classList.remove('opacity-0')
    toastEl.style.zIndex = '1000'

    setTimeout(() => {
      toastEl.classList.add('opacity-0')
    }, 2000)
  }

  // HTMLをエスケープ
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
