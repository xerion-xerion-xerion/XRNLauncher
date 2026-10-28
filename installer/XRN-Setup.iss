#define AppVersion "4.9.1"
#include "payload.iss"
#ifndef SetupRevision
  #define SetupRevision "1"
#endif
#ifndef SetupBaseName
  #define SetupBaseName "XRN-Setup"
#endif
#ifndef PayloadUrl
  #define PayloadUrl "https://github.com/xerion-xerion-xerion/XRNLauncher/releases/download/v" + AppVersion + "/XRNLauncher-win-x64.zip"
#endif
#ifndef OutputFolder
  #define OutputFolder "..\release"
#endif

[Setup]
#ifdef TestBuild
AppId=XRNLauncher-Installer-Test
AppName=XRN Launcher — Test isolé
DefaultDirName={localappdata}\XRNLauncher-InstallerTest
OutputBaseFilename=XRN-Setup-Test
#else
AppId={{C3D9E180-C14C-42F3-B71C-7B217837F374}
AppName=XRN Launcher
DefaultDirName={localappdata}\XRNLauncher
OutputBaseFilename={#SetupBaseName}
#endif
AppVersion={#AppVersion}
AppVerName=XRN Launcher {#AppVersion}
AppPublisher=Xerion
AppPublisherURL=https://xerion-xerion-xerion.github.io/XRNLauncher/
AppSupportURL=https://xerion-xerion-xerion.github.io/XRNLauncher/confidentialite.html
AppUpdatesURL=https://xerion-xerion-xerion.github.io/XRNLauncher/
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
MinVersion=10.0
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
DefaultGroupName=XRN Launcher
UninstallDisplayIcon={app}\XRNLauncher.exe
UninstallDisplayName=XRN Launcher
LicenseFile=conditions.rtf
WizardStyle=modern dark
WizardImageFile=wizard.bmp
WizardSmallImageFile=wizard-small.bmp
WizardImageStretch=no
SetupIconFile=setup.ico
OutputDir={#OutputFolder}
Compression=lzma2
SolidCompression=yes
ArchiveExtraction=full
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
VersionInfoVersion={#AppVersion}.{#SetupRevision}
VersionInfoDescription=Installation de XRN Launcher
VersionInfoProductName=XRN Launcher
VersionInfoCompany=Xerion

[Languages]
Name: french; MessagesFile: compiler:Languages\French.isl

[Tasks]
Name: desktopicon; Description: Créer un raccourci sur le Bureau; GroupDescription: Raccourcis :; Flags: checkedonce

[Files]
Source: confidentialite.rtf; Flags: dontcopy
Source: "{tmp}\payload\XRNLauncher\*"; DestDir: "{app}"; ExternalSize: {#PayloadBytes}; Flags: external recursesubdirs createallsubdirs ignoreversion

[Icons]
#ifdef TestBuild
Name: "{app}\shortcuts\XRN Launcher"; Filename: "{app}\XRNLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assets\xrn-launcher-{#AppVersion}.ico"; Tasks: desktopicon
#else
Name: "{autodesktop}\XRN Launcher"; Filename: "{app}\XRNLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assets\xrn-launcher-{#AppVersion}.ico"; Tasks: desktopicon
Name: "{autoprograms}\XRN Launcher"; Filename: "{app}\XRNLauncher.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assets\xrn-launcher-{#AppVersion}.ico"
#endif

[Run]
Filename: "{app}\XRNLauncher.exe"; Description: Ouvrir XRN Launcher; Flags: nowait postinstall skipifsilent

[CustomMessages]
french.WelcomeLabel1=Bienvenue dans XRN Launcher
french.WelcomeLabel2=Cet assistant va installer XRN Launcher sur votre ordinateur.%n%nVous pourrez choisir votre version de Minecraft et retrouver vos mods et vos sauvegardes.%n%nUne connexion Internet est nécessaire pour télécharger les composants.
french.FinishedLabel=Installation terminée. Le launcher est prêt et vos données de jeu restent séparées de l’application.

[Code]
var
  PrivacyPage: TWizardPage;
  PrivacyRead: TNewCheckBox;
  PrivacyMemo: TRichEditViewer;
  DownloadPage: TDownloadWizardPage;
  ExtractionPage: TOutputProgressWizardPage;
  PayloadReady: Boolean;

function InitializeSetup: Boolean;
begin
  Result := True;
  if WizardSilent and (ExpandConstant('{param:ACCEPTTERMS|0}') <> '1') then begin
    Log('Installation silencieuse refusée : /ACCEPTTERMS=1 requis.');
    Result := False;
  end;
end;

procedure PrivacyChanged(Sender: TObject);
begin
  WizardForm.NextButton.Enabled := PrivacyRead.Checked;
end;

procedure InitializeWizard;
var Data: AnsiString;
begin
  WizardForm.WelcomeLabel1.Caption := CustomMessage('WelcomeLabel1');
  WizardForm.WelcomeLabel2.Caption := CustomMessage('WelcomeLabel2');
  WizardForm.FinishedLabel.Caption := CustomMessage('FinishedLabel');
  PrivacyPage := CreateCustomPage(wpLicense, 'Votre confidentialité', 'Les informations utilisées par XRN et vos moyens de contact.');
  PrivacyMemo := TRichEditViewer.Create(PrivacyPage);
  PrivacyMemo.Parent := PrivacyPage.Surface;
  PrivacyMemo.SetBounds(0, 0, PrivacyPage.SurfaceWidth, PrivacyPage.SurfaceHeight - ScaleY(34));
  PrivacyMemo.ReadOnly := True;
  PrivacyMemo.ScrollBars := ssVertical;
  PrivacyMemo.UseRichEdit := True;
  ExtractTemporaryFile('confidentialite.rtf');
  if LoadStringFromFile(ExpandConstant('{tmp}\confidentialite.rtf'), Data) then PrivacyMemo.RTFText := Data;
  PrivacyRead := TNewCheckBox.Create(PrivacyPage);
  PrivacyRead.Parent := PrivacyPage.Surface;
  PrivacyRead.SetBounds(0, PrivacyMemo.Height + ScaleY(10), PrivacyPage.SurfaceWidth, ScaleY(22));
  PrivacyRead.Caption := 'J’ai lu la politique de confidentialité de XRN.';
  PrivacyRead.Checked := WizardSilent and (ExpandConstant('{param:ACCEPTTERMS|0}') = '1');
  PrivacyRead.OnClick := @PrivacyChanged;
  DownloadPage := CreateDownloadPage('Téléchargement de XRN', 'Les fichiers sont vérifiés avant leur installation.', nil);
  DownloadPage.ShowBaseNameInsteadOfUrl := True;
  ExtractionPage := CreateOutputProgressPage('Préparation de XRN', 'Préparation des composants du launcher.');
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = PrivacyPage.ID then WizardForm.NextButton.Enabled := PrivacyRead.Checked;
  if CurPageID = wpInstalling then WizardForm.FilenameLabel.Visible := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := (CurPageID <> PrivacyPage.ID) or PrivacyRead.Checked;
end;

function ExtractionProgress(const ArchiveName, FileName: String; const Progress, ProgressMax: Int64): Boolean;
begin
  Result := True;
  if ProgressMax > 0 then ExtractionPage.SetProgress(Round(Progress * 1000.0 / ProgressMax), 1000);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if PayloadReady then exit;
  DownloadPage.Clear;
  DownloadPage.Add('{#PayloadUrl}', 'XRNLauncher-win-x64.zip', '{#PayloadHash}');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
    except
      Result := 'Téléchargement interrompu ou fichier non valide : ' + GetExceptionMessage;
    end;
  finally
    DownloadPage.Hide;
  end;
  if Result <> '' then exit;
  ExtractionPage.Show;
  try
    try
      ExtractArchive(ExpandConstant('{tmp}\XRNLauncher-win-x64.zip'), ExpandConstant('{tmp}\payload'), '', True, @ExtractionProgress);
      if not FileExists(ExpandConstant('{tmp}\payload\XRNLauncher\XRNLauncher.exe')) then RaiseException('Composants XRN incomplets.');
      PayloadReady := True;
    except
      Result := 'Préparation impossible : ' + GetExceptionMessage;
    end;
  finally
    ExtractionPage.Hide;
  end;
end;

