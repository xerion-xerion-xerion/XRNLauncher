# Boutique XRN 4.9.0

Le service de production xrn-shop-live utilise Stripe Checkout et un webhook signé. Les clés Stripe et le secret des codes cadeaux sont conservés uniquement côté serveur et dans le coffre DPAPI du poste développeur, jamais dans les sources distribuées.

Prix : Job Application offerte ; Singularité animée 299 centimes EUR ; Scream, Spine et Crimson Knight 199 centimes EUR chacune. Une commande contient un seul produit, quantité un. Le serveur fixe montant, devise, UUID authentifié et produit. Le retour navigateur ne prouve aucun paiement : Checkout, ses lignes et son PaymentIntent sont relus chez Stripe. Remboursements et contestations révoquent la preuve d’achat ; une requête périmée ne rétablit pas un achat révoqué.

Les codes cadeaux permettent une cape premium au choix. Le serveur authentifie le propriétaire avec un certificat Minecraft, sans identifiant administrateur inclus dans le launcher. Les codes aléatoires contiennent 128 bits aléatoires et sont stockés sous HMAC avec secret serveur. La consommation et l’attribution se font dans une même transaction durable. Un code déjà consommé ne peut pas offrir une autre cape, même à un autre compte. Une cape déjà possédée ne consomme pas le code. Expiration de 30 jours par défaut, révocation des codes inutilisés, limites de tentatives. Les codes courts personnalisés nécessitent une restriction à un UUID destinataire.

Contrôles : tentatives de prix, quantité, identité et signature falsifiés ; transactions concurrentes, rejeu, droits par compte et isolation test/réel ; remboursement et conservation durable. Le service de production a accepté une identité Minecraft officielle, créé et annulé un code de contrôle sans offrir de cape. L’interface native a vérifié la sélection d’une seule cape et l’affichage réservé au propriétaire. Les jeux isolés 1.21.11 et 26.2 ont vérifié ressources, animation, aperçu et rendu des capes de deux identités.

Les paiements et remboursements ont été exécutés avec Stripe en mode test. En production, les Checkout réels à 1,99 € et 2,99 € ont été vérifiés puis expirés sans débit. Aucun paiement réel encaissé n’est revendiqué comme test.

Un client modifié peut dessiner une texture sur sa propre machine. Le relais officiel ne partage les capes premium que si le compte dispose d’un achat vérifié ou d’un cadeau valide ; les données locales ne constituent pas une preuve d’acquisition. Aucune garantie absolue d’absence de faille n’est formulée.
