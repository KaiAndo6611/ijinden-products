const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const axios = require("axios");

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "asia-northeast1" });

exports.patreonCallback = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    // 1. Patreon にトークン交換リクエスト
    const tokenRes = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      new URLSearchParams({
        code,
        grant_type:    "authorization_code",
        client_id:     process.env.PATREON_CLIENT_ID,
        client_secret: process.env.PATREON_CLIENT_SECRET,
        redirect_uri:  process.env.PATREON_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token } = tokenRes.data;

    // 2. Patreon API でユーザー情報とメンバーシップを取得
    const userRes = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity" +
      "?include=memberships" +
      "&fields[user]=full_name,email" +
      "&fields[member]=patron_status,currently_entitled_amount_cents",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const user        = userRes.data.data;
    const memberships = (userRes.data.included ?? []).filter(Boolean);

    // 3. メンバーシップ確認
    // クリエイター（ホスト）アカウントは常に full access
    const creatorIds = (process.env.PATREON_CREATOR_IDS ?? "")
      .split(",").map(id => id.trim()).filter(Boolean);
    const isCreator = creatorIds.includes(user.id);

    // 何らかのメンバーシップがある（無料フォロー含む）
    const isMember = isCreator || memberships.some((m) => m.type === "member");
    // 課金中（active_patron かつ実際に課金している）or クリエイター
    const isActiveMember = isCreator || memberships.some(
      (m) =>
        m.type === "member" &&
        m.attributes?.patron_status === "active_patron" &&
        (m.attributes?.currently_entitled_amount_cents ?? 0) > 0
    );

    // 4. Firebase Custom Token を発行
    const userName  = user.attributes.full_name ?? "";
    const userEmail = user.attributes.email ?? "";

    const firebaseToken = await getAuth().createCustomToken(user.id, {
      name:  userName,
      email: userEmail,
      isMember,
      isActiveMember,
    });

    return res.json({
      firebaseToken,
      user: {
        name:  userName,
        email: userEmail,
        isMember,
        isActiveMember,
      },
    });

  } catch (err) {
    console.error(err.response?.data ?? err.message);
    return res.status(500).json({ error: "Authentication failed" });
  }
});
