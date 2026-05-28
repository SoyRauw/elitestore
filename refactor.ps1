$files = @("AdminProducts.jsx", "AdminCategories.jsx", "AdminDashboard.jsx", "AdminInventory.jsx", "AdminMovements.jsx")
foreach ($file in $files) {
  $path = "c:\Users\WINDOWS.DESKTOP-L9488DR\Documents\web mama\src\pages\admin\$file"
  $content = [System.IO.File]::ReadAllText($path)
  
  if ($content -notmatch "AdminLayout") {
    $content = $content -replace "import styles from '\./(.*?)\.module\.css'", "import AdminLayout from '../../components/admin/AdminLayout'`nimport styles from './`$1.module.css'"
    $content = $content -replace '(?s)<div className=\{styles\.page\}>\s*<aside className=\{styles\.sidebar\}>.*?</aside>\s*<main className=\{styles\.main\}>', '<AdminLayout>'
    $content = $content -replace '</main>', ''
    
    $content = $content -replace '</div>\s*\)\s*}', "</AdminLayout>`n  )`n}"
    
    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Updated $file"
  }
}
