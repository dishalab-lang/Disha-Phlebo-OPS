# Windows Self-Signed Code-Signing Certificate Generator
# For: Disha Diagnostics Phlebotomy Suite app packaging
# Instruction: Run this script inside a Windows PowerShell terminal with Administrator privileges to create and trust a certificate for MSIX/APPX testing.

$PublisherName = "CN=DishaDiagnosticsPhlebotomySuite, O=`"Disha Diagnostics Private Limited`", L=Bengaluru, S=Karnataka, C=IN"
$CertSubject = "CN=DishaDiagnosticsPhlebotomySuite"
$CertPath = "Cert:\LocalMachine\My"
$ExportPath = ".\DishaDiagnosticsPhlebotomy.pfx"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Creating Windows Code Signing Certificate for:" -ForegroundColor Yellow
Write-Host "  $PublisherName" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Create Self-Signed certificate in LocalMachine Personal Store
Write-Host "[1/3] Generating self-signed certificate..." -ForegroundColor Gray
$Cert = New-SelfSignedCertificate -Type Custom `
    -Subject $CertSubject `
    -KeySpec Signature `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature `
    -ExtendedKeyUsage "1.3.6.1.5.5.7.3.3" `
    -CertStoreLocation $CertPath `
    -NotAfter (Get-Date).AddYears(5)

# 2. Add signature to Trusted People & Trusted Root Authority to trust package locally without prompt errors
Write-Host "[2/3] Adding certificate to Local trusted stores..." -ForegroundColor Gray
$TrustedPeopleStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPeople", "LocalMachine")
$TrustedPeopleStore.Open("ReadWrite")
$TrustedPeopleStore.Add($Cert)
$TrustedPeopleStore.Close()

$RootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$RootStore.Open("ReadWrite")
$RootStore.Add($Cert)
$RootStore.Close()

# 3. Export certificate to a local PFX file with a blank password for automated build systems
Write-Host "[3/3] Exporting code-signing file to $ExportPath" -ForegroundColor Gray
$Password = ConvertTo-SecureString -String "" -Force -AsPlainText
$Cert | Export-PfxCertificate -FilePath $ExportPath -Password $Password

Write-Host ""
Write-Host "Success! Your Windows packaging certificate is ready to use." -ForegroundColor Green
Write-Host "PFX Exported To: $ExportPath" -ForegroundColor Green
Write-Host "Publisher String: '$PublisherName'" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
