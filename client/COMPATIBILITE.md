# Compatibilité XRN Client

Périmètre demandé : les familles Minecraft 1.20.x, 1.21.x et 26.x, versions Java finales. Les versions antérieures à 1.20 ne font plus partie de cette demande.

## État vérifié

- Fabric 1.21.11 : port présent, démarrage réel avec Essential, Fullbright et cape articulée vérifiés.
- Fabric 26.1.2 : port distinct présent, chargement réel des mods recommandés, menu, garde-robe et absence de Prime vérifiés.
- Fabric 26.2 : port présent, mêmes contrôles effectués.
- Autres versions de ces familles : adaptations encore à réaliser. Aucune compatibilité générale n'est annoncée dans les dépendances Fabric ou le manifeste du launcher.

## Principe

Mutualiser les fonctions, les textures et les réglages. Réutiliser un même fichier seulement pour les versions dont les interfaces du jeu et du chargeur sont compatibles. Sinon, fournir un adaptateur de rendu distinct ; le launcher choisit automatiquement le fichier adapté avec `launcher/mods-integres/compatibility.json`. Ne pas remplacer les versions exactes par un joker pour masquer les différences d'API.

Points à adapter : menus et événements de souris, pipeline de rendu, états des joueurs, capes et élytres, lightmap, Java et Fabric API. Fabric décrit notamment les changements de rendu entre 1.21.2 et 1.21.8 et ceux de 1.21.9/1.21.10 :
- https://fabricmc.net/2025/06/15/1216.html
- https://fabricmc.net/2025/09/23/1219.html

Aucune publication supplémentaire n'est déclenchée par ce suivi.
