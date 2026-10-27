package fr.xerion.xrnhud;

import java.util.ArrayList;
import java.util.List;

/**
 * La mise en page d'un onglet.
 *
 * <p>Cette classe ne depend d'aucun ecran ni d'aucune classe de Minecraft :
 * c'est volontaire, pour pouvoir la tester toute seule. Elle tient elle-meme
 * le curseur vertical, ce qui supprime la famille de bugs ou une ligne
 * oubliee se retrouve par-dessus les autres.
 *
 * <p>Point capital : {@link #vider()} doit etre appele avant de reconstruire.
 * Le menu est redessine a chaque image ; sans remise a zero, les reglages
 * s'empilent indefiniment et le panneau s'allonge hors de l'ecran.
 */
final class Panneau {

    static final int LARGEUR = 640;
    static final int PAD = 14;
    static final int LIGNE = 28;
    static final int LIGNE_INFO = 16;
    static final int ECART = 4;
    static final int UTILE = LARGEUR - 2 * PAD;

    /** Un reglage a fleches, un bouton, une ligne d'information, ou un
        simple etat cliquable. Le genre guide le dessin : le menu dessine
        un interrupteur pour un reglage a deux etats, des fleches pour un
        reglage a plusieurs valeurs, et rien pour une ligne d'information. */
    record Carte(int x, int y, int w, int h, String libelle, String valeur,
                 boolean actif, Runnable moins, Runnable plus, Runnable action,
                 boolean bascule) {}

    record Section(String titre, int y) {}

    private final List<Carte> cartes = new ArrayList<>();
    private final List<Section> sections = new ArrayList<>();
    private int y = 0;

    /*  Largeur utile : elle depend de la taille de l ecran, pour que le
        panneau occupe une part raisonnable quelle que soit l echelle
        d interface choisie par le joueur.                                */
    private int utile = LARGEUR - 2 * PAD;

    void largeur(int w) {
        this.utile = w;
    }

    void vider() {
        cartes.clear();
        sections.clear();
        y = 0;
    }

    Panneau section(String titre) {
        /*  Un souffle avant chaque nouveau titre : deux sections qui se
            touchaient se lisaient comme un seul bloc.                  */
        if (y > 0) y += 9;
        sections.add(new Section(titre, y));
        y += 18;
        return this;
    }

    Panneau pas(String libelle, String valeur, boolean actif, Runnable moins, Runnable plus) {
        cartes.add(new Carte(PAD, y, utile, LIGNE, libelle, valeur, actif, moins, plus, null, false));
        y += LIGNE + ECART;
        return this;
    }

    /** Un reglage a deux etats : le menu dessine un interrupteur, pas
        des fleches. Les fleches sur un Oui/Non laissaient croire qu il
        y avait une troisieme valeur quelque part.                     */
    Panneau bascule(String libelle, boolean marche, Runnable action) {
        cartes.add(new Carte(PAD, y, utile, LIGNE, libelle, null, marche, action, action, null, true));
        y += LIGNE + ECART;
        return this;
    }

    /** Un etat cliquable affiche en texte ("Choisi", "Choisir") : on
        garde le mot du joueur, pas un interrupteur qui mentirait.     */
    Panneau etat(String libelle, String valeur, Runnable action) {
        cartes.add(new Carte(PAD, y, utile, LIGNE, libelle, valeur, false, null, null, action, false));
        y += LIGNE + ECART;
        return this;
    }

    Panneau info(String libelle) {
        cartes.add(new Carte(PAD, y, utile, LIGNE_INFO, libelle, null, false, null, null, null, false));
        y += LIGNE_INFO + 2;
        return this;
    }

    /** Deux boutons cote a cote. */
    Panneau actions(String gauche, Runnable a, String droite, Runnable b) {
        int demi = (utile - ECART) / 2;
        cartes.add(new Carte(PAD, y, demi, LIGNE, gauche, null, false, null, null, a, false));
        cartes.add(new Carte(PAD + demi + ECART, y, demi, LIGNE, droite, null, false, null, null, b, false));
        y += LIGNE + ECART;
        return this;
    }

    List<Carte> cartes() { return cartes; }

    List<Section> sections() { return sections; }

    int taille() { return cartes.size(); }

    int bas() { return y; }

    /* ------------------------------------------------------------------ */
    /*  Verifications utilisees par le test et par le menu                 */
    /* ------------------------------------------------------------------ */

    /**
     * Renvoie la premiere erreur de mise en page trouvee, ou null.
     * On prefere un texte precis a un booléen muet : un test qui n'explique
     * rien ne sert a rien quand il casse.
     */
    String verifier() {
        int occupe = 0;
        for (int i = 0; i < cartes.size(); i++) {
            Carte c = cartes.get(i);
            if (c.w() <= 0) return "carte " + i + " (" + c.libelle() + ") : largeur nulle";
            if (c.h() <= 0) return "carte " + i + " (" + c.libelle() + ") : hauteur nulle";
            if (c.x() < 0 || c.x() + c.w() > PAD * 2 + utile) {
                return "carte " + i + " (" + c.libelle() + ") : deborde du panneau";
            }
            if (c.y() < 0) return "carte " + i + " (" + c.libelle() + ") : position negative";
            /*  Deux cartes de meme ligne doivent etre cotes a cotes. */
            for (int j = 0; j < i; j++) {
                Carte d = cartes.get(j);
                if (d.y() == c.y() && d.x() != c.x()) {
                    /*  meme ligne : seule la paire action/ bouton est prevue */
                    if (c.x() != PAD && c.x() != PAD + ((utile - ECART) / 2) + ECART) {
                        return "carte " + i + " et " + j + " se chevauchent sur la ligne " + c.y();
                    }
                }
            }
            occupe = Math.max(occupe, c.y() + c.h());
        }
        for (Section s : sections) {
            if (s.y() < 0) return "section " + s.titre() + " : position negative";
        }
        if (cartes.isEmpty()) return "aucun reglage : l'onglet est vide";
        if (bas() < occupe) return "la hauteur annoncee est plus petite que le contenu";
        return null;
    }
}