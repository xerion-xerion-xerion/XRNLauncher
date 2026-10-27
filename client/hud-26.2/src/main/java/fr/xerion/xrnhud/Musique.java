package fr.xerion.xrnhud;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.textures.FilterMode;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

/**
 * La musique en cours de lecture.
 *
 * <p>Le launcher interroge Windows et ecrit l'etat de la lecture dans
 * un fichier JSON : c'est la que le mod va le chercher. Un fichier et
 * non un port ouvert, pour que le jeu n'ait rien a demarrer et que
 * rien ne tourne quand il est ferme.
 *
 * <p>L'element est pose en haut a gauche de l'ecran, et se deplace a
 * la souris depuis l ecran d edition du mod, comme les autres blocs.
 */
final class Musique {

    /*  Ce que le launcher a ecrit. */
    static String titre = "";
    static String artiste = "";
    static String application = "";
    static String etat = "";
    static long position = 0;
    static long duree = 0;
    static String fichierPochette = "";
    /*  Le joueur peut masquer completement le bloc. */
    static boolean visible = true;

    /*  Dimensions du bloc.

        La mise en page est calculee ligne par ligne, avec la hauteur
        de police du jeu (9 pixels) : titre, artiste, puis la ligne des
        temps. Chaque ligne a sa place, et rien ne se recouvre.      */
    private static final int TAILLE_POCHETTE = 30;
    private static final int LARGEUR = 186;
    private static final int HAUTEUR = 40;
    private static final int MARGE = 5;

    /*  La pochette, en texture Minecraft. */
    private static final Identifier ID_POCHETTE = Identifier.fromNamespaceAndPath("xrnhud", "media");
    private static DynamicTexture texturePochette = null;
    private static long pochetteLue = 0;
    private static int pochetteLargeur = 0;
    private static int pochetteHauteur = 0;

    /*  La duree totale, une fois qu elle est connue. Elle ne doit pas
        bouger : sur un flux en direct, Windows voit la fin avancer, et
        le total grossirait sans fin. On garde la premiere valeur.   */
    private static long dureeStable = 0;
    private static String titreStable = "";

    /*  Le lanceur met a jour le fichier une fois par seconde : sans
        correction, le compteur de gauche sauterait d une seconde a
        l autre, et la barre avancerait par bonds. On interpole donc la
        position entre deux mises a jour, a partir de l instant ou le
        fichier a ete lu. C est ce qui rend le lecteur fluide.        */
    private static long positionLue = 0;
    private static long instantLecture = 0;
    private static boolean enLecture = false;

    private static long dernierLecture = 0;
    private static long derniereVerificationPochette;
    private static boolean disponible = false;
    private static float opacite = 0;

    private Musique() {}

    /* ------------------------------------------------------------------ */
    /*  Lecture du fichier                                                 */
    /* ------------------------------------------------------------------ */

    /**
     * Relit le fichier quand il a change. Une fois par seconde suffit :
     * une position qui avance de dix milliemes ne se voit pas.
     */
    static void suivre() {
        long maintenant = System.currentTimeMillis();
        if (maintenant - dernierLecture < 1000) return;
        dernierLecture = maintenant;

        Path fichier = chemin();
        if (fichier == null) { disponible = false; return; }

        String texte = null;
        try {
            if (Files.exists(fichier) && maintenant - Files.getLastModifiedTime(fichier).toMillis() < 15000) {
                texte = Files.readString(fichier, StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            texte = null;
        }

        if (texte == null || texte.isEmpty()) {
            if (disponible) {
                disponible = false;
                titre = "";
                artiste = "";
                application = "";
                etat = "";
                position = 0;
                duree = 0;
            }
            return;
        }

        try {
            JsonObject o = JsonParser.parseString(texte).getAsJsonObject();
            String t = o.has("titre") ? o.get("titre").getAsString() : "";
            if (t == null || t.isEmpty()) {
                disponible = false;
                titre = "";
                artiste = "";
                return;
            }
            titre = t;
            artiste = o.has("artiste") ? o.get("artiste").getAsString() : "";
            application = o.has("application") ? o.get("application").getAsString() : "";
            etat = o.has("etat") ? o.get("etat").getAsString() : "";
            position = o.has("position") ? o.get("position").getAsLong() : 0;

            /*  La duree totale ne bouge pas. Quand le morceau change,
                on repart de zero ; quand la fin annoncee recule vers
                le direct, on garde la duree connue.                     */
            long annoncee = o.has("duree") ? o.get("duree").getAsLong() : 0;
            if (!(t + "\u0000" + artiste).equals(titreStable)) {
                titreStable = t + "\u0000" + artiste;
                dureeStable = 0;
            }
            if (annoncee > 0) {
                if (dureeStable <= 0) {
                    dureeStable = annoncee;
                } else if (annoncee <= dureeStable + 2000) {
                    dureeStable = annoncee;
                }
            }
            duree = dureeStable;

            /*  On note l instant de la lecture et la position annoncee :
                c est ce qui permet de faire couler le compteur entre
                deux mises a jour du fichier.                              */
            positionLue = position;
            instantLecture = System.currentTimeMillis();
            enLecture = "Playing".equalsIgnoreCase(etat);

            String p = o.has("pochette") ? o.get("pochette").getAsString() : "";
            if (!p.equals(fichierPochette)) {
                fichierPochette = p;
                pochetteLue = 0;
            }
            disponible = true;
        } catch (Exception e) {
            disponible = false;
        }
    }

    /** Le fichier que le launcher a ecrit, si le jeu a ete lance par lui. */
    private static Path chemin() {
        String prop = System.getProperty("XRNMediaFile", "");
        if (prop == null || prop.isEmpty()) return null;
        try {
            return Path.of(prop);
        } catch (Exception e) {
            return null;
        }
    }

    /* ------------------------------------------------------------------ */
    /*  La pochette                                                        */
    /* ------------------------------------------------------------------ */

    /*  La pochette, en texture Minecraft.

        *  La texture par defaut est filtree en "plus proche voisin" :
        *  l'image fait 64 pixels pour 24 a l'ecran, et sans lissage
        *  elle devient un bruit de pixels. On demande donc un
        *  filtrage lineaire, qui adoucit la reduction.                    */
    private static final class TexturePochette extends DynamicTexture {
        TexturePochette(NativeImage image) {
            super(() -> "xrnhud:media", image);
            try {
                this.sampler = RenderSystem.getSamplerCache().getRepeat(FilterMode.LINEAR);
            } catch (Exception e) {
                /*  Le cache des echantillons n'est pas pret : on garde
                    le filtrage par defaut, l'image sera moins nette
                    mais elle s'affichera quand meme.                       */
            }
        }
    }

    /**
     * Charge la pochette si elle a change. Le launcher ecrit un PNG
     * que l on recharge quand il change, pas a chaque image.
     */
    private static void chargerPochette() {
        if (fichierPochette == null || fichierPochette.isEmpty()) return;
        Path chemin = null;
        try {
            chemin = Path.of(fichierPochette);
        } catch (Exception e) {
            return;
        }
        try {
            long modifie = Files.getLastModifiedTime(chemin).toMillis();
            if (modifie == pochetteLue) return;
            NativeImage image;
            try (InputStream in = Files.newInputStream(chemin)) {
                image = NativeImage.read(in);
            }
            Minecraft cl = Minecraft.getInstance();
            if (texturePochette != null && !titre.isEmpty()) {
                cl.getTextureManager().release(ID_POCHETTE);
            }
            texturePochette = new TexturePochette(image);
            cl.getTextureManager().register(ID_POCHETTE, texturePochette);
            pochetteLargeur = image.getWidth();
            pochetteHauteur = image.getHeight();
            pochetteLue = modifie;
        } catch (Exception e) {
            /*  Pochette absente ou illisible : on garde la precedente. */
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Rendu                                                              */
    /* ------------------------------------------------------------------ */

    static void dessiner(GuiGraphicsExtractor c, Font t) {
        Minecraft game = Minecraft.getInstance();
        boolean edition = game.gui.screen() instanceof EcranEdition;
        if (game.player == null || game.gui.hud.isHidden() || (!Hud.visible && !edition)) return;
        boolean joue = visible && ((disponible && !titre.isEmpty()) || edition);
        opacite = Anime.vers(opacite, joue ? 1f : 0f, 0.18f);
        if (opacite < 0.02) return;

        if (joue && System.currentTimeMillis()-derniereVerificationPochette >= 1000) {
            derniereVerificationPochette=System.currentTimeMillis(); chargerPochette();
        }

        double a = Anime.borne(opacite);        Minecraft cl = Minecraft.getInstance();

        /*  Position par defaut : en haut a gauche, ou le jeu n affiche
            presque rien. Le joueur peut la deplacer ensuite.           */
        int defautX = Math.max(4, cl.getWindow().getGuiScaledWidth() - LARGEUR - 6);
        int defautY = 4;
        if(Placement.MUSIQUE.hidden)return;
        int x = Cadres.limiterX(defautX + Placement.MUSIQUE.dx,LARGEUR,Placement.MUSIQUE);
        int y = Cadres.limiterY(defautY + Placement.MUSIQUE.dy,HAUTEUR,Placement.MUSIQUE);
        Cadres.debut(c,Placement.MUSIQUE,x,y);

        /*  L ecran d edition s en sert pour encadrer l element. */
        Cadres.placer(Placement.MUSIQUE.id, defautX, defautY, x, y, LARGEUR, HAUTEUR);

        Theme.cadre(c, x, y, LARGEUR, HAUTEUR,
                Theme.alpha(Theme.PANNEAU, 0.88 * a),
                Theme.alpha(Theme.BORDURE, 0.9 * a));

        /*  Pochette, ou a defaut la marque du client. */
        if (texturePochette != null && !titre.isEmpty()) {
            try {
                /*  On indique la taille reelle de l'image : le bloc
                    affiche toute la pochette, reduite a la taille du
                    bloc, et non un morceau de l'image.                   */
                c.blit(net.minecraft.client.renderer.RenderPipelines.GUI_TEXTURED,
                        ID_POCHETTE, x + MARGE, y + MARGE, 0.0f, 0.0f,
                        TAILLE_POCHETTE, TAILLE_POCHETTE,
                        pochetteLargeur, pochetteHauteur,
                        pochetteLargeur, pochetteHauteur);
            } catch (Exception e) {
                Theme.marque(c, x + MARGE + 7, y + MARGE + 7, 2, (float) a);
            }
        } else {
            Theme.marque(c, x + MARGE + 7, y + MARGE + 7, 2, (float) a);
        }

        /*  La colonne de texte est a droite de la pochette. Elle est
            plus large que la pochette de quelques pixels, et la
            hauteur des lignes est celle de la police du jeu.         */
        int tx = x + MARGE + TAILLE_POCHETTE + 7;
        int ty = y + MARGE;
        int largeurTexte = LARGEUR - (tx - x) - MARGE;

        /*  Titre, puis artiste : une ligne chacun, espacees de la
            hauteur de la police, pour que les jambages et les
            descendantes ne se touchent jamais.                        */
        Theme.texte(c, t, coupe(titre.isEmpty() ? "Musique" : titre, t, largeurTexte), tx, ty,
                Theme.alpha(Theme.TEXTE, a));
        Theme.texte(c, t, coupe(titre.isEmpty() ? "Aucune lecture Windows" : artiste, t, largeurTexte), tx, ty + 10,
                Theme.alpha(Theme.TEXTE_DOUX, a));

        /*  La ligne des temps : le temps ecoule a gauche, la duree
            totale a droite, et la barre de progression entre les deux.
            Le total ne bouge pas : seul le temps ecoule avance.       */
        long pos = positionAffichee();
        String ecoule = duree > 0 ? duree(pos) : "";
        String total = duree > 0 ? duree(duree) : "";
        int largeurEcoule = ecoule.isEmpty() ? 0 : t.width(ecoule);
        int largeurTotal = total.isEmpty() ? 0 : t.width(total);

        int ligneY = ty + 20;
        int barreX = tx + largeurEcoule + (largeurEcoule > 0 ? 4 : 0);
        int barreFin = x + LARGEUR - MARGE - largeurTotal - (largeurTotal > 0 ? 4 : 0);
        int barreL = Math.max(0, barreFin - barreX);
        int barreY = ligneY + 6;
        Theme.rect(c, barreX, barreY, barreL, 2, Theme.alpha(Theme.BORDURE, 1.0 * a));
        if (duree > 0 && barreL > 0) {
            double ratio = Math.max(0, Math.min(1, (double) pos / (double) duree));
            int rempli = (int) (barreL * ratio);
            Theme.rect(c, barreX, barreY, rempli, 2, Theme.alpha(Theme.ACCENT, a));
        }
        if (!ecoule.isEmpty()) {
            Theme.texte(c, t, ecoule, tx, ligneY, Theme.alpha(Theme.TEXTE_FAIBLE, a));
        }
        if (!total.isEmpty()) {
            Theme.texte(c, t, total, x + LARGEUR - MARGE - largeurTotal, ligneY,
                    Theme.alpha(Theme.TEXTE_FAIBLE, a));
        }
        Cadres.fin(c);
    }

    /** Une duree en minutes et secondes. */
    private static String duree(long millisecondes) {
        long total = Math.max(0, millisecondes) / 1000;
        long min = total / 60;
        long sec = total % 60;
        return min + ":" + (sec < 10 ? "0" : "") + sec;
    }

    /**
     * La position affichee, corrigee du temps passe depuis la lecture
     * du fichier.
     *
     * <p>Le lanceur ecrit l etat une fois par seconde. Sans cette
     * correction, le temps affiche saute d une seconde a l autre, et
     * la barre avance par bonds. On ajoute donc le temps ecoule depuis
     * la derniere lecture, tant que la musique joue.
     *
     * <p>On ne va jamais au-dela de la duree totale : au cas ou la
     * piste serait plus courte que ce que le lanceur annonce.
     */
    private static long positionAffichee() {
        if (!enLecture || instantLecture == 0) return positionLue;
        long passe = System.currentTimeMillis() - instantLecture;
        if (passe < 0 || passe > 2000) return positionLue;   /*  le fichier n'est plus a jour */
        long p = positionLue + passe;
        if (dureeStable > 0 && p > dureeStable) p = dureeStable;
        return p;
    }

    /** Coupe un texte trop long pour la place disponible. */
    private static String coupe(String s, Font t, int largeur) {
        if (s == null) return "";
        if (t.width(s) <= largeur) return s;
        String coupe = s;
        while (coupe.length() > 1 && t.width(coupe + "…") > largeur) {
            coupe = coupe.substring(0, coupe.length() - 1);
        }
        return coupe + "…";
    }
}
