## Nouveautés 4.10.0

- Version publique sans abonnement Prime. Boutique compacte et codes cadeaux espacés.
- Garde-robe en grille avec recherche, textures des capes et aperçu du personnage fixe.
- Langue français/anglais partagée entre le launcher et le menu XRN ; titres des capes traduits.
- Accès Personnaliser au bas du menu et couleurs d’accent cohérentes.
- Installation séparée des mods officiels compatibles avant le premier lancement Fabric : Essential, Sodium, Iris, Fabric API, Cloth Config API, FerriteCore et Mod Menu avec ses dépendances. Les fichiers manuels ou désactivés sont préservés.
- WaveyCapes : compatibilité avec l’installation personnelle séparée ; ni redistribution commerciale ni avantage payant.
- Ports du HUD vérifiés : Fabric 1.21.11, 26.1.2 et 26.2. Les autres versions 1.20.x/1.21.x/26.x nécessitent encore des ports ; aucun joker de compatibilité ne masque cette limite.

# XRN Launcher

Launcher Minecraft Java pour Windows, développé par Xerion. Interface violette, installations classiques et Fabric, gestion des mods, captures F2 et client au HUD personnalisable.

## Nouveautés 4.9.3

- Ciels XRN animés avec vitesse réglable, lueurs facultatives et arrêt de l’animation.
- Deux ambiances sonores originales : fond spatial et souffle de nuages ; volume réglable, son désactivé par défaut.
- Fullbright accessible dans les mods : éclairage du rendu sans potion artificielle ni modification du réglage de luminosité.
- Réglages conservés, shaders prioritaires et quatre nouvelles capes de la 4.9.2 incluses.

## Nouveautés 4.9.2

- Quatre nouvelles capes fixes à 1,99 € chacune : Éclipse, Rose blanche, Séraphine et Clair de lune.
- Garde-robe avec défilement fluide pour garder une collection lisible.
- Achats attribués au compte Minecraft après vérification serveur ; codes cadeaux utilisables pour l’une des nouvelles capes.

## Nouveautés 4.9.1

- Fenêtre du menu en jeu déplaçable par son en-tête, position mémorisée et recentrage disponible.
- Couleur du menu personnalisable ; dégradé du pseudo animé ou arc-en-ciel en option, partagé par le relais entre clients compatibles.
- Taille des objets par identifiant : réglages séparés en main et dans l’inventaire, raccourcis pour pommes dorées et épée de Netherite.
- Garde-robe dans la navigation latérale, roues dentées pour les réglages, textes des boutons recentrés et bouton XRN du menu Échap en violet.
- Textures des capes sur les élytres. Suppression de l’option « Cape souple ».
- Champs des codes cadeaux espacés, menus déroulants adaptés au thème, ouverture du dossier des mods corrigée et PvP HQ ajouté.

## Nouveautés 4.9.0

- Boutique avec aperçu 3D de votre skin : Job Application offerte, Singularité animée à 2,99 €, Scream, Spine et Crimson Knight à 1,99 € chacune.
- Paiement Stripe hébergé. Les droits sont attribués côté serveur au compte Minecraft après vérification du paiement, puis partagés entre clients compatibles.
- Code d’ami : une seule cape premium au choix, une seule utilisation globale. Les codes sont générés par le compte propriétaire vérifié, avec expiration et annulation avant utilisation.
- Rotation bornée, mouvement naturel des capes et correction des terminaux auxiliaires à l’ouverture.

## Nouveautés 4.8.2

- Logo Modrinth vectoriel à la place du texte dans le catalogue.

## Nouveautés 4.8.1

- Catalogue en liste avec icônes, auteurs, catégories, tri et pagination. Les identifiants de projet stables sont utilisés pour éviter les erreurs liées aux slugs.
- Motion Blur GPU : curseur d’intensité de 0 à 100 %, valeur sauvegardée, HUD conservé net. Désactivé par défaut ; suspendu automatiquement lorsqu’un shader Iris est actif.

## Nouveautés 4.8

- Free Look : maintenir V, raccourci configurable dans les contrôles Minecraft.
- Catalogue Modrinth : recherche pour la version et le chargeur sélectionnés, dépendances obligatoires, empreintes vérifiées avant installation. CurseForge est reporté.
- Badge et couleurs du pseudo entre utilisateurs : relais de présence vérifiée, réglage de partage, expiration des présences inactives. Les deux joueurs doivent utiliser cette version et une session Minecraft officielle ; le launcher maintient le relais pendant la partie.
- Identifiant technique d’installation consultable et copiable, annonces ciblables sans identifiant de compte Microsoft.

## Télécharger

**[Télécharger XRN-Setup.exe](https://github.com/xerion-xerion-xerion/XRNLauncher/releases/latest/download/XRN-Setup.exe)** — le setup s’occupe du téléchargement, de l’installation et des raccourcis. Aucun dossier à décompresser sur le Bureau.

[Site du projet](https://xerion-xerion-xerion.github.io/XRNLauncher/) · [Conditions](https://xerion-xerion-xerion.github.io/XRNLauncher/conditions.html) · [Confidentialité](https://xerion-xerion-xerion.github.io/XRNLauncher/confidentialite.html)

## Installation

1. Lancez le setup Windows 64 bits.
2. Lisez et acceptez les conditions, puis prenez connaissance de la politique de confidentialité.
3. Gardez le raccourci du Bureau si souhaité et cliquez sur Installer.
4. Connectez votre compte Microsoft possédant Minecraft Java, puis choisissez une installation.

Le setup est léger et télécharge les composants après vérification SHA-256. XRN s’installe pour votre compte Windows dans `%LOCALAPPDATA%\XRNLauncher`. Les données sont dans `%APPDATA%\XRNLauncher`, sauf dossier de jeu personnalisé. La désinstallation Windows conserve vos mondes et vos données.

L’exécutable du setup n’est pas signé Authenticode. Aucun certificat ni éditeur Windows vérifié n’est revendiqué.

## Client et compte

Le client intégré est fourni pour **Fabric 1.21.11 / Java 21** et **Fabric 26.2 / Java 25**. Le launcher permet d’autres versions, dont la 1.8, sans y charger un JAR XRN incompatible. Les autres mods doivent correspondre à leur version Minecraft.

La connexion utilise Microsoft, Xbox SISU et OAuth PKCE, puis vérifie le profil Minecraft réel. Les jetons enregistrés sont protégés par Windows DPAPI. Aucun compte connecté n’est remplacé automatiquement par un profil hors ligne en cas d’erreur.

## Mises à jour

Les releases contiennent le setup, l’archive complète, le noyau, un manifeste et, lorsque possible, un patch compatible avec la version précédente. Le launcher choisit un correctif quand les empreintes et le moteur correspondent ; sinon il utilise le noyau ou le paquet complet. Un premier téléchargement inclut le moteur nécessaire ; une petite modification ne demande pas systématiquement de le télécharger à nouveau.

## Sources et construction

- `launcher/` : application NW.js et modules intégrés.
- `client/hud/` et `client/hud-26.2/` : sources des deux versions Fabric.
- `installer/` : assistant Inno Setup, logo et textes affichés.
- `scripts/` : construction des archives, manifestes et setup.
- Le site statique est à la racine et publié par GitHub Pages.

Le moteur natif n’est pas stocké dans Git. Pour reconstruire, fournir un dossier de runtime XRN compatible et Inno Setup 6.7.3 ou ultérieur. Voir `scripts/README.md`. Les comptes, secrets et configurations propres au PC sont exclus du dépôt.

## Contact et licences

Contact du projet : **xrnlauncher@gmail.com**. Ne publiez ni mot de passe ni jeton dans une issue GitHub.

Le code et les créations originales XRN sont propriétaires : leur modification, leur remix et leur redistribution nécessitent l’autorisation écrite de Xerion. L’utilisation des versions officielles du launcher reste permise selon les conditions fournies avec l’application. Voir [LICENSE](LICENSE). Le projet n’est pas proposé sous une licence open source.

Cette politique ne retire pas les autorisations déjà accordées sur d’anciennes versions, notamment lorsqu’une licence MIT était applicable. Tant que le dépôt est public, les droits de consultation et de fork prévus par les conditions GitHub restent applicables.

XRN est indépendant de Mojang et Microsoft. Les licences des composants tiers sont conservées dans `launcher/legal/`. Les marques et ressources tierces restent la propriété de leurs titulaires et sont exclues de la licence propriétaire XRN.
