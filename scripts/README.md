# Construire une release Windows

Prérequis : Python 3, Inno Setup 6.7.3 ou ultérieur, et un dossier complet XRN contenant le moteur NW.js 0.119.2, `XRNLauncher.exe`, les DLL et les ressources natives. Le dossier extrait d’une archive complète XRN publiée peut fournir ce runtime. Aucun compte, secret ou dossier de jeu ne doit être ajouté au dépôt.

Depuis la racine du dépôt :

```
python scripts/build-release.py --runtime "C:\Build\runtime-XRN" --runtime-version 0.119.2 --previous "C:\Build\version-precedente" --iscc "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

Les archives, le manifeste et `XRN-Setup.exe` sont produits dans `dist/`. `--previous` est facultatif : sans version précédente il n’y a pas de patch différentiel. Le setup pointe vers l’archive de la version indiquée dans `launcher/package.json` et contient son empreinte SHA-256. La release doit donc publier exactement l’archive utilisée à la compilation.

Pour une nouvelle version : modifier la version du launcher, reconstruire les JAR Fabric si nécessaire, mettre à jour `mods-integres/compatibility.json`, puis lancer le script avec le dossier de la version publique précédente. Préparer la release en brouillon, y joindre les fichiers de `dist/`, vérifier les tailles et empreintes et seulement ensuite publier la release.

Le site est statique et publié depuis la branche `main` par GitHub Pages. Son bouton utilise le téléchargement direct `releases/latest/download/XRN-Setup.exe`. Aucun identifiant GitHub ni secret Cloudflare n’est inclus dans la construction.

Pour une installation automatisée, le setup accepte `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /ACCEPTTERMS=1`. Cela suppose que l’opérateur ait lu et accepté les textes fournis. Les tests doivent utiliser une compilation `/DTestBuild`, un dossier séparé et des données de test. Ne testez pas une désinstallation sur le launcher principal.

Le setup n’est pas signé Authenticode ; une signature de publication nécessiterait un certificat de signature de code détenu par l’éditeur.
