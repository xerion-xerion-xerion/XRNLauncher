package fr.xerion.xrnhud;

import net.minecraft.client.MinecraftClient;

/**
 * Les fonctions qui ne sont pas des reglages du jeu.
 *
 * <p>Tout ici tourne entierement sur le client : aucun paquet envoye au
 * serveur, aucune commande, rien qui puisse etre pris pour du triche.
 * Ce que le serveur autorise, on ne le pretend pas.
 */
final class Fonctions {

    /** Fullbright ne modifie que le rendu : aucune potion ni option graphique. */
    static boolean fullbright=false;

    /* --- zoom : on resserre le champ de vision, comme une lunette. --- */
    static boolean zoom = false;
    private static int fovAvant = 90;
    private static final int FOV_ZOOM = 40;

    /* --- marqueur : on retient un point et on affiche la distance. --- */
    static boolean marque = false;
    private static double marqueX = 0, marqueY = 0, marqueZ = 0;

    private Fonctions() {}

    /** Appele une fois par tick. */
    static void maj(MinecraftClient cl) {
        // Fullbright is applied only to the rendered lightmap; no potion or option is modified.
        if (zoom && cl.player != null) {
            /*  Si le joueur change le champ de vision a la main pendant
                que le zoom est actif, on lui laisse : il a gagne. La
                valeur du zoom elle-meme ne doit jamais devenir la
                valeur a restaurer, sinon on perdrait celle d avant.  */
            int actuelle = Options.champDeVision();
            if (actuelle != FOV_ZOOM) fovAvant = actuelle;
        }
    }

    /* ------------------------------------------------------------------ */

    static void basculerZoom() {
        if (zoom) {
            Options.champDeVision(fovAvant);
            zoom = false;
        } else {
            fovAvant = Options.champDeVision();
            Options.champDeVision(FOV_ZOOM);
            zoom = true;
        }
    }

    static void marquer(MinecraftClient cl) {
        if (cl.player == null) return;
        marqueX = cl.player.getX();
        marqueY = cl.player.getY();
        marqueZ = cl.player.getZ();
        marque = true;
    }

    static void effacerMarque() {
        marque = false;
    }

    /** Distance au marqueur, en blocs, ou -1 s'il n'y en a pas. */
    static double distanceMarque(MinecraftClient cl) {
        if (!marque || cl.player == null) return -1;
        double dx = cl.player.getX() - marqueX;
        double dy = cl.player.getY() - marqueY;
        double dz = cl.player.getZ() - marqueZ;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
