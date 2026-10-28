# Atelier 4.9 — travail local, publication fermée

Aucune release, mise à jour du launcher principal ou activation du nouveau relais en production sans demande de Xerion. Le launcher public reste en 4.8.2. Ce dossier décrit la version de travail 4.9.0-dev, avec client Fabric 1.46.0-dev pour 1.21.11 et 26.2.

## Identité et partage

Le flux précédent envoyait une preuve `join` à Minecraft puis demandait à Cloudflare de consulter `hasJoined`. Le PC obtenait HTTP 200, mais Cloudflare recevait HTTP 403. La nouvelle version n’utilise pas ces deux opérations pour sa présence.

Le launcher récupère auprès de Minecraft un certificat de signature et le profil public signé. Il signe un challenge du relais avec la clé privée du certificat. Le relais vérifie la signature Mojang liée à l’UUID et à l’expiration, la possession de la clé, le domaine destinataire, le challenge à usage unique et la signature du nom public. Les clés racines publiques sont embarquées depuis `https://api.minecraftservices.com/publickeys` (28 octobre 2026). Elles doivent être réactualisées lors d’une rotation officielle ; le serveur n’accepte aucune clé racine fournie par un client.

Le jeton Minecraft ne quitte le PC que pour contacter Minecraft. La clé privée du certificat reste en mémoire dans le launcher et n’est ni envoyée au relais ni enregistrée sur disque. Le relais conserve un hash du jeton de sa propre session, l’UUID, le nom public signé, les couleurs, le badge et la cape équipée. Les présences expirent après 90 secondes sans renouvellement. Les sessions expirent après une heure sans activité et ne dépassent jamais l’expiration du certificat.

Les droits sont conservés côté serveur sous `e:<UUID>`. La cape XRN est offerte ; les deux autres ne sont partagées que si le serveur accorde le droit. Modifier un fichier local ou ajouter un champ `rights` à une requête ne donne aucun droit sur le relais. Les futurs droits d’achat ne seront pas nettoyés avec les présences temporaires.

## Affichage Minecraft

Les capes distantes sont résolues par UUID, comme les badges et les couleurs. Le mixin de cape est désormais enregistré sur les deux versions. Les chemins de droits et la lecture de la garde-robe sont corrigés. Changer de cape depuis le launcher est relu pendant la partie sans réécrire la configuration du HUD. Les animations utilisent 64 textures pré-calculées de 256×128 et une cadence de 80 ms, sans décodeur GIF dans la boucle de rendu. Une texture n’est chargée que lorsqu’elle est utilisée.

## Collection et paiements

- **XRN** : dessin original créé pour le projet, cape fixe offerte.
- **Orbite** : aperçu animé à partir de deux trous noirs en rotation.
- **Nova** : aperçu animé d’une explosion stellaire.

Les deux GIF sources viennent de NASA SVS et sont crédités dans `launcher/legal/cosmetics-sources.txt`. Ils restent des prototypes de travail : leur utilisation dans un produit vendu doit être validée selon les règles de merchandising NASA avant une ouverture commerciale. `commercialReady` vaut `false` et aucun paiement n’est disponible. Un remplacement par des animations disposant de droits commerciaux explicites est possible avant commercialisation.

Les prix et Stripe sont reportés. Le futur paiement doit attribuer le droit à un UUID authentifié à partir d’un événement Stripe vérifié côté serveur. Une redirection vers une page de succès ou un code envoyé par le client ne doit jamais suffire à accorder une cape. Aucun secret Stripe ne doit entrer dans le launcher.

## Vérification et prochaines étapes

Tests de signatures pour deux identités et tentatives de substitution ; vrai certificat Minecraft vérifié par le runtime Cloudflare local ; rejeu et UUID falsifié rejetés ; cape payante non possédée rejetée ; tests des deux jeux réels avec deux identités distantes synthétiques, nom décoré, couleurs distinctes, texture de cape appliquée au rendu et animation ; boutique native avec trois aperçus, rotation, pause, équipement/retrait de la cape gratuite et verrouillage des achats.

Avant publication : essai sur deux PC connectés avec deux vrais comptes, déploiement explicitement autorisé du relais v2, validation graphique et des droits des animations, prix, politique de remboursement et raccordement Stripe. Aucun serveur supplémentaire n’est requis par la solution actuelle de présence.

## Mise à jour privée autorisée

À la demande explicite de Xerion, son launcher principal est maintenant en 4.9.0-dev, avec une sauvegarde complète 4.8.2 dans work/cosmetics-dev/backup-primary-4.8.2 et les données de compte sauvegardées séparément. Java, RAM, installations, comptes et JAR de jeu ont été vérifiés conservés. Aucune release, aucun push GitHub ni déploiement du worker public n’a été effectué. Le relais local v2 écoute sur 127.0.0.1:8789. Le fichier private-runtime.json du développeur permet de le redémarrer au besoin ; cette configuration ne fait pas partie des sources distribuées. Le worker public reste en v1. Une validation entre deux PC attend donc une autorisation distincte de déploiement et des clients de test compatibles.

La garde-robe en jeu a été entièrement remplacée par une interface reprenant le menu des mods : aperçu réel du joueur, skin en cours d’utilisation, rotation libre, capes portées sur un état de rendu séparé. La vue 3D ne modifie pas le joueur ni la cape équipée. Dans le launcher, skinview3d 3.4.2 (MIT), Three.js et skinview-utils sont intégrés localement, avec leurs notices de licence. La vraie texture de compte est récupérée en HTTPS auprès de textures.minecraft.net. Les animations sont mises à jour sur une texture GPU existante ; la vue est inactive hors de la boutique. Le curseur est synchronisé avec l’angle et son remplissage suit le centre du pouce.

Orbite utilise maintenant le GIF BHW_Supermassive_Black_Hole_Simulation.gif, avec une silhouette noire et la scène complète encadrée sur la cape. Les deux animations restent des prototypes sans paiement.
