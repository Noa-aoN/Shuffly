document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('btn-save-pending');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        // LocalStorageからデータを取得
        const storedData = localStorage.getItem('pending_shuffly_event');
        if (!storedData) {
          alert('保存するデータが見つかりません');
          window.location.href = '/mypage';
          return;
        }

        const eventData = JSON.parse(storedData);

        // サーバーに送信
        const response = await fetch('/events/link_pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

          // リダイレクト（サーバーからのリダイレクトに従う）
          const data = await response.json();
          // JSONレスポンスでリダイレクト先が返ってくる場合
          if (data.redirect_url) {
            window.location.href = data.redirect_url;
          } else {
            // HTMLレスポンスの場合は既にリダイレクトされている
          }
        } else if (response.redirected) {
          // リダイレクトされた場合
          window.location.href = response.url;
        } else {
          alert('保存に失敗しました');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('エラーが発生しました');
      }
    });
  }
});
