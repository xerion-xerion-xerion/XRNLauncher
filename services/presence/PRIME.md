# XRNPrime — exploitation

## Offre

4,99 EUR par mois, renouvellement mensuel. Aucun essai gratuit Stripe et aucun droit accordé à partir d’un retour de navigateur. Le statut actif exige une session Minecraft vérifiée, un abonnement Stripe appartenant à cet UUID, le prix configuré, une facture payée de 499 centimes et son paiement effectivement confirmé. Les remboursements et contestations sont relus auprès de Stripe. L’arrêt du renouvellement conserve la période déjà payée.

Les codes du propriétaire offrent entre 1 et 365 jours sans créer d’abonnement. Chaque code a une entropie aléatoire de 128 bits, une empreinte HMAC distincte des codes de capes, une expiration de trente jours et une consommation transactionnelle unique. Seul `XRN_GIFT_ADMIN_UUID` peut créer/lister/annuler des codes.

## Indicateurs

- `XRN_PRIME_ENABLED=true` prépare les routes et les droits Prime.
- `XRN_PRIME_PUBLIC=false` maintient la caisse Prime réservée au propriétaire pendant la préparation. Les anciens styles ne deviennent pas payants sans lancement public explicite.
- `XRN_PRIME_PUBLIC=true` ouvre les souscriptions et réserve les animations de pseudo aux membres actifs lors de chaque publication de style.
- `XRN_PRIME_PRICE_ID` désigne un prix Stripe récurrent de 499 centimes EUR/mois ; aucune valeur fournie par le client ne change le prix.
- `STRIPE_PRIME_WEBHOOK_SECRET` est un secret Cloudflare distinct de celui des achats unitaires. Aucun secret Stripe ne va dans le launcher, la compilation ou Git.

Le webhook Prime est `/v2/shop/prime/webhook`. Événements : Checkout terminé/expiré, changement d’abonnement, facture payée/échouée/action requise, remboursement et contestation. Chaque webhook signé déclenche une nouvelle lecture de Stripe ; il ne fait pas confiance à un simple champ « paid » du corps. Les lectures concurrentes sont ordonnées pour éviter de remettre un ancien état actif après une révocation. Le cache des droits payés expire après cinq minutes sans confirmation ; la présence expire séparément après 90 secondes.

## Images et stockage

Le client normalise l’image en texture PNG RGBA 1024×512, au maximum 512 KiB. Le serveur vérifie la signature, chaque CRC, les dimensions, les filtres et la taille décompressée. Pas de SVG, de GIF importé, de chemin ou d’URL fournie par le client. Les deux importations sont comptées sur sept jours glissants dans une transaction ; une réservation bloque les requêtes concurrentes et n’est rendue que si le stockage échoue. Effacer une image réussie ne rend pas de crédit.

Le Durable Object existant utilise SQLite : les images bornées sont stockées sous `prime:blob:`. Aucun serveur supplémentaire ni activation R2 n’est nécessaire pour cette préparation. R2 peut être ajouté avec la liaison `PRIME_CAPES` ; la lecture conserve le repli sur les images déjà en SQLite. Prévoir le suivi des limites du plan Cloudflare et une migration vers R2 selon le volume. Le nettoyage des présences ne lit jamais les BLOBs ou les commandes Stripe.

Une image non équipée reste accessible seulement à son propriétaire authentifié. Une image équipée est publiée pour être rendue par les autres clients, seulement si Prime est actif et la présence valide. L’expiration ou la suppression coupe cette publication. Une image déjà affichée peut avoir été copiée : les droits entre joueurs sont vérifiés sur le serveur, pas par le secret du fichier image. Le cache du jeu vérifie le SHA-256 et borne les textures GPU.

## Clients

Le badge + et le droit d’animation viennent du relais. Le cache local facilite seulement le rendu ; modifier son propre client ne confère aucun droit sur les autres clients. Les capes importées sont sélectionnées comme les capes du catalogue. Cinq tenues sont enregistrées par compte, avec nouvelle vérification de propriété lors de l’application.

Le suivi de WaveyCapes est un choix personnel explicite dans `.xrn-waveycapes/settings.json`. Il n’est pas activé par défaut et ne fait pas partie de Prime. Le JAR original reste hors du dépôt/setup et de la distribution XRN. Les fichiers officiels sont vérifiés via SHA-512 et sélectionnés pour le Minecraft et le chargeur exacts.

## Vérifications

`node prime.test.mjs` : facturation, signature du webhook, révocation, codes concurrents, quota, échec du stockage, PNG, tenues, isolation et expiration. Les tests utilisent des identités et des paiements simulés ; ne pas présenter cela comme une transaction bancaire réelle.

Les essais en jeu et dans la fenêtre Windows sont conservés hors des sources de distribution. Aucun point d’accès de test ou contournement d’identité n’est compilé dans le worker de production.
