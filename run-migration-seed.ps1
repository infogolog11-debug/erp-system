Start-Transcript -Path "e:\ERP system\full-output.log" -Force
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ERP System - Migration & Seed Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Set environment variables
Write-Host "[1/5] Setting environment variables..." -ForegroundColor Yellow
$env:DATABASE_URL     = "postgresql://postgres:U0kJOCYez4WnIoDw@db.txlcfxfuiphwicpduccc.supabase.co:5432/postgres?sslmode=require"
$env:SEED_ADMIN_EMAIL    = "admin@yourorg.com"
$env:SEED_ADMIN_PASSWORD = "2ANRMNTWNPeyXr8w39iZW3EU!1A"
$env:NODE_ENV         = "production"
$env:AUTH_SECRET      = "GIbjpeeN7i0iEBInnBXbarsPgxvVXjL4aLcnwrugnYU="
Write-Host "   DATABASE_URL set"
Write-Host "   NODE_ENV: $env:NODE_ENV"
Write-Host "   SEED_ADMIN_EMAIL: $env:SEED_ADMIN_EMAIL"
Write-Host "   OK"
Write-Host ""

# Step 2: Verify node_modules and install if needed
Write-Host "[2/5] Verifying node_modules..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules\pg\package.json")) {
    Write-Host "   node_modules incomplete. Running npm install..."
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Host "   npm install FAILED"; exit 1 }
    Write-Host "   npm install completed"
} else {
    Write-Host "   node_modules OK (pg exists)"
}

# Verify tsx exists, install if missing
if (-not (Test-Path "node_modules\tsx\package.json")) {
    Write-Host "   tsx not found. Installing tsx..."
    npm install --save-dev --no-audit --no-fund tsx
    Write-Host "   tsx installed"
} else {
    Write-Host "   tsx OK"
}
Write-Host ""

# Step 3: Run migrations
Write-Host "[3/5] Running migrations 001 -> 016..." -ForegroundColor Yellow
Write-Host ""

$tsxCmd = if (Test-Path "node_modules\.bin\tsx.cmd") {
    (Resolve-Path "node_modules\.bin\tsx.cmd").Path
} else {
    "npx --yes tsx"
}
Write-Host "   Using tsx: $tsxCmd"

& $tsxCmd "src\db\migrations\run-migrations.ts"
$migExitCode = $LASTEXITCODE
Write-Host ""

if ($migExitCode -ne 0) {
    Write-Host "   MIGRATIONS FAILED (exit code: $migExitCode)"
    Stop-Transcript
    exit 1
}

Write-Host "   Migrations phase completed successfully"
Write-Host ""

# Step 4: Run production seed
Write-Host "[4/5] Running production seed..." -ForegroundColor Yellow
Write-Host ""

& $tsxCmd "src\db\seed-production.ts"
$seedExitCode = $LASTEXITCODE
Write-Host ""

if ($seedExitCode -ne 0) {
    Write-Host "   SEED FAILED (exit code: $seedExitCode)"
    Stop-Transcript
    exit 1
}

Write-Host "   Seed phase completed successfully"
Write-Host ""

# Step 5: Summary
Write-Host "[5/5] Summary" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ALL TASKS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "   - Environment: production"
Write-Host "   - Migrations: 001 -> 016"
Write-Host "   - Seed: production data applied"
Write-Host "   - Admin email: admin@yourorg.com"
Write-Host "========================================" -ForegroundColor Cyan

Stop-Transcript
