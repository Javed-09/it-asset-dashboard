# IT Asset Dashboard — Simple Setup

You have **3 files**:

| File | What it is |
|---|---|
| `index.html` | The website. You host this on GitHub. |
| `Code.gs` | The backend. You paste this into Google Apps Script. |
| `appsscript.json` | App config. You paste this into Google Apps Script. |

---

## Step 1: Set up the backend (Google Apps Script)

1. Go to https://script.google.com → sign in with your Google account.
2. Click **New Project**.
3. Click on `Code.gs` in the sidebar → delete everything → paste the contents of **`Code.gs`** from this folder.
4. Click the **gear ⚙️** at the top of the sidebar → check **"Show appsscript.json manifest file in editor"**.
5. Click on `appsscript.json` in the sidebar → delete everything → paste the contents of **`appsscript.json`** from this folder.
6. In the function dropdown at the top (says `doGet`), select **`setupDatabase`** → click **Run** (▶).
7. **Authorize**: Review permissions → your account → Advanced → "Go to Untitled project (unsafe)" → Allow.
8. **Deploy**: Click **Deploy** → **New deployment** → gear ⚙️ → **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** → authorize again if asked.
9. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/AKfycby.../exec`). You'll paste this in Step 2.

---

## Step 2: Set the backend URL in `index.html`

1. Open `index.html` in **Notepad**.
2. Press **Ctrl+F**, type `BACKEND_URL`, click Find Next.
3. You'll see this line (around line 31):
   ```js
   const BACKEND_URL = "";
   ```
4. Replace it with your URL from Step 1:
   ```js
   const BACKEND_URL = "https://script.google.com/macros/s/AKfycby.../exec";
   ```
5. **Save** the file (Ctrl+S).

---

## Step 3: Host on GitHub

1. Create a free account at https://github.com (if you don't have one).
2. Go to https://github.com/new.
   - Repository name: `it-asset-dashboard`
   - Set to **Public** (free hosting).
   - **Don't** check any "initialize" boxes.
   - Click **Create repository**.
3. On the new repo page, click **"uploading an existing file"**.
4. **Drag all 3 files** (`index.html`, `Code.gs`, `appsscript.json`, and this `SETUP.md`) into the drop zone.
5. Click **Commit changes** at the bottom.
6. Go to **Settings** → **Pages** (left sidebar).
7. Under **Source**: select **main** branch / **/(root)** → click **Save**.
8. Wait 1-2 minutes. Refresh the Pages page.
9. You'll see: **"Your site is live at https://YOURUSERNAME.github.io/it-asset-dashboard/"**.

Click that URL → your dashboard opens. Sign in with **admin / admin123**.

---

## Step 4: Change the password (important!)

1. Sign in with `admin / admin123`.
2. Click **Users** in the sidebar.
3. Click **Edit** next to `admin`.
4. Change the password to something strong.
5. Click **Update**.

Done. 🎉

---

## Quick reference

| What | Where |
|---|---|
| Website (after setup) | `https://YOURUSERNAME.github.io/it-asset-dashboard/` |
| Login | `admin / admin123` (change it!) |
| Backend code | https://script.google.com → your project |
| Database | Google Drive → `IT_Asset_Manager` spreadsheet |

---

## How to update later

**Frontend** (changed `index.html`): Go to your GitHub repo → click `index.html` → pencil icon → paste new content → Commit. Live in 1-2 min.

**Backend** (changed `Code.gs`): Apps Script editor → paste new content → Deploy → Manage deployments → Edit → Version: New version → Deploy.

**Data** (assets, branches, etc.): Sign in to the dashboard and edit. Or edit the Google Sheet directly.

---

## Troubleshooting

**Site shows 404 on GitHub Pages** — wait 5 minutes, or make sure repo is Public and file is named `index.html`.

**Login fails / blank page** — open browser DevTools (F12) → Console. Likely `BACKEND_URL` is wrong or Apps Script isn't deployed as "Anyone".

**Forgot admin password** — open the `IT_Asset_Manager` spreadsheet in Google Drive → `Users` tab → change the password cell back to `admin123` → save.

---

## Want a custom domain?

Instead of GitHub Pages, connect the repo to **Netlify**:
1. https://app.netlify.com → sign up with GitHub.
2. Add new site → Import from GitHub → pick your repo.
3. Deploy settings: leave all blank (just `index.html` at root).
4. Click Deploy. Live in seconds.
5. Site settings → Domain management → Add custom domain (e.g., `assets.mycompany.com`). Free HTTPS included.
