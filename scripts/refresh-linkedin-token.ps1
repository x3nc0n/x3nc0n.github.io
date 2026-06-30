#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Refreshes the LinkedIn credentials used by the blog's auto-promotion Actions and
  stores them as GitHub repository secrets — without leaking anything to shell history.

.DESCRIPTION
  LinkedIn access tokens last ~60 days and refresh tokens ~365 days. When they lapse,
  the scheduled promotion workflow logs an auth error. Re-run this script to mint a
  fresh token and update the secrets in one guided pass.

  Security properties:
    * The client secret and all tokens are read with Read-Host -AsSecureString and
      held only as SecureString / in-memory plaintext for the minimum time needed.
    * Secret VALUES are sent to `gh secret set` via STDIN (piped), never as command
      arguments — so they never appear in your shell history or the process table.
    * Nothing is written to disk.

  Supports BOTH LinkedIn app types:
    * Apps that issue a refresh_token  -> stores LINKEDIN_REFRESH_TOKEN (+ client id/secret).
    * Apps that only issue access_token -> stores LINKEDIN_ACCESS_TOKEN.

.PARAMETER ClientId
  The LinkedIn app Client ID. Defaults to the known app for this blog.

.PARAMETER Repo
  The GitHub repo (owner/name) to set secrets on. Defaults to x3nc0n/x3nc0n.github.io.

.EXAMPLE
  pwsh ./scripts/refresh-linkedin-token.ps1
#>
[CmdletBinding()]
param(
  [string]$ClientId = '78ov4v3uxsjuxc',
  [string]$Repo     = 'x3nc0n/x3nc0n.github.io'
)

$ErrorActionPreference = 'Stop'
$RedirectUri = 'https://www.linkedin.com/developers/tools/oauth/redirect'

function ConvertFrom-SecureToPlain([System.Security.SecureString]$Secure) {
  # Marshal a SecureString to plaintext only for the brief moment we must send it.
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Set-GhSecret([string]$Name, [string]$Value) {
  # Pipe the value via STDIN so it never appears in args/history/process list.
  $Value | gh secret set $Name --repo $Repo
  if ($LASTEXITCODE -ne 0) { throw "gh secret set $Name failed (exit $LASTEXITCODE)" }
  Write-Host "  [OK] Set $Name" -ForegroundColor Green
}

# --- Preflight ----------------------------------------------------------------
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated. Run: gh auth login" }

Write-Host "LinkedIn credential refresh for $Repo" -ForegroundColor Cyan
Write-Host "App Client ID: $ClientId"
Write-Host ""

# --- Step 1: authorize in the browser ----------------------------------------
$scope   = 'w_member_social openid profile'
$authUrl = "https://www.linkedin.com/oauth/v2/authorization?response_type=code" +
           "&client_id=$ClientId" +
           "&redirect_uri=$([uri]::EscapeDataString($RedirectUri))" +
           "&scope=$([uri]::EscapeDataString($scope))" +
           "&state=spaiddev"

Write-Host "Step 1 - Opening LinkedIn authorization in your browser..." -ForegroundColor Yellow
Write-Host "Sign in with your PERSONAL LinkedIn account and approve."
Write-Host "If the browser does not open, paste this URL manually:`n$authUrl`n"
try { Start-Process $authUrl } catch { Write-Host "(could not auto-open a browser)" }

# --- Step 2: collect the authorization code -----------------------------------
Write-Host "Step 2 - After approving you'll land on a redirect URL containing '?code=...&state=...'."
Write-Host "Paste the WHOLE redirect URL (or just the code). LinkedIn codes expire in ~30s, so be prompt."
$pasted = Read-Host "Redirect URL or code"
if ($pasted -match 'code=([^&]+)') { $code = $matches[1] } else { $code = $pasted.Trim() }
if ([string]::IsNullOrWhiteSpace($code)) { throw "No authorization code captured." }

# --- Step 3: client secret (SecureString) -------------------------------------
$secureSecret = Read-Host "Step 3 - LinkedIn app Client Secret (input hidden)" -AsSecureString
$clientSecret = ConvertFrom-SecureToPlain $secureSecret

# --- Step 4: exchange code for tokens -----------------------------------------
Write-Host "Step 4 - Exchanging authorization code for tokens..." -ForegroundColor Yellow
$body = @{
  grant_type    = 'authorization_code'
  code          = $code
  redirect_uri  = $RedirectUri
  client_id     = $ClientId
  client_secret = $clientSecret
}
try {
  $tok = Invoke-RestMethod -Method Post -Uri 'https://www.linkedin.com/oauth/v2/accessToken' `
           -ContentType 'application/x-www-form-urlencoded' -Body $body
} catch {
  throw "Token exchange failed: $($_.Exception.Message). " +
        "If 'invalid_client', re-check the Client Secret. If the code expired, re-run to get a fresh one."
}

$accessToken  = $tok.access_token
$refreshToken = $tok.refresh_token
if (-not $accessToken) { throw "No access_token in the response." }

# --- Step 5: resolve person URN -----------------------------------------------
Write-Host "Step 5 - Resolving your LinkedIn person URN..." -ForegroundColor Yellow
$userinfo = Invoke-RestMethod -Method Get -Uri 'https://api.linkedin.com/v2/userinfo' `
              -Headers @{ Authorization = "Bearer $accessToken"; 'LinkedIn-Version' = '202506' }
$personUrn = "urn:li:person:$($userinfo.sub)"
Write-Host "  Resolved: $personUrn"

# --- Step 6: store secrets (via STDIN) ----------------------------------------
Write-Host "Step 6 - Writing GitHub repository secrets..." -ForegroundColor Yellow
Set-GhSecret 'LINKEDIN_CLIENT_ID'   $ClientId
Set-GhSecret 'LINKEDIN_PERSON_URN'  $personUrn

if ($refreshToken) {
  # Refresh-token flow: store refresh token + client secret; clear any stale static token.
  Set-GhSecret 'LINKEDIN_CLIENT_SECRET' $clientSecret
  Set-GhSecret 'LINKEDIN_REFRESH_TOKEN' $refreshToken
  Write-Host "  App issues refresh tokens - stored long-lived refresh credential (~365 days)." -ForegroundColor Green
} else {
  # Static-token flow: store the access token (lasts ~60 days).
  Set-GhSecret 'LINKEDIN_ACCESS_TOKEN' $accessToken
  Write-Host "  App issues only an access token (~60 days) - stored LINKEDIN_ACCESS_TOKEN." -ForegroundColor Yellow
  Write-Host "  Re-run this script before it expires to refresh." -ForegroundColor Yellow
}

# --- Cleanup in-memory plaintext ----------------------------------------------
$clientSecret = $null; $accessToken = $null; $refreshToken = $null
[System.GC]::Collect()

Write-Host "`nDone. Validate with a dry run:" -ForegroundColor Cyan
Write-Host "  Actions -> 'Promote to LinkedIn (Scheduled)' -> Run workflow -> Dry run = true"
