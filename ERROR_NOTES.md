# SHALIT AFIA Project - Setup & Troubleshooting Notes

## Project Status: ✅ SUCCESSFULLY RUNNING

**Date:** May 13, 2026  
**Project:** SHALIT AFIA - Clinic Management System  
**Local URL:** http://localhost:4173  
**Port:** 4173

---

## Issues Encountered & Solutions Implemented

### 1. **PowerShell Execution Policy Error**

**Error Message:**
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running 
scripts is disabled on this system. For more information, see 
about_Execution_Policies at https:/go.microsoft.com/fwlink/?LinkID=135170.
```

**Root Cause:**  
Windows PowerShell had execution policies disabled, preventing npm scripts from running directly.

**Solution Applied:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

This command temporarily sets the execution policy for the current PowerShell process only, allowing npm scripts to run without making permanent system-wide changes.

---

### 2. **Node Version Compatibility Warning**

**Warning Message:**
```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'vite_react_shadcn_ts@0.0.0',
npm warn EBADENGINE   required: { node: '22.x' },
npm warn EBADENGINE   current: { node: 'v24.11.1', npm: '11.6.2' }
}
```

**Analysis:**  
- **Required:** Node 22.x
- **Installed:** Node v24.11.1
- **Status:** Project works fine; newer Node version is compatible

**Action Taken:**  
No action needed. The application runs successfully with Node v24.11.1 (newer than required v22.x).

---

### 3. **npm Audit Vulnerabilities**

**Security Report:**
- **5 vulnerabilities found:** 3 low, 2 moderate
- **Packages scanned:** 495 packages
- **Status:** All critical functionality operational

**Note:**  
Dependencies are already installed from `package-lock.json`. Vulnerabilities are present but do not prevent local development.

---

## Steps Taken to Make It Work

### Step 1: Verify Dependencies ✅
- Checked `package.json` for project configuration
- Confirmed Node.js version requirements (22.x required)
- Verified npm is available

### Step 2: Set PowerShell Execution Policy ✅
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```
- Applied only to current terminal session (safe, non-permanent)
- Allows npm scripts to execute

### Step 3: Install Dependencies ✅
```
npm install
```
- Dependencies already in cache
- Completed: "audited 495 packages in 5s"
- No blocking errors

### Step 4: Start Development Server ✅
```
npm run dev
```
- Vite development server started
- **Server ready in:** 26,307 ms
- **Port:** 4173 (localhost)
- **Network access:** http://192.168.100.153:4173

### Step 5: Verify Application Loading ✅
- Navigated to http://localhost:4173
- Successfully loaded React application
- Verified page title: "SHALIT AFIA - Clinic Management System"
- Confirmed landing page renders with:
  - Navigation
  - "Get started" button
  - Marketing copy about clinic management
  - App root element populated with React components

### Step 6: Runtime Result and Notes ✅
- No fatal runtime errors occurred during startup
- The app loaded successfully in the browser
- Console warnings observed (non-blocking):
  - React Router future flag warnings about `v7_startTransition` and `v7_relativeSplatPath`
- These are warnings only and do not prevent the application from running

---

## Project Configuration Details

### Tech Stack
- **Framework:** React 18.x + TypeScript
- **Build Tool:** Vite 5.4.21
- **UI Library:** Shadcn/ui with Radix UI components
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form
- **State Management:** TanStack React Query
- **Database:** Supabase
- **Testing:** Vitest + Playwright
- **Linting:** ESLint

### Key Files
- `vite.config.ts` - Vite configuration (server runs on port 4173)
- `package.json` - Project dependencies and scripts
- `.env` - Environment variables (Supabase credentials, Gemini API)
- `tsconfig.json` - TypeScript configuration

### Environment Variables Loaded
- ✅ `VITE_SUPABASE_PROJECT_ID`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY`
- ✅ `VITE_SUPABASE_URL`
- ✅ `GEMINI_API_KEY`
- ✅ `VITE_GEMINI_MODEL`

---

## Current Running State

### Development Server
```
✓ Server Status: RUNNING
✓ Port: 4173
✓ URL: http://localhost:4173/
✓ Network: http://192.168.100.153:4173/
✓ Hot Module Reloading: ENABLED
✓ Build Tool: Vite v5.4.21
```

### Application
```
✓ React App: RENDERING
✓ Page Title: SHALIT AFIA - Clinic Management System
✓ Root Element: DOM mounted and populated
✓ Content: Landing page loading successfully
```

---

## How to Restart the Server

If you need to restart the development server:

```powershell
# In the project directory
cd "d:\4.3 NEW\4.2 NEW\LEVEL 4.2\LEVEL 3\shalit-afia-project-before"

# Set execution policy for current session
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# Start dev server
npm run dev
```

Then visit: **http://localhost:4173**

---

## Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (port 4173) |
| `npm run build` | Create production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm test:watch` | Watch mode testing |
| `npm preview` | Preview production build |

---

## Additional Notes

- **No Breaking Issues Found:** The application initializes and renders correctly
- **Hot Module Reloading:** Active - code changes will auto-refresh in browser
- **Database Connected:** Supabase credentials loaded from `.env`
- **API Endpoints:** Gemini AI API key configured
- **Development Ready:** Full developer experience enabled

---

## Final Status

🎉 **PROJECT IS FULLY OPERATIONAL AND READY FOR DEVELOPMENT**

All setup issues have been resolved. The SHALIT AFIA Clinic Management System is running locally and accessible at http://localhost:4173.

---

## Update: Errors Encountered During Inventory Search Fix (May 13, 2026)

### 4. **Vite Build Failure: `spawn EPERM`**

**Error Message:**
```
failed to load config from ...\vite.config.ts
error during build:
Error: spawn EPERM
```

**When It Happened:**  
Running `npm run build` inside the sandboxed terminal.

**Root Cause:**  
The sandbox environment blocked process spawning used by `esbuild` while Vite was loading/bundling config.

**Solution Applied:**  
Re-ran the exact same command with elevated permissions outside sandbox restrictions.

**Verification Result:**  
`npm run build` completed successfully after elevation and production assets were generated in `dist/`.

---

### 5. **Git Commands Blocked by Safe Directory Protection**

**Error Message:**
```
fatal: detected dubious ownership in repository at 'D:/4.3 NEW/.../shalit-afia-project-before'
... is on a file system that does not record ownership
```

**Symptoms Seen:**  
- `git diff -- src/pages/Drugs.tsx` returned repository-related failure output.
- `git rev-parse --show-toplevel` and `git status --short` failed with safe-directory warning.

**Root Cause:**  
Git safe-directory protection rejected this workspace path on the current filesystem.

**Recommended Fix (if git operations are needed):**
```powershell
git config --global --add safe.directory "D:/4.3 NEW/4.2 NEW/LEVEL 4.2/LEVEL 3/shalit-afia-project-before"
```

**Status:**  
Documented. Build verification and code patching proceeded without requiring git status/diff.

---

### 6. **Git Push Failed: GitHub Permission Denied (403)**

**Error Message:**
```text
remote: Permission to Jusper3038/shalit-afia-project-for-vercel.git denied to jusperotina-ASUMWA.
fatal: unable to access 'https://github.com/Jusper3038/shalit-afia-project-for-vercel.git/': The requested URL returned error: 403
```

**When It Happened:**  
Trying to push local commit `ee45167` to `origin/main` on May 13, 2026.

**Root Cause:**  
The currently authenticated GitHub identity does not have write access to this repository.

**Solution (Recommended):**
1. Confirm remote URL:
```powershell
git remote -v
```
2. Re-authenticate with the GitHub account that owns the repo (or has collaborator write access).  
   - In Git Credential Manager, sign out the wrong account and sign in with the correct one.
3. If using HTTPS token auth, use a PAT from the correct account with repo write permission.
4. Push again:
```powershell
git push origin main
```

**Optional Fast Check:**
```powershell
git config user.name
git config user.email
```
These should match the account expected to push to `Jusper3038/shalit-afia-project-for-vercel`.

**Status:**  
Local commit succeeded; remote push blocked only by account permissions.

