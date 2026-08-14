[CmdletBinding()]
param(
  [string]$InfirmaryReference,
  [string]$RestorationReference
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot 'assets/source/ui-references'
$runtimeDir = Join-Path $repoRoot 'assets/ui/modals'
$infirmarySource = Join-Path $sourceDir 'infirmary-reference.png'
$restorationSource = Join-Path $sourceDir 'restoration-board-reference.png'

[System.IO.Directory]::CreateDirectory($sourceDir) | Out-Null
[System.IO.Directory]::CreateDirectory($runtimeDir) | Out-Null

function Save-SourceCopy([string]$InputPath, [string]$OutputPath) {
  if ([string]::IsNullOrWhiteSpace($InputPath)) {
    if (-not (Test-Path -LiteralPath $OutputPath)) {
      throw "Missing source reference: $OutputPath"
    }
    return
  }
  $resolved = (Resolve-Path -LiteralPath $InputPath).Path
  $source = [System.Drawing.Bitmap]::FromFile($resolved)
  try {
    $copy = New-Object System.Drawing.Bitmap($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($copy)
      try { $graphics.DrawImageUnscaled($source, 0, 0) } finally { $graphics.Dispose() }
      $copy.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $copy.Dispose() }
  } finally { $source.Dispose() }
}

function New-FramePath([System.Drawing.Point[]]$Points) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddPolygon($Points)
  return $path
}

function Fill-CleanContent(
  [System.Drawing.Graphics]$Graphics,
  [System.Drawing.Rectangle]$Bounds,
  [System.Drawing.Color]$BaseColor
) {
  $baseBrush = New-Object System.Drawing.SolidBrush($BaseColor)
  try { $Graphics.FillRectangle($baseBrush, $Bounds) } finally { $baseBrush.Dispose() }

  $darkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(42, 4, 19, 16), 1)
  $lightPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(24, 68, 102, 75), 1)
  try {
    for ($y = $Bounds.Top - 32; $y -lt $Bounds.Bottom + 32; $y += 32) {
      for ($x = $Bounds.Left - 32; $x -lt $Bounds.Right + 32; $x += 32) {
        $Graphics.DrawLine($darkPen, $x, $y + 16, $x + 16, $y)
        $Graphics.DrawLine($darkPen, $x + 16, $y, $x + 32, $y + 16)
        $Graphics.DrawLine($lightPen, $x, $y + 17, $x + 16, $y + 33)
        $Graphics.DrawLine($lightPen, $x + 16, $y + 33, $x + 32, $y + 17)
      }
    }
  } finally {
    $darkPen.Dispose()
    $lightPen.Dispose()
  }
}

function Build-Frame(
  [string]$SourcePath,
  [string]$OutputPath,
  [System.Drawing.Point[]]$Silhouette,
  [System.Drawing.Rectangle]$ContentBounds,
  [System.Drawing.Color]$ContentColor
) {
  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    if ($source.Width -ne 1448 -or $source.Height -ne 1086) {
      throw "Unexpected reference dimensions for $SourcePath. Expected 1448x1086, got $($source.Width)x$($source.Height)."
    }
    $output = New-Object System.Drawing.Bitmap($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($output)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $path = New-FramePath $Silhouette
        try {
          $graphics.SetClip($path)
          $graphics.DrawImageUnscaled($source, 0, 0)
          $graphics.ResetClip()
        } finally { $path.Dispose() }
        Fill-CleanContent $graphics $ContentBounds $ContentColor
      } finally { $graphics.Dispose() }
      $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $output.Dispose() }
  } finally { $source.Dispose() }
}

Save-SourceCopy $InfirmaryReference $infirmarySource
Save-SourceCopy $RestorationReference $restorationSource

$infirmarySilhouette = [System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(205, 125), [System.Drawing.Point]::new(390, 125),
  [System.Drawing.Point]::new(390, 95), [System.Drawing.Point]::new(575, 95),
  [System.Drawing.Point]::new(575, 55), [System.Drawing.Point]::new(870, 55),
  [System.Drawing.Point]::new(870, 88), [System.Drawing.Point]::new(1050, 88),
  [System.Drawing.Point]::new(1050, 120), [System.Drawing.Point]::new(1245, 120),
  [System.Drawing.Point]::new(1245, 160), [System.Drawing.Point]::new(1295, 160),
  [System.Drawing.Point]::new(1295, 955), [System.Drawing.Point]::new(1240, 955),
  [System.Drawing.Point]::new(1240, 1005), [System.Drawing.Point]::new(205, 1005),
  [System.Drawing.Point]::new(205, 970), [System.Drawing.Point]::new(150, 970),
  [System.Drawing.Point]::new(150, 165), [System.Drawing.Point]::new(205, 165)
)

$restorationSilhouette = [System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(150, 110), [System.Drawing.Point]::new(515, 110),
  [System.Drawing.Point]::new(515, 80), [System.Drawing.Point]::new(625, 80),
  [System.Drawing.Point]::new(625, 42), [System.Drawing.Point]::new(825, 42),
  [System.Drawing.Point]::new(825, 78), [System.Drawing.Point]::new(935, 78),
  [System.Drawing.Point]::new(935, 105), [System.Drawing.Point]::new(1285, 105),
  [System.Drawing.Point]::new(1285, 145), [System.Drawing.Point]::new(1320, 145),
  [System.Drawing.Point]::new(1320, 955), [System.Drawing.Point]::new(1285, 955),
  [System.Drawing.Point]::new(1285, 1005), [System.Drawing.Point]::new(150, 1005),
  [System.Drawing.Point]::new(150, 955), [System.Drawing.Point]::new(120, 955),
  [System.Drawing.Point]::new(120, 145), [System.Drawing.Point]::new(150, 145)
)

Build-Frame `
  $infirmarySource `
  (Join-Path $runtimeDir 'infirmary-frame.png') `
  $infirmarySilhouette `
  ([System.Drawing.Rectangle]::new(345, 245, 755, 650)) `
  ([System.Drawing.Color]::FromArgb(255, 18, 45, 36))

Build-Frame `
  $restorationSource `
  (Join-Path $runtimeDir 'restoration-board-frame.png') `
  $restorationSilhouette `
  ([System.Drawing.Rectangle]::new(330, 245, 790, 650)) `
  ([System.Drawing.Color]::FromArgb(255, 16, 43, 35))

Write-Output "Built frame-only modal assets in $runtimeDir"
