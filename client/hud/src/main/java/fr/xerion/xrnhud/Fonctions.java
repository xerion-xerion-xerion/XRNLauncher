package fr.xerion.xrnhud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;

/**
 * Les fonctions qui ne sont pas des reglages du jeu.
 *
 * <p>Tout ici tourne entierement sur le client : aucun paquet envoye au
 * serveur, aucune commande, rien qui puisse etre pris pour du triche.
 * Ce que le serveur autorise, on ne le pretend pas.
 */
final class Fonctions {

    /* --- fullbright : on eclaire comme une potion de vision nocturne,
           ce qui fonctionne la ou la luminosite maximale ne suffit plus,
           dans les grottes.                                            */
    static boolean fullbright = false;
    private static boolean injecte = false;

    /*  L effet est renouvelle bien avant sa fin. Le laisser expirer
        meme un seul tick fait plonger la luminosite, et c est ce tick
        la que naissait le clignotement : la lumiere du monde sautait
        toutes les vingt secondes.                                      */
    private static final int DUREE_VISION = 1200;
    private static final int RENOUVELLEMENT = 400;

    /*  Le fullbright pousse aussi la luminosite du jeu au maximum, et la
        restitue ensuite. Sans cela l eclairage garde une teinte
        bleutee, meme en grottes.                                      */
    private static double gammaAvant = -1;

    /*  Hors des grottes, la vision nocturne aplatit tout : le ciel, les
        couleurs, les ombres. C est la que le fullbright parait "nul".
        On ne l applique donc que dans le noir, et on garde une
        luminosite douce le reste du temps.                              */
    private static final double LUMINOSITE_CAVE = 1.0;
    private static final double LUMINOSITE_JOUR = 0.85;
    private static final int LUMIERE_BASSE = 7;

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
        pleinEcran(cl);
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

    private static void pleinEcran(MinecraftClient cl) {
        if (cl.player == null) {
            if (injecte) injecte = false;
            return;
        }

        StatusEffectInstance effet = cl.player.getStatusEffect(StatusEffects.NIGHT_VISION);
        boolean present = effet != null;
        if (!present) injecte = false;

        if (fullbright) {
            /*  Sommes-nous dans le noir ? La vision nocturne ne sert
                que la : dehors, elle eteint le jeu. On mesure la
                lumiere la ou se tient le joueur.                         */
            boolean sombre = dansLeNoir(cl);

            /*  Luminosite du jeu : maximale dans le noir, douce le
                reste du temps. On memorise celle du joueur pour la lui
                rendre a la desactivation.                                  */
            double vise = sombre ? LUMINOSITE_CAVE : LUMINOSITE_JOUR;
            if (gammaAvant < 0) gammaAvant = Options.luminosite();
            if (Math.abs(Options.luminosite() - vise) > 0.01) Options.luminosite(vise);

            if (sombre && !present) {
                appliquerVision(cl);
            } else if (sombre && injecte && effet.getDuration() < RENOUVELLEMENT) {
                /*  Renouvellement AVANT expiration : c est ce qui
                    supprime le clignotement.                            */
                appliquerVision(cl);
            } else if (!sombre && injecte) {
                /*  Dehors : on retire l effet, sinon le monde reste
                    plat et bleute en plein jour.                          */
                cl.player.removeStatusEffect(StatusEffects.NIGHT_VISION);
                injecte = false;
            }
            return;
        }

        if (gammaAvant >= 0) {
            Options.luminosite(gammaAvant);
            gammaAvant = -1;
        }

        if (injecte) {
            /*  On ne retire que ce que nous avons mis : si le joueur a
                bu une vraie potion, on ne la vole pas.                 */
            cl.player.removeStatusEffect(StatusEffects.NIGHT_VISION);
            injecte = false;
        }
    }

    /**
     * Le joueur est-il dans le noir ?
     *
     * <p>On regarde la lumiere du bloc et celle du ciel, la ou se
     * tient le joueur. Sous terre, les deux sont faibles : c est une
     * grotte. En plein jour, la lumiere du ciel est au maximum : on
     * n a pas besoin de la potion, et surtout on ne veut pas
     * l appliquer.
     */
    private static boolean dansLeNoir(MinecraftClient cl) {
        try {
            if (cl.world == null) return false;
            net.minecraft.util.math.BlockPos pos = cl.player.getBlockPos();
            int bloc = cl.world.getLightLevel(net.minecraft.world.LightType.BLOCK, pos);
            int ciel = cl.world.getLightLevel(net.minecraft.world.LightType.SKY, pos);
            return bloc < LUMIERE_BASSE && ciel < LUMIERE_BASSE;
        } catch (Exception e) {
            /*  Sans monde, on ne force rien.                            */
            return false;
        }
    }

    private static void appliquerVision(MinecraftClient cl) {
        /*  Particles et icone masquees : l effet doit etre invisible,
            sinon on ne verrait plus ce qu on regarde.                  */
        cl.player.addStatusEffect(new StatusEffectInstance(
                StatusEffects.NIGHT_VISION, DUREE_VISION, 0, true, false, false));
        injecte = true;
    }

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
