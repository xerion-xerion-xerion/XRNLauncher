package fr.xerion.xrnhud;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * Les joueurs dont on sait qu'ils utilisent ce client.
 *
 * <p>Le client seul ne peut pas savoir qui d'autre a le mod : le
 * serveur ne transmet pas cette information, et rien dans le
 * protocole de Minecraft ne permet de la demander. Il faut donc un
 * relais, et ce relais est l'annuaire en ligne du launcher.
 *
 * <p>L'annuaire ne contient qu'une chose : un pseudo de jeu. C'est
 * une information publique dans Minecraft, et c'est exactement ce
 * qu'on veut voir a cote d'un nom. Ni identifiant de compte, ni
 * jeton, ni adresse : l'annuaire ne sait rien d'autre de ses
 * membres, et ne peut donc rien divulguer.
 *
 * <p>Deux sources alimentent la liste :
 *
 * <ul>
 *   <li>l'annuaire en ligne, ecrit par le launcher dans un fichier ;
 *   <li>la liste declarative du joueur, dans la configuration du mod.
 * </ul>
 *
 * <p>Les deux se cumulent. Si l'annuaire est hors ligne, la liste
 * declaree suffit ; si le joueur ne declare personne, l'annuaire
 * suffit. Le logo apparait donc dans tous les cas.
 */
public final class Connus {

    private static final java.util.Map<String,Long> PRIME=new java.util.HashMap<>();private static final java.util.Map<String,String> CAPE_HASH=new java.util.HashMap<>();
    public static boolean prime(java.util.UUID id){return id!=null&&PRIME.getOrDefault(id.toString().replace("-", ""),0L)>System.currentTimeMillis();}
    public static String hashCape(String id){return CAPE_HASH.get(id);}
    private static final java.util.Map<String,NameTag.Profil> STYLES=new java.util.HashMap<>();
    public static NameTag.Profil style(java.util.UUID uuid){return uuid==null?null:STYLES.get(uuid.toString().replace("-", "").toLowerCase(Locale.ROOT));}
    private static final Set<String> PSEUDOS = new LinkedHashSet<>();
    /** Ce que chaque joueur porte : un pseudo, et son cosmetique. */
    private static final java.util.Map<String, String> COSMÉTIQUES = new java.util.HashMap<>();
    /** Ce que le joueur a declare lui-meme : il doit pouvoir l'editer. */
    private static final Set<String> DECLARES = new LinkedHashSet<>();

    private Connus() {}

    /** Remplace la liste declaree par celle lue dans la configuration. */
    public static void charger(String liste) {
        DECLARES.clear();
        if (liste == null || liste.isEmpty()) return;
        for (String partie : liste.split("[,;\\n]")) {
            String nom = partie.trim();
            if (!nom.isEmpty()) DECLARES.add(nom.toLowerCase(Locale.ROOT));
        }
        recomposer();
    }

    /**
     * L'annuaire en ligne : le fichier ecrit par le launcher.
     *
     * <p>Le launcher y met la liste des pseudos connus. Le mod la lit
     * au demarrage, sans jamais appeler le reseau lui-meme : le jeu
     * demarre meme sans connexion, et la liste du disque est toujours
     * la derniere connue.
     */
    private static final java.util.Set<String> UUIDS = new java.util.HashSet<>();
    public static boolean contient(java.util.UUID uuid, String nom) {
        return uuid != null && UUIDS.contains(uuid.toString().replace("-", "").toLowerCase(Locale.ROOT));
    }
    public static void chargerAnnuaire() {
        ANNUAIRE.clear(); UUIDS.clear(); COSMÉTIQUES.clear(); STYLES.clear(); PRIME.clear();CAPE_HASH.clear();
        String file=System.getProperty("XRNCommunaute", "");
        if (!file.isEmpty()) {
            try {
                if(Files.size(Path.of(file))>512*1024)return;
                JsonObject root=JsonParser.parseString(Files.readString(Path.of(file),StandardCharsets.UTF_8)).getAsJsonObject();
                if (root.has("version") && root.get("version").getAsInt()==2 && root.has("pseudos")) {
                    for(JsonElement value:root.getAsJsonArray("pseudos")) {
                        JsonObject player=value.getAsJsonObject();
                        if (!player.has("verified") || !player.get("verified").getAsBoolean() || !player.has("expiresAt") || player.get("expiresAt").getAsLong()<=System.currentTimeMillis()) continue;
                        String uuid=player.get("uuid").getAsString().toLowerCase(Locale.ROOT);
                        if (!uuid.matches("[a-f0-9]{32}")) continue;
                        UUIDS.add(uuid);
                        boolean prime=false;try{var p=player.getAsJsonObject("prime");long end=p.get("until").getAsLong();prime=p.get("active").getAsBoolean()&&end>System.currentTimeMillis();if(prime)PRIME.put(uuid,Math.min(end,player.get("expiresAt").getAsLong()));}catch(RuntimeException ignored){}
                        String cape=player.has("cosmetic")?player.get("cosmetic").getAsString():"";
                        if(java.util.List.of("cape_space","cape_job","cape_scream","cape_spine","cape_crimson","cape_eclipse","cape_rose","cape_seraphine","cape_moonlight").contains(cape))COSMÉTIQUES.put(uuid,cape);
                        if(prime&&cape.matches("prime_[a-f0-9]{32}")&&player.has("customCape")){try{var info=player.getAsJsonObject("customCape");String sha=info.get("sha256").getAsString();if(cape.equals(info.get("id").getAsString())&&sha.matches("[a-f0-9]{64}")){COSMÉTIQUES.put(uuid,cape);CAPE_HASH.put(cape,sha);}}catch(RuntimeException ignored){}}
                        if(player.has("style")&&player.get("style").isJsonObject()){
                            var style=player.getAsJsonObject("style");
                            try{STYLES.put(uuid,new NameTag.Profil(style.has("enabled")&&style.get("enabled").getAsBoolean(),!style.has("badge")||style.get("badge").getAsBoolean(),!style.has("gradient")||style.get("gradient").getAsBoolean(),false,0xFF000000|(style.get("start").getAsInt()&0xFFFFFF),0xFF000000|(style.get("end").getAsInt()&0xFFFFFF),style.has("animate")&&style.get("animate").getAsBoolean(),style.has("rainbow")&&style.get("rainbow").getAsBoolean()));}catch(RuntimeException ignored){}
                        }
                        ANNUAIRE.add(player.get("pseudo").getAsString().toLowerCase(Locale.ROOT));
                    }
                }
            } catch(IOException | RuntimeException ignored) { }
        }
        recomposer();
    }

    /** La liste declaree, prete a etre ecrite dans la configuration. */
    public static String liste() {
        return String.join(", ", DECLARES);
    }

    /** Le nombre total de joueurs connus, pour l'afficher dans le menu. */
    public static int taille() {
        return PSEUDOS.size();
    }

    /** Le nombre de joueurs venus de l'annuaire en ligne. */
    public static int tailleAnnuaire() {
        return PSEUDOS.size() - DECLARES.size();
    }

    /**
     * Ce joueur fait-il partie de ceux que l'on sait equipes ?
     * La comparaison ignore la casse : un pseudo peut s'ecrire
     * autrement d'un serveur a l'autre.
     */
    public static boolean contient(String nom) {
        if (nom == null || nom.isEmpty()) return false;
        return PSEUDOS.contains(nom.toLowerCase(Locale.ROOT));
    }

    /**
     * Le cosmetique que porte ce joueur de la communaute.
     *
     * <p>C'est ce qui rend la garde-robe jouable a plusieurs : un
     * joueur voit la cape d un autre joueur du client, sans que le
     * serveur de jeu ait a transmettre quoi que ce soit.
     *
     * <p>Une chaine vide : ce joueur ne porte rien de connu.
     */
    public static String cosmetique(java.util.UUID uuid) {
        return uuid==null?"":COSMÉTIQUES.getOrDefault(uuid.toString().replace("-", "").toLowerCase(Locale.ROOT),"");
    }

    /** Regroupe les deux sources apres un changement de l'une d'elles. */
    private static void recomposer() {
        PSEUDOS.clear();
        /*  La liste declaree en tete : c'est celle que le joueur a
            ecrite, elle passe avant.                                      */
        PSEUDOS.addAll(DECLARES);
        PSEUDOS.addAll(ANNUAIRE);
    }

    /** L'annuaire en ligne, separe de la liste declaree. */
    private static final Set<String> ANNUAIRE = new LinkedHashSet<>();
}
