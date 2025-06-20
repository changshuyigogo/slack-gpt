const ALLOWED_USERS = [
  'U06CACLH4LU',
  'U069L1P6HDJ',
  'ULB8X2TFU',
  'U06NE138J31',
  'U06C7SGDK0S',
  'U05RSRKFSH2',
];

async function fetchGptWithTimeout(prompt, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    console.log('📤 使用 fetch 呼叫 GPT...');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const json = await res.json();
    console.log('✅ GPT 回傳 JSON：', json);
    return json.choices?.[0]?.message?.content || '⚠️ 沒有回應內容';
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error('❌ GPT 呼叫逾時');
      throw new Error('GPT 回覆逾時');
    } else {
      console.error('❌ GPT 呼叫錯誤', err);
      throw err;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📩 收到 Slack 請求 headers:', req.headers);
    console.log('📩 收到 Slack 請求 body:', req.body);

    const body = req.body || {};
    const text = body.text;
    const user_id = body.user_id;
    const response_url = body.response_url;

    console.log('🧾 解析結果:', { text, user_id, response_url });

    if (!text || !user_id || !response_url) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // ✅ 立即回應，避免 Slack timeout
    res.status(200).end();

    // 🔐 權限檢查
    if (!ALLOWED_USERS.includes(user_id)) {
      const denyMsg = {
        response_type: 'ephemeral',
        text: '❌ 你沒有使用這個指令的權限。',
      };
      const slackRes = await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(denyMsg),
      });
      console.log(
        '🔒 Slack 權限拒絕回應：',
        slackRes.status,
        await slackRes.text()
      );
      return;
    }

    // ✅ 呼叫 GPT
    let reply;
    try {
      reply = await fetchGptWithTimeout(text);
    } catch (err) {
      reply = `❌ GPT 回應失敗: ${err.message}`;
    }

    // ✅ 回 Slack
    const slackRes = await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: `💡 GPT 回覆：\n${reply}`,
      }),
    });

    console.log('📬 Slack 回傳結果：', slackRes.status, await slackRes.text());
  } catch (err) {
    console.error('❌ GPT webhook handler error:', err);
  }
}
