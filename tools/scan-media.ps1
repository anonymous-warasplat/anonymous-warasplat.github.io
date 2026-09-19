<#
  扫描媒体目录，生成可直接粘贴进 assets/js/data.js 的 CASES 代码。

  用法：
    powershell -ExecutionPolicy Bypass -File tools/scan-media.ps1
    powershell -ExecutionPolicy Bypass -File tools/scan-media.ps1 -MediaRoot D:\data\demo_final

  默认扫描脚本上一级目录下的 demo_final（即项目里的媒体根目录）。
  命名规则：{天气目录}_{场景}_{强度}_{视角}{扩展名}，例如 Rain_RedHouse_heavy_view_low.mp4
#>
param(
  [string]$MediaRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'demo_final'),
  [string]$Ext = '.mp4'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $MediaRoot)) {
  Write-Host "找不到媒体目录：$MediaRoot" -ForegroundColor Red
  exit 1
}

Write-Host "扫描目录：$MediaRoot" -ForegroundColor Cyan
Write-Host ''

# 天气目录 → data.js 里的 weather id
$weatherMap = @{
  # 注意：PowerShell 的哈希表键不区分大小写，所以 SandStorm / Sandstorm 只写一个
  'Rain'      = 'rain'
  'Snow'      = 'snow'
  'Foggy'     = 'fog'
  'Fog'       = 'fog'
  'SandStorm' = 'sandstorm'
}

$inputRoot = Join-Path $MediaRoot 'input'
if (-not (Test-Path -LiteralPath $inputRoot)) {
  Write-Host "缺少 input 子目录，请确认目录结构：$inputRoot" -ForegroundColor Red
  exit 1
}

$files = Get-ChildItem -LiteralPath $inputRoot -Recurse -File -Filter "*$Ext" | Sort-Object FullName
if (-not $files) {
  Write-Host "input 目录下没有 *$Ext 文件。" -ForegroundColor Yellow
  exit 0
}

$rows = foreach ($f in $files) {
  $weatherFolder = Split-Path (Split-Path $f.FullName -Parent) -Leaf
  $parts = [System.IO.Path]::GetFileNameWithoutExtension($f.Name) -split '_'
  if ($parts.Count -lt 4) {
    Write-Host "跳过（命名不符合 {天气}_{场景}_{强度}_{视角}）：$($f.Name)" -ForegroundColor Yellow
    continue
  }
  [pscustomobject]@{
    Weather   = $weatherFolder
    Id        = if ($weatherMap.ContainsKey($weatherFolder)) { $weatherMap[$weatherFolder] } else { $weatherFolder.ToLower() }
    Scene     = $parts[1]
    Intensity = $parts[2]
    View      = ($parts[3..($parts.Count - 1)] -join '_')
  }
}

Write-Host '/* ===== 复制下面这段，替换 data.js 里的 CASES ===== */' -ForegroundColor Green
Write-Host 'const CASES = ['
$rows | Group-Object Id | ForEach-Object {
  Write-Host ("  // {0}" -f $_.Name)
  $_.Group | ForEach-Object {
    Write-Host ("  {{ weather: '{0}', scene: '{1}', intensity: '{2}', view: '{3}' }}," -f $_.Id, $_.Scene, $_.Intensity, $_.View)
  }
}
Write-Host '];'
Write-Host ''

# 覆盖度检查：每种方法在每类天气下的文件数
Write-Host '/* ===== 覆盖度检查（Part 2 的列是否齐全）===== */' -ForegroundColor Green
$compareRoot = Join-Path $MediaRoot 'compare'
if (Test-Path -LiteralPath $compareRoot) {
  $methods = Get-ChildItem -LiteralPath $compareRoot -Directory | Sort-Object Name
  $weatherFolders = ($rows | Group-Object Weather | Sort-Object Name).Name
  $header = 'Method'.PadRight(18) + ($weatherFolders | ForEach-Object { $_.PadLeft(12) }) -join ''
  Write-Host $header
  foreach ($m in $methods) {
    $line = $m.Name.PadRight(18)
    foreach ($w in $weatherFolders) {
      $dir = Join-Path (Join-Path $compareRoot $m.Name) $w
      $n = if (Test-Path -LiteralPath $dir) { (Get-ChildItem -LiteralPath $dir -File -Filter "*$Ext").Count } else { 0 }
      $line += ([string]$n).PadLeft(12)
    }
    $color = if ($line -match ' 0') { 'Yellow' } else { 'Gray' }
    Write-Host $line -ForegroundColor $color
  }
  Write-Host ''
  Write-Host '数字为 0 的方法/天气组合，页面上会显示「缺少资源」占位（例如当前的 WeatherGS）。' -ForegroundColor DarkGray
} else {
  Write-Host '没有 compare 子目录（Part 2 的对比方法目录），跳过覆盖度检查。' -ForegroundColor Yellow
}

Write-Host ''
Write-Host ('共 ' + $rows.Count + ' 个场景，' + ($rows | Group-Object Id).Count + ' 类天气。') -ForegroundColor Cyan
