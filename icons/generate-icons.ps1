# Snapfile icon generator.
# Brand-blue rounded square + white corner brackets ("select a region")
# + white down-arrow ("straight to your Downloads"). Run from anywhere:
#   powershell -NoProfile -File icons\generate-icons.ps1
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot
if (-not $dir) { $dir = 'D:\Projects\snapfile\icons' }

function RoundedRect([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

foreach ($S in 16,32,48,128) {
  $bmp = New-Object System.Drawing.Bitmap($S, $S)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # brand-blue rounded square background
  $m = $S * 0.06
  $bg = RoundedRect $m $m ($S - 2*$m) ($S - 2*$m) ($S * 0.24)
  $blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(43,140,255))
  $g.FillPath($blue, $bg)

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

  # corner brackets (pulled toward the edges to free the center)
  $Lx = $S * 0.24; $Ty = $S * 0.24; $Rx = $S * 0.76; $By = $S * 0.76
  $arm = $S * 0.15; $t = [Math]::Max(1.5, $S * 0.075)
  $g.FillRectangle($white, $Lx, $Ty, $arm, $t)
  $g.FillRectangle($white, $Lx, $Ty, $t, $arm)
  $g.FillRectangle($white, $Rx-$arm, $Ty, $arm, $t)
  $g.FillRectangle($white, $Rx-$t, $Ty, $t, $arm)
  $g.FillRectangle($white, $Lx, $By-$t, $arm, $t)
  $g.FillRectangle($white, $Lx, $By-$arm, $t, $arm)
  $g.FillRectangle($white, $Rx-$arm, $By-$t, $arm, $t)
  $g.FillRectangle($white, $Rx-$t, $By-$arm, $t, $arm)

  # down-arrow in the center: shaft + head
  $cx = $S * 0.5
  $g.FillRectangle($white, $cx - $S*0.055, $S*0.32, $S*0.11, $S*0.22)
  $head = New-Object 'System.Drawing.PointF[]' 3
  $head[0] = New-Object System.Drawing.PointF (($cx - $S*0.17), ($S*0.50))
  $head[1] = New-Object System.Drawing.PointF (($cx + $S*0.17), ($S*0.50))
  $head[2] = New-Object System.Drawing.PointF ($cx, ($S*0.72))
  $g.FillPolygon($white, $head)

  $g.Dispose()
  $out = Join-Path $dir ("icon" + $S + ".png")
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $out"
}
