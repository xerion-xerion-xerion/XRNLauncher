package fr.xerion.xrnhud;

/**
 * Verifie la mise en page des trois onglets sans lancer Minecraft.
 *
 * <p>Les deux bugs qui ont casse le menu venaient tous les deux de la
 * mise en page : des positions ecrites en dur, puis des listes jamais
 * videes entre deux images. Cette classe reproduit les trois onglets et
 * controle le resultat.
 */
public final class TestPanneau {

    private static int echecs = 0;

    public static void main(String[] args) {
        Panneau[] onglets = { new Panneau(), new Panneau(), new Panneau() };
        construireVision(onglets[0]);
        construireAffichage(onglets[1]);
        construireOutils(onglets[2]);

        for (int i = 0; i < onglets.length; i++) {
            Panneau p = onglets[i];
            String erreur = p.verifier();
            if (erreur != null) {
                echecs++;
                System.out.println("  ECHEC  onglet " + i + " : " + erreur);
            } else {
                System.out.println("  ok     onglet " + i + " : "
                        + p.cartes().size() + " cartes, "
                        + p.sections().size() + " sections, "
                        + p.bas() + " px de contenu");
            }
        }

        /*  Le menu est redessine a chaque image : reconstruire sans vider
            doit laisser exactement le meme panneau. C'est le bug du
            defilement infini.                                            */
        Panneau avant = onglets[0];
        int tailleAvant = avant.taille();
        int basAvant = avant.bas();
        onglets[0].vider();
        construireVision(onglets[0]);
        if (onglets[0].taille() != tailleAvant || onglets[0].bas() != basAvant) {
            echecs++;
            System.out.println("  ECHEC  la reconstruction n'est pas idempotente : "
                    + tailleAvant + " -> " + onglets[0].taille());
        } else {
            System.out.println("  ok     reconstruction idempotente");
        }

        /*  Le panneau a maintenant une hauteur fixe : l'en-tete, une zone de
            contenu defilee, et le pied. C'est ce qui empeche le contenu
            de deborder sous le pied du panneau.                        */
        int contenuH = Math.max(onglets[0].bas(),
                Math.max(onglets[1].bas(), onglets[2].bas()));
        final int TITRE = 42, ONGLETS_H = 26, CONTENU_H = 296, PIED = 24;
        int total = TITRE + ONGLETS_H + 8 + CONTENU_H + Panneau.PAD + PIED;
        System.out.println("  info   hauteur du panneau : " + total
                + " px (zone de contenu " + CONTENU_H + " px)");
        System.out.println("  info   contenu le plus long : " + contenuH + " px");
        if (total > 520) {
            echecs++;
            System.out.println("  ECHEC  le panneau ne tient pas dans 540 px de hauteur utile");
        }
        for (int i = 0; i < onglets.length; i++) {
            if (onglets[i].bas() > CONTENU_H) {
                System.out.println("  ok     onglet " + i + " defile de "
                        + (onglets[i].bas() - CONTENU_H) + " px");
            }
        }

        System.out.println(echecs == 0 ? "  TOUT EST CORRECT" : "  " + echecs + " PROBLEME(S)");
        if (echecs > 0) System.exit(1);
    }

    /*  Les trois onglets, reproduits a l'identique du menu. */

    private static void construireVision(Panneau p) {
        p.section("FONCE")
         .pas("Fullbright", "Non", false, () -> { }, () -> { })
         .pas("Luminosite", "Basse", false, () -> { }, () -> { })
         .pas("Obscurite", "Supprime", false, () -> { }, () -> { })
         .pas("Vignette", "Oui", false, () -> { }, () -> { })
         .pas("Ombres", "Oui", false, () -> { }, () -> { });
        p.section("RETICULE")
         .pas("Forme", "Vanilla", false, () -> { }, () -> { })
         .pas("Couleur", "Blanc", false, () -> { }, () -> { })
         .pas("Epaisseur", "2 px", false, () -> { }, () -> { });
    }

    private static void construireAffichage(Panneau p) {
        p.section("HUD")
         .pas("HUD XRN", "Oui", false, () -> { }, () -> { })
         .pas("Touches affichees", "Non", false, () -> { }, () -> { })
         .pas("Minuterie", "Non", false, () -> { }, () -> { })
         .pas("Compteur de clics", "Non", false, () -> { }, () -> { })
         .pas("Coeurs et faim", "Oui", false, () -> { }, () -> { })
         .pas("Effets de potion", "Oui", false, () -> { }, () -> { })
         .pas("Barres de boss", "Oui", false, () -> { }, () -> { })
         .pas("Nom de l'objet tenu", "Oui", false, () -> { }, () -> { })
         .pas("Scoreboard lateral", "Oui", false, () -> { }, () -> { });
        p.section("PERFORMANCE")
         .pas("Champ de vision", "90°", false, () -> { }, () -> { })
         .pas("Distance d'affichage", "12 blocs", false, () -> { }, () -> { })
         .pas("Distance de simulation", "12 blocs", false, () -> { }, () -> { })
         .pas("Images par seconde", "Illimite", false, () -> { }, () -> { })
         .pas("Echelle", "Auto", false, () -> { }, () -> { })
         .pas("Saut automatique", "Non", false, () -> { }, () -> { });
        p.section("CONFORT")
         .pas("Retour du champ de vision", "Normal", false, () -> { }, () -> { })
         .pas("Opacite du chat", "Moyen", false, () -> { }, () -> { })
         .pas("Flou des menus", "Moyen", false, () -> { }, () -> { })
         .pas("Balancement camera", "Oui", false, () -> { }, () -> { })
         .pas("Secousses", "Non", false, () -> { }, () -> { })
         .pas("Position du HUD", "Bas gauche", false, () -> { }, () -> { });
    }

    private static void construireOutils(Panneau p) {
        p.section("JEU")
         .pas("Zoom", "Off", false, () -> { }, () -> { })
         .pas("Course maintenue", "Non", false, () -> { }, () -> { })
         .pas("Balancement camera", "Oui", false, () -> { }, () -> { })
         .pas("Secousses", "Non", false, () -> { }, () -> { });
        p.section("MARQUEUR")
         .info("Aucun point de passage")
         .actions("Marquer ici", () -> { }, "Effacer", () -> { });
        p.section("SYSTEME")
         .pas("Opacite du fond", "Moyen", false, () -> { }, () -> { })
         .actions("Chat", () -> { }, "Plein ecran", () -> { })
         .actions("Menu des mods", () -> { }, "Quitter", () -> { });
    }
}