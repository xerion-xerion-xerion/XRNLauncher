package fr.xerion.xrnhud;

/**
 * Marque les etats de rendu qui portent un cosmetique du client.
 *
 * <p>L etat de rendu d un joueur ne dit pas de quel joueur il
 * s agit. On y ajoute donc des marques, posees par le mixin du
 * renderer, et lues par les rendus de cape et d ailes.
 */
public interface CapeEtat {

    /** Ce joueur porte-t-il la cape du client ? */
    boolean xrn$cape();

    /** Pose la marque de la cape. */
    void xrn$cape(boolean actif);

    /** Ce joueur porte-t-il les ailes du client ? */
    boolean xrn$ailes();

    /** Pose la marque des ailes. */
    void xrn$ailes(boolean actif);

    /** Le cosmetique que porte ce joueur : c'est lui qui dit quelle
        texture dessiner. */
    String xrn$cosmetique();

    /** Pose le cosmetique porte. */
    void xrn$cosmetique(String id);
}
