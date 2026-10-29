package fr.xerion.xrnhud;

import net.minecraft.client.CloudStatus;
import net.minecraft.client.GraphicsPreset;
import net.minecraft.client.Minecraft;
import net.minecraft.client.PrioritizeChunkUpdates;
import net.minecraft.server.level.ParticleStatus;

/**
 * Tous les reglages, pris en main sur place.
 *
 * <p>Aucune commande a taper, aucun mod a telecharger : on modifie
 * l'option existante du client, le jeu s'en souvient, et le joueur
 * peut tout refaire depuis son propre menu Options.
 */
final class Options {

    private Options() {}

    static net.minecraft.client.Options opts() {
        return Minecraft.getInstance().options;
    }

    /* --- luminosite : exactement ce que fait deja le curseur natif --- */
    static final double[] LUMINOSITES = { 0.0, 0.5, 0.8, 1.0 };
    static final String[] LUMINOSITES_NOMS = { "Sombre", "Basse", "Haute", "Pleine" };

    static double luminosite() { return opts().gamma().get(); }
    static void luminosite(double v) { opts().gamma().set(v); }

    /* --- effet d'obscurité dans les endroits sombres --- */
    static final double[] OBSCURITES = { 0.0, 0.5, 1.0 };
    static final String[] OBSCURITES_NOMS = { "Normal", "Atre", "Supprime" };

    static double obscurite() { return opts().darknessEffectScale().get(); }
    static void obscurite(double v) { opts().darknessEffectScale().set(v); }

    /* --- champ de vision : un entier dans cette version du jeu --- */
    static final int[] FOVS = { 60, 70, 80, 90, 100, 110 };

    static int champDeVision() { return opts().fov().get(); }
    static void champDeVision(int v) { opts().fov().set(v); }

    /* --- distance d'affichage --- */
    static final int[] DISTANCES = { 2, 4, 6, 8, 12, 16, 24, 32 };

    static int distance() { return opts().renderDistance().get(); }
    static void distance(int v) { opts().renderDistance().set(v); }

    /* --- distance de simulation : chargeur de la partie, invisible --- */
    static final int[] SIMULATIONS = { 2, 4, 6, 8, 10, 12, 16 };

    static int simulation() { return opts().simulationDistance().get(); }
    static void simulation(int v) { opts().simulationDistance().set(v); }

    /* --- echelle de l'interface --- */
    static final int[] ECHELLES = { 0, 1, 2, 3, 4 };
    static final String[] ECHELLES_NOMS = { "Auto", "Petite", "Normale", "Grande", "Tres grande" };

    static int echelle() { return opts().guiScale().get(); }
    static void echelle(int v) { opts().guiScale().set(v); }

    /* --- bascule tout ou rien --- */
    static boolean balancement() { return Boolean.TRUE.equals(opts().bobView().get()); }
    static void balancement(boolean v) { opts().bobView().set(v); }

    static boolean secousses() { return opts().damageTiltStrength().get() > 0.0; }
    static void secousses(boolean v) { opts().damageTiltStrength().set(v ? 1.0 : 0.0); }

    static boolean vignette() { return Boolean.TRUE.equals(opts().vignette().get()); }
    static void vignette(boolean v) { opts().vignette().set(v); }

    /* --- course maintenue : plus besoin de garder la touche enfoncee --- */
    static boolean course() { return Boolean.TRUE.equals(opts().toggleSprint().get()); }
    static void course(boolean v) { opts().toggleSprint().set(v); }

    /* --- saut automatique : comme le mode des ladders d'un jeu d'arcade.
           0 = aucun plafond, la valeur la plus haute = jamais.          */
    static final int[] SAUTS = { 0, 1, 2, 3, 4, 5 };
    static final String[] SAUTS_NOMS = { "Illimite", "60 cm", "55 cm", "50 cm", "45 cm", "40 cm" };

    static boolean sautAuto() { return opts().autoJump().get(); }
    static void sautAuto(boolean v) { opts().autoJump().set(v); }

    /* --- plafond d'images par seconde : 0 = aucune limite. C'est le
           reglage qui fait gagner le plus sur une petite carte.         */
    static final int[] IPS_MAX = { 0, 30, 60, 120, 144, 240, 300 };

    static int ipsMax() { return opts().framerateLimit().get(); }
    static void ipsMax(int v) { opts().framerateLimit().set(v); }

    /* --- vitesse a laquelle le champ de vision revient apres un effet */
    static final double[] FOV_EFFETS = { 0.0, 0.5, 1.0, 2.0, 4.0 };
    static final String[] FOV_EFFETS_NOMS = { "Fixe", "Lent", "Normal", "Rapide", "Instantane" };

    static double effetFov() { return opts().fovEffectScale().get(); }
    static void effetFov(double v) { opts().fovEffectScale().set(v); }

    /* --- opacite du chat --- */
    static final double[] CHATS = { 0.0, 0.25, 0.5, 0.75, 1.0 };
    static final String[] CHATS_NOMS = { "Transparent", "Leger", "Moyen", "Fort", "Opaque" };

    static double chat() { return opts().chatOpacity().get(); }
    static void chat(double v) { opts().chatOpacity().set(v); }

    /* --- flou derriere les menus du jeu --- */
    static final int[] FLOUS = { 0, 2, 6, 12 };
    static final String[] FLOUS_NOMS = { "Aucun", "Leger", "Moyen", "Fort" };

    static int flou() { return opts().menuBackgroundBlurriness().get(); }
    static void flou(int v) { opts().menuBackgroundBlurriness().set(v); }

    static boolean ombres() { return Boolean.TRUE.equals(opts().entityShadows().get()); }
    static void ombres(boolean v) { opts().entityShadows().set(v); }

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

    static int mipmaps() { return opts().mipmapLevels().get(); }
    static void mipmaps(int v) { opts().mipmapLevels().set(v); }

    /* --- mode graphique : c est le gros levier du jeu, avec le mode
           rapide qui coupe les lumieres, les nuages et les faces.        */
    static final GraphicsPreset[] GRAPHISMES = { GraphicsPreset.FANCY, GraphicsPreset.FAST };
    static final String[] GRAPHISMES_NOMS = { "Beau", "Rapide" };

    static GraphicsPreset graphisme() { return opts().graphicsPreset().get(); }
    static void graphisme(GraphicsPreset v) { opts().graphicsPreset().set(v); }

    /* --- particules --- */
    static final ParticleStatus[] PARTICULES = { ParticleStatus.ALL, ParticleStatus.DECREASED, ParticleStatus.MINIMAL };
    static final String[] PARTICULES_NOMS = { "Toutes", "Reduites", "Minimales" };

    static ParticleStatus particules() { return opts().particles().get(); }
    static void particules(ParticleStatus v) { opts().particles().set(v); }

    /* --- nuages --- */
    static final CloudStatus[] NUAGES = { CloudStatus.FANCY, CloudStatus.FAST, CloudStatus.OFF };
    static final String[] NUAGES_NOMS = { "Beaux", "Rapides", "Off" };

    static CloudStatus nuages() { return opts().cloudStatus().get(); }
    static void nuages(CloudStatus v) { opts().cloudStatus().set(v); }

    /* --- moteur de lumiere : le plus gros levier du jeu sur le nombre
       d images par seconde, parce qu il decide ce que le jeu
       redessine ou non autour du joueur.                              */
    static final PrioritizeChunkUpdates[] LUMIERES = { PrioritizeChunkUpdates.NONE, PrioritizeChunkUpdates.NEARBY, PrioritizeChunkUpdates.PLAYER_AFFECTED };
    static final String[] LUMIERES_NOMS = { "Performances", "Proche", "Au joueur" };

    static PrioritizeChunkUpdates lumiere() { return opts().prioritizeChunkUpdates().get(); }
    static void lumiere(PrioritizeChunkUpdates v) { opts().prioritizeChunkUpdates().set(v); }

    /* --- transparence amelioree : le jeu dessine moins de faces --- */
    static boolean transparence() { return Boolean.TRUE.equals(opts().improvedTransparency().get()); }
    static void transparence(boolean v) { opts().improvedTransparency().set(v); }

    /* --- feuilles coupees : moins de faces, Feuilles plus vite --- */
    static boolean feuilles() { return Boolean.TRUE.equals(opts().cutoutLeaves().get()); }
    static void feuilles(boolean v) { opts().cutoutLeaves().set(v); }

    /* --- pas d eclairs : les eclairs brillent et eclaircirent l ecran --- */
    static boolean eclairs() { return !Boolean.TRUE.equals(opts().hideLightningFlash().get()); }
    static void eclairs(boolean v) { opts().hideLightningFlash().set(!v); }

    /* --- melange des biomes : la qualite des couleurs du sol --- */
    static final int[] BIOMES = { 0, 2, 4, 6, 12 };
    static final String[] BIOMES_NOMS = { "Aucun", "2", "4", "6", "12" };

    static int biome() { return opts().biomeBlendRadius().get(); }
    static void biome(int v) { opts().biomeBlendRadius().set(v); }

    /* --- anisotropie : la finesse des textures vues de biais --- */
    static final int[] ANISOTROPIES = { 1, 2, 3 };
    static final String[] ANISOTROPIES_NOMS = { "2x", "4x", "8x" };

    static int anisotropie() { return opts().maxAnisotropyBit().get(); }
    static void anisotropie(int v) { opts().maxAnisotropyBit().set(v); }

    /* --- portee de la meteo --- */
    static final int[] METEOS = { 3, 4, 6, 8, 10 };
    static final String[] METEOS_NOMS = { "3", "4", "6", "8", "10" };

    static int meteo() { return opts().weatherRadius().get(); }
    static void meteo(int v) { opts().weatherRadius().set(v); }
    static boolean occlusion() { return opts().ambientOcclusion().get(); }
    static void occlusion(boolean value) { opts().ambientOcclusion().set(value); }
    static double distanceEntites() { return opts().entityDistanceScaling().get(); }
    static void distanceEntites(double value) { opts().entityDistanceScaling().set(value); }
    static int flouMenu() { return opts().menuBackgroundBlurriness().get(); }
    static void flouMenu(int value) { opts().menuBackgroundBlurriness().set(value); }
    static int distanceNuages() { return opts().cloudRange().get(); }
    static void distanceNuages(int value) { opts().cloudRange().set(value); }
    static net.minecraft.client.TextureFilteringMethod filtrage() { return opts().textureFiltering().get(); }
    static void filtrage(net.minecraft.client.TextureFilteringMethod value) { opts().textureFiltering().set(value); }
}