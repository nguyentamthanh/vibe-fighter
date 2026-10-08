# grab.ps1 <manifest> <action>
# After clicking Gemini's "Download full size image": waits (up to 90 s) for the download to land, saves it into
# raw/<action>.png with dl.py (scaled to 1024 px, download deleted) and, for sheets, builds the action with
# take.py --no-move so the preview is ready to look at. Run from the repo root.
param(
  [Parameter(Mandatory = $true)][string]$Manifest,
  [Parameter(Mandatory = $true)][string]$Action
)

$python = '.venv\Scripts\python.exe'
$scripts = '.claude\skills\vibe-fighter-dev\scripts'
$downloads = Join-Path $env:USERPROFILE 'Downloads'
# Gemini's "Downloading full size..." can take over a minute when its servers are busy.
$deadline = (Get-Date).AddSeconds(90)

while ((Get-Date) -lt $deadline) {
  $fresh = Get-ChildItem (Join-Path $downloads 'Gemini_Generated_Image_*.png') -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddSeconds(-60) }
  if ($fresh) { break }
  Start-Sleep -Seconds 2
}
# The browser can still be writing the file when it first appears.
Start-Sleep -Seconds 2

& $python "$scripts\dl.py" $Manifest $Action
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($Action -notin @('reference', 'portrait')) {
  & $python "$scripts\take.py" $Manifest $Action --no-move
}
