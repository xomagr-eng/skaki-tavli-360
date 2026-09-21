<#
  SXOLEIO 360 - simple local web server (no installs needed).
  Uses the built-in .NET HttpListener on Windows.
  Usage:   powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
  Stop:    Ctrl+C
  Note: keep this file ASCII-only (Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM).
#>
param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.webmanifest'='application/manifest+json; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg';
  '.gif'='image/gif'; '.ico'='image/x-icon'; '.txt'='text/plain; charset=utf-8';
  '.woff'='font/woff'; '.woff2'='font/woff2'; '.pdf'='application/pdf'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not start on port $Port. Try another: -Port 8090" -ForegroundColor Red
  throw
}

Write-Host ""
Write-Host "  SXOLEIO 360 - server running" -ForegroundColor Cyan
Write-Host "  Open:   $prefix" -ForegroundColor Green
Write-Host "  Folder: $root"
Write-Host "  (Ctrl+C to stop)"
Write-Host ""

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($rel -eq '/' -or [string]::IsNullOrWhiteSpace($rel)) { $rel = '/index.html' }
    $rel = $rel.TrimStart('/').Replace('/', '\')
    $full = Join-Path $root $rel
    # prevent directory traversal: the resolved path must stay inside root
    $fullResolved = [System.IO.Path]::GetFullPath($full)
    if (-not $fullResolved.StartsWith([System.IO.Path]::GetFullPath($root), [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403; $res.Close(); continue
    }
    if (Test-Path $fullResolved -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($fullResolved).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($fullResolved)
      $res.ContentType = $ct
      $res.Headers['Cache-Control'] = 'no-cache'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - Not found: $rel")
      $res.ContentType = 'text/plain; charset=utf-8'
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
$listener.Stop()
