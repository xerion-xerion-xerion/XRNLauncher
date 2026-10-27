package fr.xerion.xrnhud;

import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;

/**
 * Le reticule, dessine par le client.
 *
 * <p>On ne supprime surtout pas le reticule de Minecraft avec
 * {@code removeElement} : une fois sorti du registre il ne revient pas,
 * et revenir en mode normal exigerait de relancer le jeu. On l'enveloppe
 * a la place, ce qui garde la porte ouverte dans les deux sens.
 *
 * <p>Les traits sont toujours d une epaisseur impaire : sur une grille
 * de pixels, une epaisseur paire ne peut pas etre centree, et le
 * reticule parait decale d un demi pixel.
 */
final class Reticule {

    enum Mode { VANILLA, POINT, CROIX, T, ROND, AUCUN }

    static final String[] NOMS = { "Normal", "Point", "Croix", "T", "Rond", "Aucun" };

    static Mode mode = Mode.VANILLA;
    static int couleur = 0xFFFFFFFF;
    static int epaisseur = 1;

    static final int[] COULEURS = {
        0xFFFFFFFF, 0xFFA78BFA, 0xFF34D399, 0xFFFBBF24, 0xFF111111
    };
    static final String[] COULEURS_NOMS = { "Blanc", "Violet", "Vert", "Or", "Noir" };

    private static boolean pose = false;

    private Reticule() {}

    static void installer() {
        if (pose) return;
        pose = true;
        HudElementRegistry.replaceElement(
                VanillaHudElements.CROSSHAIR,
                original -> (context, tick) -> {
                    if (mode == Mode.VANILLA) {
                        original.extractRenderState(context, tick);
                    } else if (mode != Mode.AUCUN) {
                        dessiner(context);
                    }
                });
    }

    private static void dessiner(GuiGraphicsExtractor c) {
        Minecraft cl = Minecraft.getInstance();
        if (cl.player == null || cl.gui.hud.isHidden()) return;

        int cx = cl.getWindow().getGuiScaledWidth() / 2;
        int cy = cl.getWindow().getGuiScaledHeight() / 2;

        int e = epaisseur | 1;          /*  toujours impair, donc centre  */
        int demi = e / 2;
        int L = 4 + e;                  /*  longueur d une branche       */

        switch (mode) {
            case POINT -> {
                Theme.rect(c, cx - demi, cy - demi, e, e, couleur);
            }
            case CROIX -> {
                /*  Barre horizontale et barre verticale, meme centre.  */
                Theme.rect(c, cx - L, cy - demi, 2 * L + e, e, couleur);
                Theme.rect(c, cx - demi, cy - L, e, 2 * L + e, couleur);
            }
            case T -> {
                /*  Barre en haut, tige qui descend. La barre est plus
                    large que la tige, sinon on ne voit plus un T.       */
                Theme.rect(c, cx - L, cy - L, 2 * L + e, e, couleur);
                Theme.rect(c, cx - demi, cy - L, e, L + e, couleur);
            }
            case ROND -> {
                int rayon = 4 + e;
                for (int py = cy - rayon; py <= cy + rayon; py++) {
                    int premier = -1;
                    int dernier = -1;
                    for (int px = cx - rayon; px <= cx + rayon; px++) {
                        double dx = px - cx + 0.5;
                        double dy = py - cy + 0.5;
                        double d = Math.sqrt(dx * dx + dy * dy);
                        if (d <= rayon - 0.5 && d >= rayon - e - 0.5) {
                            if (premier == -1) premier = px;
                            dernier = px;
                        }
                    }
                    if (premier != -1) {
                        Theme.rect(c, premier, py, dernier - premier + 1, 1, couleur);
                    }
                }
            }
            default -> { }
        }
    }

    static void avancer(boolean avant) {
        Mode[] tous = Mode.values();
        mode = tous[Math.floorMod(mode.ordinal() + (avant ? -1 : 1), tous.length)];
    }

    static void avancerCouleur(boolean avant) {
        int n = COULEURS.length;
        for (int i = 0; i < n; i++) {
            if (COULEURS[i] == couleur) {
                couleur = COULEURS[Math.floorMod(i + (avant ? -1 : 1), n)];
                return;
            }
        }
        couleur = COULEURS[0];
    }

    /*  L epaisseur boucle sur des valeurs impaires : 1, 3, 5. Un trait
        pair ne peut pas etre centre sur un pixel.                       */
    static void epaisseurPlus() {
        epaisseur = epaisseur >= 5 ? 1 : epaisseur + 2;
    }
}
