# PrÃ©sence vÃ©rifiÃ©e XRN

Ce service Cloudflare partage le badge et les couleurs de nom entre utilisateurs XRN authentifiÃ©s. Le launcher produit une preuve avec Minecraft Session Server, puis le relais vÃ©rifie cette preuve : aucun jeton Microsoft ou Minecraft n'est transmis Ã  Cloudflare. Un Durable Object SQLite consomme les challenges une seule fois et lie chaque session XRN Ã  un UUID vÃ©rifiÃ©. Les styles expirent aprÃ¨s 90 secondes sans heartbeat ; les sessions expirent aprÃ¨s une heure. Les donnÃ©es expirÃ©es et les compteurs de limitation sont purgÃ©s pÃ©riodiquement.

DÃ©ployer depuis ce dossier avec `npx wrangler deploy`. Le compte Cloudflare doit dÃ©jÃ  Ãªtre connectÃ©. Aucun abonnement ni achat n'est crÃ©Ã© par ce code. Configurer `presenceUrl` dans le launcher avec l'URL du worker et laisser les utilisateurs contrÃ´ler `shareAppearance` dans les paramÃ¨tres. Le launcher doit rester actif pendant le jeu pour entretenir la prÃ©sence. Un profil solo local ne peut pas publier une identitÃ© vÃ©rifiÃ©e.

Tests : `node test.mjs`. Ils couvrent deux joueurs, couleurs distinctes, isolation des sessions, course de rejeu, expiration, limitation des requÃªtes et taille des corps. Ils simulent la confirmation Minecraft ; un test rÃ©el entre deux comptes est nÃ©cessaire pour valider l'affichage sur un serveur donnÃ©.

Le catalogue actif est Modrinth. CurseForge est reporté à une version ultérieure et ne reçoit aucune requête de cette distribution.

## Annonces et identifiants techniques

Les notifications utilisent le worker historique `xrn-notifications`, distinct du relais de prÃ©sence. Un identifiant alÃ©atoire d'installation, la version XRN et la derniÃ¨re consultation permettent le ciblage. Il n'est associÃ© ni Ã  un mail ni Ã  un jeton de compte. Les utilisateurs peuvent dÃ©sactiver son partage et consulter/copier leur identifiant dans les paramÃ¨tres. Les annonces gÃ©nÃ©rales et les releases GitHub ne nÃ©cessitent aucun identifiant.

Le script administrateur `../../scripts/admin-notifications.cjs` accepte `list` ou `send message.json`. Configurer les variables d'environnement `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `XRN_INSTALLATIONS_NAMESPACE_ID` et `XRN_MESSAGES_NAMESPACE_ID` dans un environnement privÃ©. Le fichier de message contient `id`, `titre`, `texte`, Ã©ventuellement `version` pour renvoyer vers la mise Ã  jour GitHub, et `cible`, tableau des identifiants visÃ©s. La commande exige une cible explicite et n'envoie rien toute seule.

Une mise Ã  jour est distribuÃ©e par une release GitHub et les archives produites par `scripts/build-release.py`. Le manifeste vÃ©rifie les fichiers de la version prÃ©cÃ©dente avant de choisir le patch diffÃ©rentiel. Le tÃ©lÃ©chargement et l'application restent dÃ©clenchÃ©s par l'utilisateur.
