package fr.xerion.xrnhud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.CloudRenderMode;
import net.minecraft.client.option.GameOptions;
import net.minecraft.client.option.GraphicsMode;
import net.minecraft.client.render.ChunkBuilderMode;
import net.minecraft.particle.ParticlesMode;

/**
 * Tous les reglages, pris en main sur place.
 *
 * <p>Aucune commande a taper, aucun mod a telecharger : on modifie
 * l'option existante du client, le jeu s'en souvient, et le joueur
 * peut tout refaire depuis son propre menu Options.
 */
final class Options {

    private Options() {}

    static GameOptions opts() {
        return MinecraftClient.getInstance().options;
    }

    /* --- luminosite : exactement ce que fait deja le curseur natif --- */
    static final double[] LUMINOSITES = { 0.0, 0.5, 0.8, 1.0 };
    static final String[] LUMINOSITES_NOMS = { "Sombre", "Basse", "Haute", "Pleine" };

    static double luminosite() { return opts().getGamma().getValue(); }
    static void luminosite(double v) { opts().getGamma().setValue(v); }

    /* --- effet d'obscurité dans les endroits sombres --- */
    static final double[] OBSCURITES = { 0.0, 0.5, 1.0 };
    static final String[] OBSCURITES_NOMS = { "Normal", "Atre", "Supprime" };

    static double obscurite() { return opts().getDarknessEffectScale().getValue(); }
    static void obscurite(double v) { opts().getDarknessEffectScale().setValue(v); }

    /* --- champ de vision : un entier dans cette version du jeu --- */
    static final int[] FOVS = { 60, 70, 80, 90, 100, 110 };

    static int champDeVision() { return opts().getFov().getValue(); }
    static void champDeVision(int v) { opts().getFov().setValue(v); }

    /* --- distance d'affichage --- */
    static final int[] DISTANCES = { 2, 4, 6, 8, 12, 16, 24, 32 };

    static int distance() { return opts().getViewDistance().getValue(); }
    static void distance(int v) { opts().getViewDistance().setValue(v); }

    /* --- distance de simulation : chargeur de la partie, invisible --- */
    static final int[] SIMULATIONS = { 2, 4, 6, 8, 10, 12, 16 };

    static int simulation() { return opts().getSimulationDistance().getValue(); }
    static void simulation(int v) { opts().getSimulationDistance().setValue(v); }

    /* --- echelle de l'interface --- */
    static final int[] ECHELLES = { 0, 1, 2, 3, 4 };
    static final String[] ECHELLES_NOMS = { "Auto", "Petite", "Normale", "Grande", "Tres grande" };

    static int echelle() { return opts().getGuiScale().getValue(); }
    static void echelle(int v) { opts().getGuiScale().setValue(v); }

    /* --- bascule tout ou rien --- */
    static boolean balancement() { return Boolean.TRUE.equals(opts().getBobView().getValue()); }
    static void balancement(boolean v) { opts().getBobView().setValue(v); }

    static boolean secousses() { return opts().getDamageTiltStrength().getValue() > 0.0; }
    static void secousses(boolean v) { opts().getDamageTiltStrength().setValue(v ? 1.0 : 0.0); }

    static boolean vignette() { return Boolean.TRUE.equals(opts().getVignette().getValue()); }
    static void vignette(boolean v) { opts().getVignette().setValue(v); }

    /* --- course maintenue : plus besoin de garder la touche enfoncee --- */
    static boolean course() { return Boolean.TRUE.equals(opts().getSprintToggled().getValue()); }
    static void course(boolean v) { opts().getSprintToggled().setValue(v); }

    /* --- saut automatique : comme le mode des ladders d'un jeu d'arcade.
           0 = aucun plafond, la valeur la plus haute = jamais.          */
    static final int[] SAUTS = { 0, 1, 2, 3, 4, 5 };
    static final String[] SAUTS_NOMS = { "Illimite", "60 cm", "55 cm", "50 cm", "45 cm", "40 cm" };

    static boolean sautAuto() { return opts().getAutoJump().getValue(); }
    static void sautAuto(boolean v) { opts().getAutoJump().setValue(v); }

    /* --- plafond d'images par seconde : 0 = aucune limite. C'est le
           reglage qui fait gagner le plus sur une petite carte.         */
    static final int[] IPS_MAX = { 0, 30, 60, 120, 144, 240, 300 };

    static int ipsMax() { return opts().getMaxFps().getValue(); }
    static void ipsMax(int v) { opts().getMaxFps().setValue(v); }

    /* --- vitesse a laquelle le champ de vision revient apres un effet */
    static final double[] FOV_EFFETS = { 0.0, 0.5, 1.0, 2.0, 4.0 };
    static final String[] FOV_EFFETS_NOMS = { "Fixe", "Lent", "Normal", "Rapide", "Instantane" };

    static double effetFov() { return opts().getFovEffectScale().getValue(); }
    static void effetFov(double v) { opts().getFovEffectScale().setValue(v); }

    /* --- opacite du chat --- */
    static final double[] CHATS = { 0.0, 0.25, 0.5, 0.75, 1.0 };
    static final String[] CHATS_NOMS = { "Transparent", "Leger", "Moyen", "Fort", "Opaque" };

    static double chat() { return opts().getChatOpacity().getValue(); }
    static void chat(double v) { opts().getChatOpacity().setValue(v); }

    /* --- flou derriere les menus du jeu --- */
    static final int[] FLOUS = { 0, 2, 6, 12 };
    static final String[] FLOUS_NOMS = { "Aucun", "Leger", "Moyen", "Fort" };

    static int flou() { return opts().getMenuBackgroundBlurriness().getValue(); }
    static void flou(int v) { opts().getMenuBackgroundBlurriness().setValue(v); }

    static boolean ombres() { return Boolean.TRUE.equals(opts().getEntityShadows().getValue()); }
    static void ombres(boolean v) { opts().getEntityShadows().setValue(v); }

    /* --- opacite du voile derriere le menu --- */
    static final double[] VOILES = { 0.0, 0.35, 0.6, 0.8 };
    static final String[] VOILES_NOMS = { "Aucun", "Leger", "Moyen", "Fort" };

    static double voile() { return Hud.voileMenu; }
    static void voile(double v) { Hud.voileMenu = v; }

    /* --- niveaux de mipmapping : le levier de performance le plus net.
           Le jeu rend les textures a plusieurs resolutions ; en choisir
           une seule economise de la memoire video, au prix du flou des
           textures vues de loin.                                           */
    static final int[] MIPMAPS = { 0, 2, 3, 4 };
    static final String[] MIPMAPS_NOMS = { "Aucun", "Bas", "Moyen", "Haut" };

    static int mipmaps() { return opts().getMipmapLevels().getValue(); }
    static void mipmaps(int v) { opts().getMipmapLevels().setValue(v); }

    /* --- mode graphique : c est le gros levier du jeu, avec le mode
           rapide qui coupe les lumieres, les nuages et les faces.        */
    static final GraphicsMode[] GRAPHISMES = { GraphicsMode.FANCY, GraphicsMode.FAST };
    static final String[] GRAPHISMES_NOMS = { "Beau", "Rapide" };

    static GraphicsMode graphisme() { return opts().getPreset().getValue(); }
    static void graphisme(GraphicsMode v) { opts().getPreset().setValue(v); }

    /* --- particules --- */
    static final ParticlesMode[] PARTICULES = { ParticlesMode.ALL, ParticlesMode.DECREASED, ParticlesMode.MINIMAL };
    static final String[] PARTICULES_NOMS = { "Toutes", "Reduites", "Minimales" };

    static ParticlesMode particules() { return opts().getParticles().getValue(); }
    static void particules(ParticlesMode v) { opts().getParticles().setValue(v); }

    /* --- nuages --- */
    static final CloudRenderMode[] NUAGES = { CloudRenderMode.FANCY, CloudRenderMode.FAST, CloudRenderMode.OFF };
    static final String[] NUAGES_NOMS = { "Beaux", "Rapides", "Off" };

    static CloudRenderMode nuages() { return opts().getCloudRenderMode().getValue(); }
    static void nuages(CloudRenderMode v) { opts().getCloudRenderMode().setValue(v); }

    /* --- moteur de lumiere : le plus gros levier du jeu sur le nombre
       d images par seconde, parce qu il decide ce que le jeu
       redessine ou non autour du joueur.                              */
    static final ChunkBuilderMode[] LUMIERES = { ChunkBuilderMode.NONE, ChunkBuilderMode.NEARBY, ChunkBuilderMode.PLAYER_AFFECTED };
    static final String[] LUMIERES_NOMS = { "Performances", "Proche", "Au joueur" };

    static ChunkBuilderMode lumiere() { return opts().getChunkBuilderMode().getValue(); }
    static void lumiere(ChunkBuilderMode v) { opts().getChunkBuilderMode().setValue(v); }

    /* --- transparence amelioree : le jeu dessine moins de faces --- */
    static boolean transparence() { return Boolean.TRUE.equals(opts().getImprovedTransparency().getValue()); }
    static void transparence(boolean v) { opts().getImprovedTransparency().setValue(v); }

    /* --- feuilles coupees : moins de faces, Feuilles plus vite --- */
    static boolean feuilles() { return Boolean.TRUE.equals(opts().getCutoutLeaves().getValue()); }
    static void feuilles(boolean v) { opts().getCutoutLeaves().setValue(v); }

    /* --- pas d eclairs : les eclairs brillent et eclaircirent l ecran --- */
    static boolean eclairs() { return !Boolean.TRUE.equals(opts().getHideLightningFlashes().getValue()); }
    static void eclairs(boolean v) { opts().getHideLightningFlashes().setValue(!v); }

    /* --- melange des biomes : la qualite des couleurs du sol --- */
    static final int[] BIOMES = { 0, 2, 4, 6, 12 };
    static final String[] BIOMES_NOMS = { "Aucun", "2", "4", "6", "12" };

    static int biome() { return opts().getBiomeBlendRadius().getValue(); }
    static void biome(int v) { opts().getBiomeBlendRadius().setValue(v); }

    /* --- anisotropie : la finesse des textures vues de biais --- */
    static final int[] ANISOTROPIES = { 1, 2, 3 };
    static final String[] ANISOTROPIES_NOMS = { "2x", "4x", "8x" };

    static int anisotropie() { return opts().getMaxAnisotropy().getValue(); }
    static void anisotropie(int v) { opts().getMaxAnisotropy().setValue(v); }

    /* --- portee de la meteo --- */
    static final int[] METEOS = { 3, 4, 6, 8, 10 };
    static final String[] METEOS_NOMS = { "3", "4", "6", "8", "10" };

    static int meteo() { return opts().getWeatherRadius().getValue(); }
    static void meteo(int v) { opts().getWeatherRadius().setValue(v); }
    static boolean occlusion() { return opts().getAo().getValue(); }
    static void occlusion(boolean value) { opts().getAo().setValue(value); }
    static double distanceEntites() { return opts().getEntityDistanceScaling().getValue(); }
    static void distanceEntites(double value) { opts().getEntityDistanceScaling().setValue(value); }
    static int flouMenu() { return opts().getMenuBackgroundBlurriness().getValue(); }
    static void flouMenu(int value) { opts().getMenuBackgroundBlurriness().setValue(value); }
    static int distanceNuages() { return opts().getCloudRenderDistance().getValue(); }
    static void distanceNuages(int value) { opts().getCloudRenderDistance().setValue(value); }
    static net.minecraft.client.option.TextureFilteringMode filtrage() { return opts().getTextureFiltering().getValue(); }
    static void filtrage(net.minecraft.client.option.TextureFilteringMode value) { opts().getTextureFiltering().setValue(value); }
}