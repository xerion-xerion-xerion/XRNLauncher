package fr.xerion.xrnhud;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import net.fabricmc.loader.api.FabricLoader;

/**
 * Position des elements deplacables du HUD.
 *
 * <p>Comme sur un client professionnel : on ne regle pas une position
 * dans un menu, on deplace l element a la souris. Chaque element garde
 * un decalage par rapport a sa position habituelle, et ce decalage est
 * memorise sur la machine.
 */
final class Placement {

    /** Un element que le joueur peut deplacer. */
    static final class Element {
        final String id;
        int dx = 0;
        int dy = 0;
        float scale = 1f;
        boolean hidden;

        Element(String id) {
            this.id = id;
        }
    }

    static final Element XRN = new Element("xrn");
    static final Element TOUCHES = new Element("touches");
    static final Element EQUIPEMENT = new Element("equipement");
    static final Element POTIONS = new Element("potions");
    static final Element SCOREBOARD = new Element("scoreboard");
    static final Element MUSIQUE = new Element("musique");
    static final Element VITESSE = new Element("vitesse");
    static final Element HEURE = new Element("heure");
    static final Element MEMOIRE = new Element("memoire");

    static final Element UTILITAIRES = new Element("utilitaires");

    private static final Map<String, Element> TOUS = new LinkedHashMap<>();

    static {
        for(Element e:new Element[]{ModulesPlus.SAC,ModulesPlus.TOTEMS,ModulesPlus.JOURS,ModulesPlus.PING,ModulesPlus.JOUEURS,ModulesPlus.SHADERS})TOUS.put(e.id,e);
        TOUS.put(UTILITAIRES.id, UTILITAIRES);
        TOUS.put(XRN.id, XRN);
        TOUS.put(TOUCHES.id, TOUCHES);
        TOUS.put(EQUIPEMENT.id, EQUIPEMENT);
        TOUS.put(POTIONS.id, POTIONS);
        TOUS.put(SCOREBOARD.id, SCOREBOARD);
        TOUS.put(MUSIQUE.id, MUSIQUE);
        TOUS.put(VITESSE.id, VITESSE);
        TOUS.put(HEURE.id, HEURE);
        TOUS.put(MEMOIRE.id, MEMOIRE);
    }

    private Placement() {}

    static Iterable<Element> elements() {
        return TOUS.values();
    }

    static Element parId(String id) {
        return TOUS.get(id);
    }

    /* ------------------------------------------------------------------ */
    /*  Memorisation                                                       */
    /* ------------------------------------------------------------------ */

    private static Path fichier() {
        try {
            return FabricLoader.getInstance().getConfigDir().resolve("xrnhud.json");
        } catch (Throwable t) {
            return null;
        }
    }

    static void charger() {
        Path f = fichier();
        if (f == null || !Files.exists(f)) return;
        try {
            String texte = Files.readString(f, StandardCharsets.UTF_8);
            JsonObject racine = new Gson().fromJson(texte, JsonObject.class);
            if (racine == null) return;
            for (Element e : TOUS.values()) {
                if (!racine.has(e.id)) continue;
                JsonObject o = racine.getAsJsonObject(e.id);
                if (o == null) continue;
                if (o.has("dx")) e.dx = o.get("dx").getAsInt();
                if (o.has("dy")) e.dy = o.get("dy").getAsInt();
                if(o.has("scale")) {float v=o.get("scale").getAsFloat();e.scale=Float.isFinite(v)?Math.max(.5f,Math.min(3f,v)):1f;}
                if(o.has("hidden"))e.hidden=o.get("hidden").getAsBoolean();
            }
            /*  Les reglages du mod sont dans le meme fichier. */
            if (racine.has("reglages")) {
                Reglages.appliquer(racine.getAsJsonObject("reglages"));
            }
        } catch (Throwable t) {
            /*  Un fichier de position illisible ne doit pas empecher le
                jeu de demarrer : on repart des positions par defaut.  */
        }
    }

    /** Remet tous les elements a leur place d origine. */
    static void reinitialiser() {
        for (Element e : TOUS.values()) {
            e.dx = 0;
            e.dy = 0; e.scale=1f;e.hidden=false;
        }
        sauver();
    }

    static void sauver() {
        Path f = fichier();
        if (f == null) return;
        try {
            JsonObject racine = new JsonObject();
            for (Element e : TOUS.values()) {
                JsonObject o = new JsonObject();
                o.addProperty("dx", e.dx);
                o.addProperty("dy", e.dy);
                o.addProperty("scale",e.scale);o.addProperty("hidden",e.hidden);
                racine.add(e.id, o);
            }
            /*  Les reglages du mod, dans le meme fichier. */
            JsonObject reglages = new JsonObject();
            Reglages.ecrire(reglages);
            racine.add("reglages", reglages);
            Files.createDirectories(f.getParent());
            Path tmp=f.resolveSibling(f.getFileName()+".tmp");
            Files.writeString(tmp,new Gson().toJson(racine),StandardCharsets.UTF_8);
            try{Files.move(tmp,f,java.nio.file.StandardCopyOption.REPLACE_EXISTING,java.nio.file.StandardCopyOption.ATOMIC_MOVE);}catch(java.nio.file.AtomicMoveNotSupportedException ex){Files.move(tmp,f,java.nio.file.StandardCopyOption.REPLACE_EXISTING);}
        } catch (IOException | RuntimeException t) {
            /*  Position non memorisee : ce n est pas grave. */
        }
    }
}