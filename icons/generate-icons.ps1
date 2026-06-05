# Snapfile icon generator.
# Renders the brand mark (brand-blue rounded square + white down-arrow with a
# "PNG" label) from the master SVGs into the PNG sizes Chrome needs.
# Size-specific: 16/32 use mark-sm.svg (arrow only, text is unreadable that
# small); 48/128 use mark.svg (arrow + PNG). Run from anywhere:
#   powershell -NoProfile -File icons\generate-icons.ps1
$dir = $PSScriptRoot
if (-not $dir) { $dir = 'D:\Projects\snapfile\icons' }

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) {
  $chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}
if (-not (Test-Path $chrome)) { throw "Chrome not found. Set the chrome path manually." }

# size -> master svg
$jobs = @(
  @{ size = 16;  svg = 'mark-sm.svg' },
  @{ size = 32;  svg = 'mark-sm.svg' },
  @{ size = 48;  svg = 'mark.svg' },
  @{ size = 128; svg = 'mark.svg' }
)

foreach ($j in $jobs) {
  $S   = $j.size
  $svg = Join-Path $dir $j.svg
  $out = Join-Path $dir ("icon" + $S + ".png")
  $tmp = Join-Path $dir ("_render_" + $S + ".html")

  $svgUri = ([Uri](Resolve-Path $svg).Path).AbsoluteUri
  @"
<!doctype html><meta charset=utf-8><body style="margin:0">
<img src="$svgUri" style="width:${S}px;height:${S}px;display:block">
"@ | Out-File -FilePath $tmp -Encoding utf8

  $tmpUri = ([Uri]$tmp).AbsoluteUri
  & $chrome --headless --disable-gpu --virtual-time-budget=1500 `
    --default-background-color=00000000 --hide-scrollbars `
    --force-device-scale-factor=1 --window-size=$S,$S `
    --screenshot=$out $tmpUri 2>$null | Out-Null

  Remove-Item $tmp -ErrorAction SilentlyContinue
  if (Test-Path $out) { Write-Host "wrote $out" } else { Write-Host "FAILED $out" }
}
