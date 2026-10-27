package fr.xerion.xrnhud;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import net.minecraft.resources.Identifier;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Les cosmetiques du client, et celui que le joueur porte.
 *
 * <p>Ce que le joueur possede est decide par le serveur : le launcher
 * va chercher ses droits et les ecrit dans un fichier, que le mod lit
 * au demarrage. Le mod ne peut donc pas s'attribuer un cosmetique
 * lui-meme, et un droit reste valable sur toutes les machines du
 * meme compte.
 *
 * <p>Le choix du cosmetique porte, en revanche, est personnel : il
 * est memorise dans les reglages du mod, comme le reste.
 */
public final class Droits {

    private static final Logger LOGGER = LoggerFactory.getLogger("XRN HUD");

    /** Un cosmetique du catalogue. */
    public static final class Cosmetique {
        public final String id;
        public final String nom;
        public final String type;
        public final int etoiles;
        public final String couleur;
        /**  Est-ce offert ? La cape de l auteur ne coute rien. */
        public final boolean offert;

        Cosmetique(String id, String nom, String type, int etoiles, String couleur, boolean offert) {
            this.id = id;
            this.nom = nom;
            this.type = type;
            this.etoiles = etoiles;
            this.couleur = couleur;
            this.offert = offert;
        }
    }

    /*  Le catalogue. Il reprend celui du serveur, pour que le menu
        sache nommer les cosmetiques qu il affiche. Le serveur reste
        la seule source de verite pour ce qu on possede.

        Un seul type de cosmetique, pour l instant : les capes. La
        cape de l auteur est offerte, les autres se paient.              */
    public static final List<Cosmetique> CATALOGUE = List.of(
            new Cosmetique("cape_xrn", "Cape XRN", "cape", 0, "#7b5cff", true),
            new Cosmetique("cape_aurore", "Cape Glacier", "cape", 120, "#9de8ff", false),
            new Cosmetique("cape_braises", "Cape Com\u00e8te", "cape", 160, "#ff9a5a", false)
    );

    /** La texture d un cosmetique, ou null s'il n en a pas. */
    public static Identifier texture(String id) {
        if (id == null) return null;
        switch (id) {
            case "cape_xrn": return Identifier.fromNamespaceAndPath("xrnhud", "textures/cape_xrn.png");
            case "cape_aurore": return Identifier.fromNamespaceAndPath("xrnhud", "textures/cape_aurore.png");
            case "cape_braises": return Identifier.fromNamespaceAndPath("xrnhud", "textures/cape_braises.png");
            default: return null;
        }
    }

    private static final Set<String> ACQUIS = new LinkedHashSet<>();
    private static String equipe = "";
    private static int etoiles = 0;

    private Droits() {}

    /**
     * Lit les droits ecrits par le launcher.
     *
     * <p>Le fichier est sur le disque, pas sur le reseau : le jeu
     * demarre meme sans connexion, et le mod n'a aucun besoin
     * d'appeler le serveur lui-meme.
     */
    static void charger() {
        ACQUIS.clear();
        String chemin = cheminFichier();
        if (chemin == null || chemin.isEmpty()) {
            LOGGER.info("Droits : aucun fichier trouve (ni la propriete, ni le dossier du jeu)");
            return;
        }
        try {
            Path fichier = Path.of(chemin);
            if (!Files.exists(fichier)) {
                LOGGER.info("Droits : fichier absent (" + chemin + ")");
                return;
            }
            String texte = Files.readString(fichier, StandardCharsets.UTF_8);
            /*  Les outils de Windows ecrivent parfois une marque d ordre
                des octets en tete de fichier. Le parseur JSON la
                refuse : on l enleve plutot que de perdre les droits.  */
            if (texte.startsWith("?")) texte = texte.substring(1);
            JsonElement racine = JsonParser.parseString(texte);
            if (!racine.isJsonObject()) {
                LOGGER.info("Droits : le fichier ne contient pas un objet JSON");
                return;
            }
            JsonObject o = racine.getAsJsonObject();
            if (o.has("droits") && o.get("droits").isJsonArray()) {
                JsonArray liste = o.getAsJsonArray("droits");
                for (JsonElement e : liste) {
                    if (e == null || !e.isJsonPrimitive()) continue;
                    String id = e.getAsString().trim();
                    if (!id.isEmpty()) ACQUIS.add(id);
                }
            }
            if (o.has("etoiles")) etoiles = o.get("etoiles").getAsInt();
            LOGGER.info("Droits : " + ACQUIS.size() + " cosmetique(s) charge(s) depuis " + chemin);
        } catch (IOException | RuntimeException e) {
            /*  Un fichier illisible n emporte pas le jeu, mais on veut
                savoir pourquoi : c est le genre de panne qu on ne voit
                pas venir.                                                    */
            LOGGER.warn("Droits : fichier illisible (" + chemin + ") : " + e);
        }
    }

    /**
     * Ou se trouve le fichier des droits.
     *
     * <p>Deux facons de le savoir. La premiere : le launcher le passe
     * en propriete du systeme. La seconde : le jeu tourne dans le
     * dossier du jeu, et le launcher range ses fichiers juste au-dessus.
     * On tente les deux, pour ne pas dependre de la premiere seule.
     */
    private static String cheminFichier() {
        String prop = System.getProperty("DXRNDroits", "");
        if (prop != null && !prop.isEmpty()) return prop;
        try {
            java.nio.file.Path jeu = java.nio.file.Path.of(System.getProperty("user.dir", ""));
            java.nio.file.Path parent = jeu.getParent();
            if (parent == null) return "";
            java.nio.file.Path fichier = parent.resolve("droits.json");
            return Files.exists(fichier) ? fichier.toString() : "";
        } catch (RuntimeException e) {
            return "";
        }
    }

    /** Le joueur possede-t-il ce cosmetique ? */
    public static boolean possede(String id) {
        return id != null && ACQUIS.contains(id);
    }

    /** Les cosmetiques que le joueur possede, dans l ordre du catalogue. */
    public static List<Cosmetique> acquis() {
        List<Cosmetique> out = new ArrayList<>();
        for (Cosmetique c : CATALOGUE) {
            if (possede(c.id)) out.add(c);
        }
        return out;
    }

    /** Le cosmetique porte. Une chaine vide : rien d equipe. */
    public static String equipe() {
        return equipe;
    }

    /**
     * Equipe un cosmetique, ou retire l'equipement si l id est vide.
     * On ne peut pas equiper ce qu on n'a pas.
     */
    public static void equiper(String id) {
        String n = id == null ? "" : id.trim();
        if (!n.isEmpty() && !possede(n)) return;
        equipe = n;
        Placement.sauver();
    }

    /** Note l'equipement choisi, a la lecture des reglages. */
    public static void memoriserEquipe(String id) {
        String n = id == null ? "" : id.trim();
        equipe = (!n.isEmpty() && possede(n)) ? n : "";
    }

    /** Le solde d etoiles, pour l afficher. */
    public static int etoiles() {
        return etoiles;
    }

    /** Le nom d un cosmetique, pour l afficher. */
    public static String nom(String id) {
        for (Cosmetique c : CATALOGUE) {
            if (c.id.equals(id)) return c.nom;
        }
        return id;
    }
}
