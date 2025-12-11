$lines = Get-Content "template/setting.html"
$lines[1359] = $lines[1359] -replace '<form class="app-form">', '<form class="app-form" id="profileForm">'
$lines[1366] = $lines[1366] -replace 'placeholder="Maria C. Eck"', 'id="inputUsername" placeholder="Maria C. Eck"'
$lines[1373] = $lines[1373] -replace 'placeholder="MariaCEck@teleworm.us"', 'id="inputEmail" placeholder="MariaCEck@teleworm.us"'
$lines[1381] = $lines[1381] -replace 'placeholder="\*\*\*\*\*\*\*"', 'id="inputPassword" placeholder="*******"'
$lines[1388] = $lines[1388] -replace 'placeholder="\*\*\*\*\*\*\*"', 'id="inputConfirmPassword" placeholder="*******"'
$lines[1399] = $lines[1399] -replace 'placeholder="1098 Asylum Avenu New Haven, CT 06510"', 'id="inputAddress" placeholder="1098 Asylum Avenu New Haven, CT 06510"'
$lines[1406] = $lines[1406] -replace 'placeholder="51244 Ankunding Villages, Reicheltown, IL 84366"', 'id="inputAddress2" placeholder="51244 Ankunding Villages, Reicheltown, IL 84366"'
$lines[1440] = $lines[1440] -replace 'class="select-langauge form-select select-basic"', 'id="inputLanguage" class="select-langauge form-select select-basic"'
$lines | Set-Content "template/setting.html"
Write-Host "Updated setting.html"
