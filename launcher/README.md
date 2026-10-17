# 🌌 XRNLauncher

Launcher Minecraft personnel pour Windows. Thème violet et noir.

Il télécharge Minecraft depuis les serveurs officiels de Mojang, gère vos
sauvegardes, vos fichiers et vos profils, puis lance le jeu. Rien n'est inventé :
tout ce qui s'affiche vient de votre ordinateur ou des API officielles de Mojang.

---

## Installation

1. Décompressez le fichier `.zip` où vous voulez — par exemple sur le Bureau.
2. Double-cliquez sur **`XRNLauncher.exe`**.

> ⚠️ Conservez **tout le dossier**. L'application a besoin de `nw.dll`,
> `locales\`, `resources.pak` et de ses libraries à côté d'elle.

Windows SmartScreen peut afficher un avertissement sur ce type de fichier :
cliquez sur **Plus d'informations → Exécuter quand même**. L'application n'est
pas signée numériquement.

Aucune installation de Node.js ou d'Electron n'est nécessaire.

---

## Première utilisation

### 1. Créer un profil

Onglet **Connexion** → choisis un pseudo → **Commencer**. Rien d'autre : aucun
compte, aucune inscription, aucun mot de passe. Tu joues en solo ou en LAN
dans la seconde.

Tes profils sont enregistrés sur ton ordinateur, dans
`%APPDATA%\XRNLauncher\profiles.json`. Tu peux en créer plusieurs et basculer
entre eux à tout moment.

> Les serveurs multijoueurs en ligne refuseront le mode hors-ligne : c'est le
> fonctionnement normal du mode hors-ligne de Minecraft, pas un défaut du launcher.

### 2. Télécharger Minecraft

Onglet **Versions** → choisis une version → **Installer**.
Le téléchargement se fait en parallèle, avec vérification SHA-1, et se met en
pause ou s'annule si le réseau coupe.

### 3. Jouer

Onglet **Versions** → **JOUER** (ou `Ctrl+Entrée`).

### 4. Ajouter des mods

Onglet **Mods**.

**Étape 1 — un chargeur de mods.** Minecraft vanilla ignore complètement le
dossier `mods` : sans chargeur, tes fichiers ne sont pas chargés. Depuis
l'onglet **Mods**, clique sur **Installer Fabric** ou **Installer NeoForge** pour
la version sélectionnée. L'application crée un profil (par exemple
`fabric-loader-0.19.5-1.20.4`) qui apparaît ensuite dans la liste des versions.

**Étape 2 — déposer tes mods.** Glisse tes fichiers `.jar` dans le cadre, ou
clique dessus pour les choisir. Ils sont copiés dans le dossier `mods` du jeu.

**Étape 3 — jouer avec.** Sélectionne le profil du chargeur (pas la version
d'origine) dans l'onglet **Versions**, puis **JOUER**.

> Le bouton **Lancer le jeu** de l'onglet Mods lance directement la version
> sélectionnée.

---

## Java

L'interface fonctionne sans Java, mais **le jeu en a besoin**.
L'application cherche Java automatiquement dans `JAVA_HOME`, `C:\Program Files\*`
et `%LOCALAPPDATA%\Programs\*`.

Si aucun JDK n'est trouvé, l'onglet **Paramètres** affiche un bouton pour
télécharger un JDK Temurin :

| Version de Minecraft | Java requis |
|---|---|
| 1.20.4 et antérieures | **JDK 17** |
| 1.20.5 et plus | **JDK 21** |

Tu peux aussi indiquer un chemin précis dans **Paramètres → Chemin de Java**.

---

## Tes fichiers

Tout est stocké dans `%APPDATA%\XRNLauncher\minecraft\` :

```
versions\     le jeu et ses natives
libraries\    dépendances (LWJGL, Fabric, Forge…)
assets\       textures et sons
saves\        tes mondes        ← glisses-y un .zip pour importer
resourcepacks\  mods\  config\  screenshots\  logs\
backups\      archives créées depuis l'interface
```

| Action | Où |
|---|---|
| Importer une sauvegarde | **Sauvegardes → Importer un .zip** |
| Sauvegarder une partie | carte du monde → bouton `.zip` |
| Parcourir / supprimer des fichiers | onglet **Fichiers** (limité au dossier du jeu) |
| Changer de dossier | **Paramètres → Dossier du jeu** |

L'onglet **Serveurs** teste les serveurs en direct (handshake, statut, ping) :
version, joueurs connectés, message du jour et latence sont réels.

---

## Vie privée

- Tout reste sur ton ordinateur. Rien n'est transmis à un serveur tiers.
- Connexion réseau uniquement vers les services officiels **Mojang**
  (versions, textures, bibliothèques) et YouTube pour les deux dernières vidéos.
- Aucun magasin, aucune monnaie, aucun compte pré-rempli.

---

## Problèmes courants

| Symptôme | Solution |
|---|---|
| « Java introuvable » | installe Temurin 17 ou 21 (voir tableau plus haut), ou renseigne le chemin dans Paramètres |
| Serveur affiché « hors ligne » | pare-feu, serveur éteint, ou proxy bloquant le port 25565 |
| Téléchargement bloqué | proxy d'entreprise : le launcher utilise HTTPS direct |
| Le jeu ne démarre pas | vérifie que `javaPath` est correct et que la version installée correspond |
| Fenêtre blanche au lancement | antivirus bloquant `nw.dll` — autorise le dossier |
| Les mods ne se chargent pas | tu dois lancer le **profil** du chargeur (Fabric/NeoForge), pas la version d'origine |
| « Impossible de vérifier le nom d'utilisateur » | normal en mode hors-ligne sur les versions antérieures à 1.13 |

---

© 2026 Xerion