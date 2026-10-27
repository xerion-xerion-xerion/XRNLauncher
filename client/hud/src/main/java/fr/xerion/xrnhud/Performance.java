package fr.xerion.xrnhud;

import net.minecraft.client.render.ChunkBuilderMode;
import net.minecraft.client.option.CloudRenderMode;
import net.minecraft.client.option.GraphicsMode;
import net.minecraft.particle.ParticlesMode;
import net.minecraft.client.MinecraftClient;
import com.google.gson.JsonObject;

/**
 * Le mode « Boost FPS ».
 *
 * <p>Un gain d'images par seconde ne vient pas d'une case a cocher
 * magique : il vient de plusieurs leviers tires dans le bon sens. Le
 * mode les actionne tous d'un coup, et sait les rendre exactement
 * comme ils etaient si le joueur le desactive.
 *
 * <p>Ce que le mode touche :
 *
 * <ul>
 *   <li>la distance d'affichage, et la distance de simulation ;
 *   <li>le mode graphique, les particules et les nuages ;
 *   <li>le moteur de lumiere, qui decide ce que le jeu redessine ;
 *   <li>les ombres, le mipmapping, le melange de biomes ;
 *   <li>la transparence amelioree, les feuilles coupees, les eclairs ;
 *   <li>l'anisotropie, la portee de la meteo ;
 *   <li>le plafond d'images par seconde, libere quand le joueur
 *       n'en a pas impose un.
 * </ul>
 *
 * <p>Rien de tout cela ne touche le serveur : c'est de l'affichage.
 * Le joueur voit moins loin et moins detaille, et gagne des images
 * par seconde. C'est un choix, pas une improvement gratuite.
 */
final class Performance {

    /** Le mode est-il demande ? */
    static boolean actif = false;

    /*  Le profil a-t-il deja ete applique ? On ne l'applique qu'une
        fois, et seulement quand le jeu est pret.                       */
    private static boolean applique = false;

    /*  Les valeurs du joueur, pour les lui rendre fidelement. */
    private static int distanceAvant = -1;
    private static int simulationAvant = -1;
    private static GraphicsMode graphiqueAvant = null;
    private static ParticlesMode particulesAvant = null;
    private static CloudRenderMode nuagesAvant = null;
    private static ChunkBuilderMode lumiereAvant = null;
    private static boolean ombresAvant = false;
    private static int mipmapsAvant = -1;
    private static int biomeAvant = -1;
    private static boolean transparenceAvant = false;
    private static boolean feuillesAvant = false;
    private static boolean eclairsAvant = true;
    private static int anisotropieAvant = -1;
    private static int meteoAvant = -1;
    private static int ipsAvant = -1;
    private static boolean vsyncAvant;
    private static Boolean occlusionAvant;
    private static double entitesAvant=-1;
    private static int flouAvant=-1,nuagesDistanceAvant=-1;
    private static net.minecraft.client.option.TextureFilteringMode filtrageAvant;

    private Performance() {}

    /**
     * Le mode demande par le launcher, au lancement du jeu.
     * L'option du joueur dans le menu prime : si le joueur a tranche,
     * on respecte son choix.
     *
     * <p>Attention : au moment ou le mod s'initialise, le jeu n'a pas
     * encore cree ses options. Les toucher ici ferait planter le
     * client au demarrage. On attend donc le premier tick, quand tout
     * existe.
     */
    static void appliquerAuDemarrage() {
        if (applique || !pret()) return;
        applique = true;
        String prop=System.getProperty("XRNBoostFps","");
        if (!Reglages.boostEcrit() && !prop.isEmpty()) actif="1".equals(prop)||"true".equalsIgnoreCase(prop);
        if (actif) appliquer();
        else if (distanceAvant >= 0) restaurer();
    }

    /** Le client a-t-il cree ses options ? */
    private static boolean pret() {
        try {
            return MinecraftClient.getInstance().options != null;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Active ou desactive le mode, et le dit au joueur. */
    static void basculer() {
        actif = !actif;
        if (actif) appliquer();
        else restaurer();
        fr.xerion.xrnhud.Placement.sauver();
    }

    /**
     * Applique le profil.
     *
     * <p>Les valeurs du joueur sont memorisees une seule fois : le
     * mode peut etre reactive sans pour autant perdre l'original.
     */
    static void appliquer() {
        if (!pret()) return;
        if (distanceAvant < 0) {memoriser();Placement.sauver();}
        Options.distance(Math.min(distanceAvant,8));
        Options.simulation(Math.min(simulationAvant,5));

        Options.particules(ParticlesMode.MINIMAL);
        Options.nuages(CloudRenderMode.OFF);

        Options.ombres(false);




        Options.eclairs(false);

        Options.meteo(3);
        /*  Un plafond d images par seconde laisse la carte respirer. */
        Options.ipsMax(ipsAvant>0?ipsAvant:260);
        MinecraftClient.getInstance().options.getEnableVsync().setValue(false);
    }

    /** Rend au joueur exactement les reglages qu il avait. */
    static void restaurer() {
        if (distanceAvant < 0) return;
        if (!pret()) return;
        boolean reload=(mipmapsAvant>=0&&Options.mipmaps()!=mipmapsAvant)||(filtrageAvant!=null&&Options.filtrage()!=filtrageAvant);
        if (graphiqueAvant != null) Options.graphisme(graphiqueAvant);
        Options.distance(distanceAvant);
        Options.simulation(simulationAvant);
        if (particulesAvant != null) Options.particules(particulesAvant);
        if (nuagesAvant != null) Options.nuages(nuagesAvant);
        if (lumiereAvant != null) Options.lumiere(lumiereAvant);
        Options.ombres(ombresAvant);
        if (mipmapsAvant >= 0) Options.mipmaps(mipmapsAvant);
        if (biomeAvant >= 0) Options.biome(biomeAvant);
        Options.transparence(transparenceAvant);
        Options.feuilles(feuillesAvant);
        Options.eclairs(eclairsAvant);
        if (anisotropieAvant >= 0) Options.anisotropie(anisotropieAvant);
        if (meteoAvant >= 0) Options.meteo(meteoAvant);
        if (ipsAvant >= 0) Options.ipsMax(ipsAvant);
        MinecraftClient.getInstance().options.getEnableVsync().setValue(vsyncAvant);
        if(occlusionAvant!=null)Options.occlusion(occlusionAvant);
        if(entitesAvant>=0)Options.distanceEntites(entitesAvant);
        if(flouAvant>=0)Options.flouMenu(flouAvant);
        if(nuagesDistanceAvant>=0)Options.distanceNuages(nuagesDistanceAvant);
        if(filtrageAvant!=null)Options.filtrage(filtrageAvant);
        distanceAvant = -1;
        enregistrerGraphismes(reload);
    }

    static void reparerTextures(){
        // Explicit recovery for old versions that did not keep a snapshot.
        actif=false;restaurer();Options.mipmaps(4);Options.graphisme(GraphicsMode.FANCY);
        Options.feuilles(false);Options.biome(2);Options.anisotropie(1);
        enregistrerGraphismes(true);Reglages.boostNote();Placement.sauver();
    }
    private static void enregistrerGraphismes(boolean reload){
        var cl=MinecraftClient.getInstance();
        cl.options.write();
        if(reload)cl.reloadResources();
    }
    private static void memoriser() {
        occlusionAvant=Options.occlusion();entitesAvant=Options.distanceEntites();flouAvant=Options.flouMenu();nuagesDistanceAvant=Options.distanceNuages();filtrageAvant=Options.filtrage();
        distanceAvant = Options.distance();
        simulationAvant = Options.simulation();
        graphiqueAvant = Options.graphisme();
        particulesAvant = Options.particules();
        nuagesAvant = Options.nuages();
        lumiereAvant = Options.lumiere();
        ombresAvant = Options.ombres();
        mipmapsAvant = Options.mipmaps();
        biomeAvant = Options.biome();
        transparenceAvant = Options.transparence();
        feuillesAvant = Options.feuilles();
        eclairsAvant = Options.eclairs();
        anisotropieAvant = Options.anisotropie();
        meteoAvant = Options.meteo();
        ipsAvant = Options.ipsMax();
        vsyncAvant = MinecraftClient.getInstance().options.getEnableVsync().getValue();
    }

    static void sauvegarder(JsonObject root) {
        if (distanceAvant < 0) { root.remove("performanceAvant"); return; }
        JsonObject values = new JsonObject();
        if(occlusionAvant!=null)values.addProperty("occlusionAvant",occlusionAvant);
        if(entitesAvant>=0)values.addProperty("entitesAvant",entitesAvant);
        if(flouAvant>=0)values.addProperty("flouAvant",flouAvant);
        if(nuagesDistanceAvant>=0)values.addProperty("nuagesDistanceAvant",nuagesDistanceAvant);
        if(filtrageAvant!=null)values.addProperty("filtrageAvant",filtrageAvant.name());
        values.addProperty("distanceAvant", distanceAvant);
        values.addProperty("simulationAvant", simulationAvant);
        values.addProperty("ombresAvant", ombresAvant);
        values.addProperty("mipmapsAvant", mipmapsAvant);
        values.addProperty("biomeAvant", biomeAvant);
        values.addProperty("transparenceAvant", transparenceAvant);
        values.addProperty("feuillesAvant", feuillesAvant);
        values.addProperty("eclairsAvant", eclairsAvant);
        values.addProperty("anisotropieAvant", anisotropieAvant);
        values.addProperty("meteoAvant", meteoAvant);
        values.addProperty("ipsAvant", ipsAvant);
        values.addProperty("vsyncAvant", vsyncAvant);
        if (graphiqueAvant != null) values.addProperty("graphiqueAvant", graphiqueAvant.name());
        if (particulesAvant != null) values.addProperty("particulesAvant", particulesAvant.name());
        if (nuagesAvant != null) values.addProperty("nuagesAvant", nuagesAvant.name());
        if (lumiereAvant != null) values.addProperty("lumiereAvant", lumiereAvant.name());
        root.add("performanceAvant",values);
    }
    static void charger(JsonObject root) {
        if (!root.has("performanceAvant")) return;
        try { JsonObject values=root.getAsJsonObject("performanceAvant");
            occlusionAvant=values.has("occlusionAvant")?values.get("occlusionAvant").getAsBoolean():null;
            entitesAvant=values.has("entitesAvant")?values.get("entitesAvant").getAsDouble():-1;
            flouAvant=values.has("flouAvant")?values.get("flouAvant").getAsInt():-1;
            nuagesDistanceAvant=values.has("nuagesDistanceAvant")?values.get("nuagesDistanceAvant").getAsInt():-1;
            filtrageAvant=values.has("filtrageAvant")?net.minecraft.client.option.TextureFilteringMode.valueOf(values.get("filtrageAvant").getAsString()):null;
            if (values.has("distanceAvant")) distanceAvant=values.get("distanceAvant").getAsInt();
            if (values.has("simulationAvant")) simulationAvant=values.get("simulationAvant").getAsInt();
            if (values.has("ombresAvant")) ombresAvant=values.get("ombresAvant").getAsBoolean();
            if (values.has("mipmapsAvant")) mipmapsAvant=values.get("mipmapsAvant").getAsInt();
            if (values.has("biomeAvant")) biomeAvant=values.get("biomeAvant").getAsInt();
            if (values.has("transparenceAvant")) transparenceAvant=values.get("transparenceAvant").getAsBoolean();
            if (values.has("feuillesAvant")) feuillesAvant=values.get("feuillesAvant").getAsBoolean();
            if (values.has("eclairsAvant")) eclairsAvant=values.get("eclairsAvant").getAsBoolean();
            if (values.has("anisotropieAvant")) anisotropieAvant=values.get("anisotropieAvant").getAsInt();
            if (values.has("meteoAvant")) meteoAvant=values.get("meteoAvant").getAsInt();
            if (values.has("ipsAvant")) ipsAvant=values.get("ipsAvant").getAsInt();
            if (values.has("vsyncAvant")) vsyncAvant=values.get("vsyncAvant").getAsBoolean();
            if (values.has("graphiqueAvant")) graphiqueAvant=GraphicsMode.valueOf(values.get("graphiqueAvant").getAsString());
            if (values.has("particulesAvant")) particulesAvant=ParticlesMode.valueOf(values.get("particulesAvant").getAsString());
            if (values.has("nuagesAvant")) nuagesAvant=CloudRenderMode.valueOf(values.get("nuagesAvant").getAsString());
            if (values.has("lumiereAvant")) lumiereAvant=ChunkBuilderMode.valueOf(values.get("lumiereAvant").getAsString());
        } catch (RuntimeException ignored) { distanceAvant=-1; }
    }

    /** Une ligne d'aide, pour le menu. */
    static String resume() {
        if (!actif) return "Desactive : le jeu est tel que tu l'as regle.";
        return "FPS Plus : distances et particules reduites, textures conservees.";
    }
}
