# clip.ps1 <manifest> <action|reference|portrait>
# Saves the clipboard image (Gemini "Copy image") into the fighter's concept folder:
#   reference -> <conceptDir>/<reference>, anything else -> <conceptDir>/raw/<action>.png
# then clears the clipboard. Run from anywhere; paths are resolved from the repository root.
param([Parameter(Mandatory)][string]$Manifest, [Parameter(Mandatory)][string]$Action)
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$img = [System.Windows.Forms.Clipboard]::GetImage()
if (-not $img) { Write-Error "no image in clipboard (copy it in Gemini first; a dimmed image is still rendering)"; exit 1 }
$m = Get-Content (Join-Path $repo $Manifest) -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = Join-Path $repo $m.conceptDir
if ($Action -eq "reference") {
  New-Item -ItemType Directory -Force $dir | Out-Null
  $dest = Join-Path $dir $m.reference
} else {
  New-Item -ItemType Directory -Force (Join-Path $dir "raw") | Out-Null
  $dest = Join-Path $dir "raw\$Action.png"
}
$img.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
"saved clipboard $($img.Width)x$($img.Height) -> $dest"
[System.Windows.Forms.Clipboard]::Clear()
