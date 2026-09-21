
const express = require("express");
const crypto = require("crypto");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PORT = process.env.PORT || 10000;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

const REDIRECT_URI = `${BASE_URL}/auth/tiktok/callback`;

/*
 * TikTok user-authorized scopes used by this project.
 *
 * IMPORTANT:
 * TikTok must approve the corresponding scopes for your app.
 * A user must also authorize the scopes.
 */
const SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
  "video.publish",
  "video.upload"
];

const SCOPE = SCOPES.join(",");

/*
 * Temporary memory storage.
 *
 * This is suitable for a school/Sandbox demonstration.
 * A production application should use a database or secure
 * server-side session/token store.
 */
const oauthTests = new Map();


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeJson(value) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function requireConfiguration(res) {
  if (!TIKTOK_CLIENT_KEY) {
    res.status(500).json({
      error: "missing_client_key",
      message: "TIKTOK_CLIENT_KEY is not configured on Render."
    });
    return false;
  }

  if (!TIKTOK_CLIENT_SECRET) {
    res.status(500).json({
      error: "missing_client_secret",
      message: "TIKTOK_CLIENT_SECRET is not configured on Render."
    });
    return false;
  }

  if (!BASE_URL) {
    res.status(500).json({
      error: "missing_base_url",
      message: "BASE_URL is not configured on Render."
    });
    return false;
  }

  return true;
}

async function tiktokRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw_response: text
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

function getAccessTokenFromRequest(req) {
  /*
   * Token can be supplied in:
   *
   * Authorization: Bearer TOKEN
   *
   * or
   *
   * ?access_token=TOKEN
   *
   * For a real production application, prefer server-side
   * sessions instead of putting tokens into URLs.
   */

  const authorization = req.headers.authorization || "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.substring(7).trim();
  }

  if (req.body && req.body.access_token) {
    return req.body.access_token;
  }

  if (req.query && req.query.access_token) {
    return req.query.access_token;
  }

  return null;
}


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

  res.send(`
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>JONTEZ TikTok Developer Project</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: #0b0b0b;
  color: white;
}

nav {
  background: #151515;
  padding: 16px;
  text-align: center;
  position: sticky;
  top: 0;
}

nav a {
  color: white;
  text-decoration: none;
  margin: 5px 8px;
  display: inline-block;
}

nav a:hover {
  text-decoration: underline;
}

.container {
  max-width: 1100px;
  margin: auto;
  padding: 30px 20px;
}

.hero {
  text-align: center;
  padding: 45px 15px;
}

.hero h1 {
  font-size: 42px;
  margin-bottom: 10px;
}

.hero p {
  color: #bbb;
  line-height: 1.7;
}

.card {
  background: #1b1b1b;
  padding: 25px;
  border-radius: 15px;
  margin-top: 20px;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(230px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.feature {
  background: #222;
  padding: 22px;
  border-radius: 12px;
}

.feature h3 {
  margin-top: 0;
}

.button {
  display: inline-block;
  background: #fe2c55;
  color: white;
  text-decoration: none;
  padding: 14px 22px;
  border-radius: 9px;
  font-weight: bold;
  margin: 6px;
}

.button:hover {
  opacity: .85;
}

.green {
  background: #00a86b;
}

.blue {
  background: #2563eb;
}

.gray {
  background: #444;
}

.code {
  background: #000;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  word-break: break-all;
}

.badge {
  display: inline-block;
  padding: 7px 10px;
  margin: 4px;
  border-radius: 20px;
  background: #333;
  font-size: 13px;
}

footer {
  text-align: center;
  color: #888;
  padding: 40px;
}

</style>

</head>

<body>

<nav>

<a href="/">Home</a>
<a href="/dashboard">Dashboard</a>
<a href="/api/tiktok/profile">Profile API</a>
<a href="/api/tiktok/stats">Stats API</a>
<a href="/api/tiktok/videos">Videos API</a>
<a href="/privacy">Privacy</a>
<a href="/terms">Terms</a>

</nav>

<div class="container">

<section class="hero">

<h1>JONTEZ TikTok Developer Project</h1>

<p>
TikTok OAuth, profile, statistics, video display,
and Content Posting API research project.
</p>

<a class="button" href="/termux/start">
Start TikTok Authorization
</a>

</section>

<div class="card">

<h2>Application Status</h2>

<p>
Client Key:
<strong>
${TIKTOK_CLIENT_KEY ? "Configured" : "Missing"}
</strong>
</p>

<p>
Client Secret:
<strong>
${TIKTOK_CLIENT_SECRET ? "Configured" : "Missing"}
</strong>
</p>

<p>
Base URL:
</p>

<div class="code">
${escapeHtml(BASE_URL || "NOT CONFIGURED")}
</div>

<p>
Redirect URI:
</p>

<div class="code">
${escapeHtml(REDIRECT_URI)}
</div>

</div>


<div class="card">

<h2>Requested Scopes</h2>

${SCOPES.map(scope =>
  `<span class="badge">${escapeHtml(scope)}</span>`
).join("")}

</div>


<div class="grid">

<div class="feature">

<h3>🔐 Login Kit</h3>

<p>
OAuth authentication using TikTok accounts.
</p>

</div>

<div class="feature">

<h3>👤 User Info</h3>

<p>
Basic and extended TikTok profile information.
</p>

</div>

<div class="feature">

<h3>📊 Statistics</h3>

<p>
Follower, following, likes and public video statistics
when the required scope is authorized.
</p>

</div>

<div class="feature">

<h3>🎬 Video List</h3>

<p>
Retrieve metadata and unique IDs for public videos.
</p>

</div>

<div class="feature">

<h3>📤 Content Posting</h3>

<p>
Foundation for direct posting and upload workflows.
</p>

</div>

<div class="feature">

<h3>🧪 Sandbox</h3>

<p>
Designed for TikTok Developer Sandbox testing.
</p>

</div>

</div>

</div>

<footer>

JONTEZ TikTok Developer School Project © 2026

</footer>

</body>
</html>
  `);
});


// ======================================================
// HEALTH
// ======================================================

app.get("/health", (req, res) => {

  res.json({
    ok: true,
    service: "JONTEZ TikTok Developer Project",
    status: "running",
    port: PORT,
    base_url: BASE_URL,
    redirect_uri: REDIRECT_URI,
    scopes: SCOPES,
    client_key_configured: Boolean(TIKTOK_CLIENT_KEY),
    client_secret_configured: Boolean(TIKTOK_CLIENT_SECRET)
  });

});


// ======================================================
// OAUTH START
// ======================================================

app.get("/termux/start", (req, res) => {

  if (!requireConfiguration(res)) {
    return;
  }

  const state = crypto
    .randomBytes(32)
    .toString("hex");

  oauthTests.set(state, {
    createdAt: Date.now()
  });

  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state: state
  });

  const authorizationUrl =
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

  res.json({
    success: true,
    authorization_url: authorizationUrl,
    state,
    redirect_uri: REDIRECT_URI,
    scopes: SCOPES
  });

});


// ======================================================
// OAUTH CALLBACK
// ======================================================

app.get("/auth/tiktok/callback", async (req, res) => {

  const {
    code,
    state,
    error,
    error_description
  } = req.query;

  if (error) {

    return res.status(400).send(`
<!DOCTYPE html>
<html>
<body style="font-family:Arial;padding:30px">

<h1>TikTok Authorization Error</h1>

<p>
<strong>Error:</strong>
${escapeHtml(error)}
</p>

<p>
<strong>Description:</strong>
${escapeHtml(error_description || "")}
</p>

<a href="/">Return Home</a>

</body>
</html>
    `);

  }

  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  if (!state) {
    return res.status(400).send("Missing OAuth state.");
  }

  const test = oauthTests.get(state);

  if (!test) {

    return res.status(400).send(`
<h1>Invalid or expired OAuth state</h1>
<p>Please start the authorization process again.</p>
<a href="/">Return Home</a>
    `);

  }

  /*
   * Prevent state reuse.
   */
  oauthTests.delete(state);

  if (!requireConfiguration(res)) {
    return;
  }

  try {

    const tokenResult = await tiktokRequest(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          client_key: TIKTOK_CLIENT_KEY,
          client_secret: TIKTOK_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI
        })
      }
    );

    if (!tokenResult.ok) {

      return res.status(400).send(`
<!DOCTYPE html>
<html>

<body style="font-family:Arial;padding:30px">

<h1>Token Exchange Failed</h1>

<p>
HTTP status: ${tokenResult.status}
</p>

<pre style="
background:#111;
color:white;
padding:20px;
border-radius:10px;
overflow:auto;
">${safeJson(tokenResult.data)}</pre>

<a href="/">Try Again</a>

</body>
</html>
      `);

    }

    const tokenData = tokenResult.data;

    /*
     * Store the token temporarily.
     */
    oauthTests.set(state, {
      createdAt: Date.now(),
      tokenData
    });

    res.send(`
<!DOCTYPE html>

<html>

<head>

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>TikTok OAuth Success</title>

<style>

body {
  background:#111;
  color:white;
  font-family:Arial;
  padding:25px;
}

.card {
  max-width:900px;
  margin:auto;
  background:#1c1c1c;
  padding:30px;
  border-radius:15px;
}

pre {
  background:#000;
  padding:20px;
  border-radius:10px;
  overflow:auto;
  white-space:pre-wrap;
  word-break:break-word;
}

a {
  color:#4cff88;
}

.button {
  display:inline-block;
  background:#fe2c55;
  color:white;
  padding:12px 18px;
  border-radius:8px;
  text-decoration:none;
  margin:5px;
}

</style>

</head>

<body>

<div class="card">

<h1>✅ TikTok OAuth Successful</h1>

<p>
Authorization code successfully exchanged for tokens.
</p>

<h2>Granted Scopes</h2>

<p>
${escapeHtml(tokenData.scope || "Not returned")}
</p>

<h2>Open ID</h2>

<p>
${escapeHtml(tokenData.open_id || "Not returned")}
</p>

<p>
<strong>Security:</strong>
Do not share access or refresh tokens.
</p>

<a class="button"
href="/termux/access-token?state=${encodeURIComponent(state)}">
View Token Test
</a>

<a class="button"
href="/dashboard?state=${encodeURIComponent(state)}">
Open Dashboard
</a>

</div>

</body>
</html>
    `);

  } catch (err) {

    console.error(err);

    res.status(500).send(`
<h1>Server Error</h1>
<pre>${escapeHtml(err.message)}</pre>
<a href="/">Return Home</a>
    `);

  }

});


// ======================================================
// TEMPORARY TOKEN RESPONSE
// ======================================================

app.get("/termux/access-token", (req, res) => {

  const { state } = req.query;

  if (!state) {

    return res.status(400).json({
      error: "missing_state"
    });

  }

  const test = oauthTests.get(state);

  if (!test || !test.tokenData) {

    return res.status(404).json({
      error: "token_not_found",
      message:
        "The token has expired, been retrieved, or does not exist."
    });

  }

  /*
   * We deliberately do NOT return the refresh token here.
   */
  res.json({
    success: true,
    access_token:
      test.tokenData.access_token || null,
    open_id:
      test.tokenData.open_id || null,
    scope:
      test.tokenData.scope || null,
    expires_in:
      test.tokenData.expires_in || null,
    refresh_expires_in:
      test.tokenData.refresh_expires_in || null,
    token_type:
      test.tokenData.token_type || null
  });

});


// ======================================================
// DASHBOARD
// ======================================================

app.get("/dashboard", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>TikTok Dashboard</title>

<style>

body {
  margin:0;
  font-family:Arial;
  background:#f5f5f5;
  color:#222;
}

header {
  background:#111;
  color:white;
  padding:25px;
  text-align:center;
}

.container {
  max-width:1100px;
  margin:auto;
  padding:20px;
}

.card {
  background:white;
  padding:20px;
  margin:15px 0;
  border-radius:12px;
  box-shadow:0 2px 12px rgba(0,0,0,.08);
}

input {
  width:100%;
  padding:14px;
  box-sizing:border-box;
  border:1px solid #ccc;
  border-radius:8px;
  margin:10px 0;
}

button {
  background:#fe2c55;
  color:white;
  border:0;
  padding:13px 20px;
  border-radius:8px;
  cursor:pointer;
  margin:5px;
}

pre {
  background:#111;
  color:white;
  padding:15px;
  border-radius:8px;
  overflow:auto;
  white-space:pre-wrap;
  word-break:break-word;
}

</style>

</head>

<body>

<header>

<h1>JONTEZ TikTok Dashboard</h1>

<p>Display API + Content Posting API project</p>

</header>

<div class="container">

<div class="card">

<h2>Access Token</h2>

<p>
For testing, enter a fresh access token locally.
Do not publish it or commit it to GitHub.
</p>

<input
id="token"
type="password"
placeholder="Paste access token here"
>

<button onclick="loadProfile()">
Get Profile
</button>

<button onclick="loadStats()">
Get Statistics
</button>

<button onclick="loadVideos()">
List Videos
</button>

</div>

<div class="card">

<h2>API Response</h2>

<pre id="output">Waiting...</pre>

</div>

</div>

<script>

function getToken() {

  const token =
    document.getElementById("token").value.trim();

  if (!token) {

    alert("Enter an access token.");

    return null;

  }

  return token;

}

async function callApi(url) {

  const token = getToken();

  if (!token) return;

  const output =
    document.getElementById("output");

  output.textContent = "Loading...";

  try {

    const response = await fetch(url, {

      headers: {
        Authorization:
          "Bearer " + token
      }

    });

    const data = await response.json();

    output.textContent =
      JSON.stringify(data, null, 2);

  } catch (error) {

    output.textContent =
      JSON.stringify({
        error: error.message
      }, null, 2);

  }

}

function loadProfile() {

  callApi("/api/tiktok/profile");

}

function loadStats() {

  callApi("/api/tiktok/stats");

}

function loadVideos() {

  callApi("/api/tiktok/videos");

}

</script>

</body>

</html>
  `);

});


// ======================================================
// USER INFO / PROFILE
// ======================================================

app.get("/api/tiktok/profile", async (req, res) => {

  const accessToken =
    getAccessTokenFromRequest(req);

  if (!accessToken) {

    return res.status(401).json({
      error: "missing_access_token",
      message:
        "Send Authorization: Bearer YOUR_ACCESS_TOKEN"
    });

  }

  const fields = [
    "open_id",
    "union_id",
    "avatar_url",
    "display_name",
    "profile_deep_link",
    "bio_description",
    "is_verified",
    "username"
  ].join(",");

  const result = await tiktokRequest(
    `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`
      }
    }
  );

  res.status(result.status).json(result.data);

});


// ======================================================
// USER STATISTICS
// ======================================================

app.get("/api/tiktok/stats", async (req, res) => {

  const accessToken =
    getAccessTokenFromRequest(req);

  if (!accessToken) {

    return res.status(401).json({
      error: "missing_access_token"
    });

  }

  const fields = [
    "open_id",
    "display_name",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count"
  ].join(",");

  const result = await tiktokRequest(
    `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`
      }
    }
  );

  res.status(result.status).json(result.data);

});


// ======================================================
// LIST VIDEOS
// ======================================================

app.get("/api/tiktok/videos", async (req, res) => {

  const accessToken =
    getAccessTokenFromRequest(req);

  if (!accessToken) {

    return res.status(401).json({
      error: "missing_access_token"
    });

  }

  const maxCount =
    Math.min(
      Math.max(
        parseInt(req.query.max_count || "20", 10),
        1
      ),
      20
    );

  const cursor =
    req.query.cursor
      ? Number(req.query.cursor)
      : undefined;

  const body = {
    max_count: maxCount
  };

  if (cursor !== undefined) {
    body.cursor = cursor;
  }

  const result = await tiktokRequest(
    "https://open.tiktokapis.com/v2/video/list/",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(body)
    }
  );

  res.status(result.status).json(result.data);

});


// ======================================================
// QUERY SPECIFIC VIDEOS
// ======================================================

app.post("/api/tiktok/videos/query", async (req, res) => {

  const accessToken =
    getAccessTokenFromRequest(req);

  if (!accessToken) {

    return res.status(401).json({
      error: "missing_access_token"
    });

  }

  const videoIds =
    req.body.video_ids;

  if (
    !Array.isArray(videoIds) ||
    videoIds.length === 0
  ) {

    return res.status(400).json({
      error: "missing_video_ids",
      message:
        "Send video_ids as an array."
    });

  }

  const fields = [
    "id",
    "create_time",
    "cover_image_url",
    "share_url",
    "video_description",
    "duration",
    "height",
    "width",
    "title",
    "embed_html",
    "embed_link"
  ];

  const result = await tiktokRequest(
    "https://open.tiktokapis.com/v2/video/query/",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        filters: {
          video_ids: videoIds
        },
        fields
      })
    }
  );

  res.status(result.status).json(result.data);

});


// ======================================================
// CONTENT POSTING API STATUS
// ======================================================

app.post("/api/tiktok/publish/status", async (req, res) => {

  const accessToken =
    getAccessTokenFromRequest(req);

  if (!accessToken) {

    return res.status(401).json({
      error: "missing_access_token"
    });

  }

  const publishId =
    req.body.publish_id;

  if (!publishId) {

    return res.status(400).json({
      error: "missing_publish_id"
    });

  }

  const result = await tiktokRequest(
    "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        publish_id: publishId
      })
    }
  );

  res.status(result.status).json(result.data);

});


// ======================================================
// BASIC DIRECT POST INITIALIZATION
// ======================================================

app.post("/api/tiktok/publish/init", async (req, res) => {

  const accessToken =
    getAccessTokenFromRequest(req);

  if (!accessToken) {

    return res.status(401).json({
      error: "missing_access_token"
    });

  }

  /*
   * This endpoint intentionally validates the request and
   * forwards the basic Content Posting API initialization.
   *
   * Your TikTok Developer app must be approved for video.publish.
   */

  const body = req.body;

  const result = await tiktokRequest(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(body)
    }
  );

  res.status(result.status).json(result.data);

});


// ======================================================
// TERMS
// ======================================================

app.get("/terms", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html>

<head>

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>Terms of Service</title>

</head>

<body style="
font-family:Arial;
max-width:850px;
margin:40px auto;
padding:20px;
line-height:1.7;
">

<h1>Terms of Service</h1>

<p>
JONTEZ TikTok Developer Project is a school and technical
research project designed to demonstrate OAuth authentication,
TikTok profile data, public video display and Content Posting
API integration.
</p>

<h2>Authorized Access</h2>

<p>
Users authorize the application through TikTok's official
authorization process. The application does not request or
attempt to obtain TikTok passwords.
</p>

<h2>Tokens</h2>

<p>
Access tokens and refresh tokens are authentication credentials.
Users must not publicly disclose them.
</p>

<h2>Third-Party Services</h2>

<p>
TikTok services remain subject to TikTok's own terms, policies,
developer requirements and API limitations.
</p>

<h2>Educational Use</h2>

<p>
This project is intended for educational development,
testing and demonstration.
</p>

</body>

</html>
  `);

});


// ======================================================
// PRIVACY
// ======================================================

app.get("/privacy", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html>

<head>

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>Privacy Policy</title>

</head>

<body style="
font-family:Arial;
max-width:850px;
margin:40px auto;
padding:20px;
line-height:1.7;
">

<h1>Privacy Policy</h1>

<p>
JONTEZ TikTok Developer Project uses TikTok OAuth to allow
users to authorize access to permitted TikTok information.
</p>

<h2>Information</h2>

<p>
Depending on the scopes approved and authorized, the application
may receive profile information, account statistics, public video
metadata and information required for Content Posting API
operations.
</p>

<h2>OAuth Tokens</h2>

<p>
OAuth access and refresh tokens are sensitive credentials.
The application is designed to keep them on the server side
during the testing workflow.
</p>

<h2>Temporary Storage</h2>

<p>
This educational implementation uses temporary server memory
for OAuth testing. It is not intended to be a permanent
production credential store.
</p>

<h2>Third Parties</h2>

<p>
TikTok's own privacy policies and developer policies also apply
to TikTok services.
</p>

</body>

</html>
  `);

});


// ======================================================
// 404
// ======================================================

app.use((req, res) => {

  res.status(404).json({
    error: "not_found",
    path: req.path
  });

});


// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log("========================================");
  console.log("JONTEZ TIKTOK DEVELOPER PROJECT");
  console.log("========================================");

  console.log(`Port: ${PORT}`);

  console.log(
    `Base URL: ${BASE_URL || "NOT CONFIGURED"}`
  );

  console.log(
    `Client Key configured: ${Boolean(TIKTOK_CLIENT_KEY)}`
  );

  console.log(
    `Client Secret configured: ${Boolean(TIKTOK_CLIENT_SECRET)}`
  );

  console.log(
    `OAuth Redirect URI: ${REDIRECT_URI}`
  );

  console.log(
    `Scopes: ${SCOPE}`
  );

  console.log("========================================");

});
