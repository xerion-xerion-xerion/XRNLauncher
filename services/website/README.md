# Site HTTPS de secours

Le site principal reste sur GitHub Pages avec le domaine xrnlauncher.com. Au 30 octobre 2026, GitHub indique que le certificat du domaine attend encore sa création ; ne pas contourner sa vérification TLS.

Un miroir HTTPS vérifié est disponible sur https://xrn-website.schianotom667.workers.dev. Aucun enregistrement DNS du domaine IONOS n’a été changé. Le miroir sert uniquement les fichiers publics du site, sans données du launcher ni clés de paiement.

Pour republier les mêmes sources avec une session Cloudflare autorisée : lancer `python services/website/stage.py`, puis `wrangler deploy --config services/website/wrangler.toml`. Aucun secret ne doit être ajouté à ces fichiers. Vérifier les deux hébergements après chaque changement du site.

Une fois le certificat GitHub prêt, vérifier une connexion HTTPS normale sur le domaine puis activer HTTPS dans Pages. Le certificat du site ne signe pas les exécutables et ne garantit pas leur réputation SmartScreen.
