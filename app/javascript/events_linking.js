document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('btn-save-pending');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        // トークンを取得
        const token = saveBtn.getAttribute('data-token');
        if (!token) {
          alert('トークンが見つかりません');
          window.location.href = '/mypage';
          return;
        }

        // LocalStorageからデータを取得（トークンで検証）
        const storedData = localStorage.getItem('pending_shuffly_event');
        const storedToken = localStorage.getItem('pending_shuffly_token');

        // トークンの一致を確認
        if (!storedData || !storedToken || storedToken !== token) {
          alert('データが見つかりません、または期限切れです。もう一度操作を行ってください。');
          // 不整合がある場合はLocalStorageをクリア
          localStorage.removeItem('pending_shuffly_event');
          localStorage.removeItem('pending_shuffly_token');
          window.location.href = '/mypage';
          return;
        }

        const eventData = JSON.parse(storedData);

        // サーバーに送信
        const response = await fetch('/events/link_pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
          },
          body: JSON.stringify({
            event: {
              title: eventData.title || '',
              memo: eventData.memo || '',
              data_version: eventData.data_version || 2,
              members_data: eventData.members_data || '{}',
              group_rounds: eventData.group_rounds || '[]',
              order_rounds: eventData.order_rounds || '[]',
              role_rounds: eventData.role_rounds || '[]',
              co_occurrence_cache: eventData.co_occurrence_cache || '{}'
            }
          })
        });

        if (response.ok) {
          // LocalStorageをクリア
          localStorage.removeItem('pending_shuffly_event');
          localStorage.removeItem('pending_shuffly_token');

          // リダイレクト（サーバーからのリダイレクトに従う）
          const data = await response.json();
          console.log('Server response:', data);
          console.log('Redirect URL:', data.redirect_url);

          // JSONレスポンスでリダイレクト先が返ってくる場合
          if (data.redirect_url) {
            // Turboの干渉を回避して確実に遷移
            window.location.replace(data.redirect_url);
          } else {
            // HTMLレスポンスの場合は既にリダイレクトされている
          }
        } else {
          // エラーレスポンスを解析
          const errorData = await response.json();
          const errorMessage = errorData.errors ? errorData.errors.join(', ') : '保存に失敗しました';
          alert('保存に失敗しました: ' + errorMessage);
        }
      } catch (error) {
        console.error('Error:', error);
        alert('エラーが発生しました');
      }
    });
  }
});
