# Construire une release Windows

Prérequis : Python 3, Inno Setup 6.7.3 ou ultérieur, et un dossier complet XRN contenant le moteur NW.js 0.119.2, `XRNLauncher.exe`, les DLL et les ressources natives. Le dossier extrait d’une archive complète XRN publiée peut fournir ce runtime. Aucun compte, secret ou dossier de jeu ne doit être ajouté au dépôt.

Depuis la racine du dépôt :

```
python scripts/build-release.py --runtime "C:\Build\runtime-XRN" --runtime-version 0.119.2 --previous "C:\Build\version-precedente" --iscc "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

Les archives, le manifeste et `XRN-Setup.exe` sont produits dans `dist/`. `--previous` est facultatif : sans version précédente il n’y a pas de patch différentiel. Le setup pointe vers l’archive de la version indiquée dans `launcher/package.json` et contient son empreinte SHA-256. La release doit donc publier exactement l’archive utilisée à la compilation.

Pour une nouvelle version : modifier la version du launcher, reconstruire les JAR Fabric si nécessaire, mettre à jour `mods-integres/compatibility.json`, puis lancer le script avec le dossier de la version publique précédente. Préparer la release en brouillon, y joindre les fichiers de `dist/`, vérifier les tailles et empreintes et seulement ensuite publier la release.

Le site est statique et publié depuis la branche `main` par GitHub Pages. Son bouton utilise un téléchargement direct vers le setup de la release publiée ; un nom distinct permet de distinguer les révisions de l’installeur. Aucun identifiant GitHub ni secret Cloudflare n’est inclus dans la construction.

Pour une installation automatisée, le setup accepte `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /ACCEPTTERMS=1`. Cela suppose que l’opérateur ait lu et accepté les textes fournis. Les tests doivent utiliser une compilation `/DTestBuild`, un dossier séparé et des données de test. Ne testez pas une désinstallation sur le launcher principal.

Le setup n’est pas signé Authenticode ; une signature de publication nécessiterait un certificat de signature de code détenu par l’éditeur.

Le template Inno Setup ne doit pas être compilé directement. `build-installer.py` calcule l’empreinte de l’archive et crée un dossier de compilation neuf ; le fichier `*-build.json` lie le setup généré à cette archive. Pour reconstruire seulement le setup :

```
python scripts/build-installer.py --payload dist/XRNLauncher-win-x64.zip --iscc "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" --output dist
```
Avant publication, exécuter `python scripts/verify-release.py --directory dist`. Ce contrôle relie le setup, son compte rendu de compilation, les sources Inno Setup et l’archive complète. Ne pas remplacer une archive publiée sans reconstruire le setup correspondant. Tester ensuite un setup isolé avec le téléchargement HTTPS de la release.


## Signature Windows (préparée, certificat requis)

`--sign-cert-thumbprint EMPREINTE` active une signature Authenticode avec un certificat de signature de code déjà présent dans le magasin Windows de son titulaire. `--signtool CHEMIN` peut préciser le SignTool officiel du SDK Windows. Aucun mot de passe ni clé privée ne va dans le dépôt ou les arguments. Le launcher est signé après intégration de l’icône et avant création de l’archive ; le setup est signé avant calcul de ses empreintes finales. Une erreur de signature ou d’horodatage arrête la construction.

Le certificat doit autoriser la signature de code, posséder sa clé privée et une chaîne de confiance valide. Un certificat Office ou autosigné ne fournit pas la confiance publique nécessaire. Aucune signature de production n’a été créée sans certificat reconnu. La signature n’assure pas la disparition immédiate des alertes SmartScreen. Références Microsoft : [options de signature](https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options), [réputation SmartScreen](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation).
