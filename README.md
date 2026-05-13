# SHALIT AFIA - Clinic Management System

A comprehensive clinic operating system for managing patients, pharmacy, payments, billing, and ecommerce operations. Built with React, TypeScript, Vite, and Supabase.

## Overview

**SHALIT AFIA** is a full-stack clinic management platform featuring:
- 🏥 Patient management and EHR
- 💊 Pharmacy inventory system
- 💰 Billing and payment processing
- 📊 Sales reporting and analytics
- 🛒 Integrated ecommerce storefront
- 👥 Team and user management
- 🔐 Role-based access control
- 📱 Mobile-responsive UI with Tailwind CSS & Shadcn/ui

## Quick Start

### Prerequisites
- Node.js 22.x or higher
- npm 11.x or higher

### Installation & Setup

1. **Install dependencies:**
```powershell
npm install
```

2. **Fix PowerShell Execution Policy (Windows):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

3. **Start the development server:**
```powershell
npm run dev
```

4. **Open the app in your browser:**
```
http://localhost:4173/
```

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 4173) |
| `npm run build` | Create production build |
| `npm run build:dev` | Build in development mode |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests once |
| `npm test:watch` | Run tests in watch mode |
| `npm preview` | Preview production build |

## Key Features & Recent Implementations

### ✅ Ecommerce Module Integration
- Ecommerce orders now automatically deduct from pharmacy stock
- Completed orders create transactions that appear on the main dashboard
- Integrated sales reporting shows both clinic and ecommerce revenue
- Products can be linked to pharmacy inventory items
- Prevents double-deduction with tracking timestamps (`stock_deducted_at`, `dashboard_recorded_at`)

### ✅ Dashboard Reporting
- **Combined Sales View:** Clinic Sales + Ecommerce Sales
- **Inventory Sync:** Stock updates across both channels
- **Transaction Recording:** All sales automatically appear in reports
- **Real-time Metrics:** Total Sales, Profit, Bills, Charts

### ✅ Access Control
- Protected routes for admin-only features
- Ecommerce module accessible via: `/ecommerce`
- Role-based permissions (admin, clinic owner, staff, patient)
- Release flags for feature toggles

## Project Structure

```
src/
├── components/          # React components
├── pages/               # Page components
├── contexts/            # React context (Auth)
├── hooks/               # Custom React hooks
├── integrations/        # Supabase integration
├── lib/                 # Utilities and helpers
└── test/                # Test files

supabase/
├── migrations/          # Database schema migrations
└── functions/           # Edge functions (mPesa, etc.)
```

## Technology Stack

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite 5.4.21
- **UI Framework:** Shadcn/ui + Radix UI
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form
- **State Management:** TanStack React Query
- **Database:** Supabase (PostgreSQL)
- **Testing:** Vitest + Playwright
- **Linting:** ESLint

## Environment Variables

Required environment variables (see `.env.example`):

```
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_key
VITE_SUPABASE_URL=https://your-project.supabase.co
GEMINI_API_KEY=your_gemini_key
VITE_GEMINI_MODEL=gemini-2.5-flash
```

## AI Chatbot & Ollama Setup

The clinical assistant chatbot can use either Gemini AI or Ollama for medical recommendations.

### Using Gemini (Cloud)
- `GEMINI_API_KEY` is configured in `.env`
- No additional setup needed for development
- Model: `gemini-2.5-flash`

### Using Ollama (Local/Private)

The app calls a server route at `/api/ollama`, which requires a public Ollama URL in `OLLAMA_BASE_URL`.

1. **Install Ollama:**
   Download from [ollama.ai](https://ollama.ai)

2. **Pull a medical model:**
```powershell
ollama pull llama3.1:8b
```

3. **Start Ollama locally:**
```powershell
ollama serve
```

4. **Expose with a public tunnel (Cloudflare Tunnel example):**
```powershell
cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"
```

5. **Add to Supabase/Vercel environment variables:**
   - `OLLAMA_BASE_URL=https://your-tunnel-url.trycloudflare.com`
   - `OLLAMA_MODEL=llama3.1:8b`

**Important Notes:**
- `OLLAMA_BASE_URL` belongs in server-side config, not the browser
- Do not use `localhost` URLs in production
- The tunnel forwards requests from the app to your local Ollama instance

## Database Migrations

Recent migrations have been applied:
- `20260513143000_complete_ecommerce_orders_into_dashboard.sql` - Ecommerce stock & transaction integration

To apply pending migrations:
```powershell
npx supabase migration up
```

## Troubleshooting

### PowerShell Execution Policy Error
**Error:** "npm.ps1 cannot be loaded because running scripts is disabled"

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

### Dev Server Not Starting
1. Verify Node.js version: `node --version` (requires 22.x+)
2. Clear node_modules: `rm -r node_modules package-lock.json`
3. Reinstall: `npm install`
4. Start again: `npm run dev`

### Ecommerce Module Not Accessible
- Ensure you're logged in as an admin user
- Verify ecommerce release is enabled in settings
- Check browser console for route errors
- Try direct URL: `http://localhost:4173/ecommerce`

### Stock Not Deducting After Order Completion
- Ensure Supabase migration has been applied to production database
- Check that ecommerce product is linked to a pharmacy item
- Verify order status is changed to "Completed"
- Check `stock_deducted_at` timestamp in database

## Build & Deployment

### Development Build
```powershell
npm run build:dev
```

### Production Build
```powershell
npm run build
```

Output will be in the `dist/` directory.

### TypeScript Checking
```powershell
npx tsc --noEmit
```

## Recent Changes

### Ecommerce Integration (v0.1.0)
- ✅ Stock deduction workflow on order completion
- ✅ Automatic transaction creation for dashboard visibility
- ✅ Pharmacy inventory linking
- ✅ Double-deduction prevention with timestamps
- ✅ All builds passing (TypeScript + Vite)

## Support & Documentation

For detailed setup and troubleshooting, see [ERROR_NOTES.md](./ERROR_NOTES.md)

For Ollama public access, see [docs/ollama-public-access.md](./docs/ollama-public-access.md)

## License

Private project - SHALIT AFIA Clinic Management System
