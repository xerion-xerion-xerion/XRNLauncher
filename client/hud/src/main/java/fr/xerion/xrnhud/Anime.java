package fr.xerion.xrnhud;

/** Petits outils d'animation. Aucun rendu ici : uniquement les courbes. */
final class Anime {

    private Anime() {}

    /** Progression douce vers la cible : atteint 1 en environ 150 ms. */
    static float vers(float actuelle, float cible, float vitesse) {
        return actuelle + (cible - actuelle) * vitesse;
    }

    /**
     * Sortie d'entree/sortie : rapide au depart, douce a l'arrivee.
     * Utilisee pour l'ouverture du menu, pour que ca ne donne pas
     * l'impression d'une apparition brutale.
     */
    static float sortie(float t) {
        t = borne(t);
        float inverse = 1f - t;
        return 1f - inverse * inverse * inverse;
    }

    /** Fondu entre deux couleurs, pour que l'opacite ne saute pas. */
    static float fondu(float debut, float fin, float p) {
        return debut + (fin - debut) * p;
    }

    static float borne(float v) {
        if (v < 0f) return 0f;
        if (v > 1f) return 1f;
        return v;
    }

    static float borne(float v, float min, float max) {
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }
}