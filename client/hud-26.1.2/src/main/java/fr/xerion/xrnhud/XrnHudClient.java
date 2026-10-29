package fr.xerion.xrnhud;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.events.GuiEventListener;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import com.mojang.blaze3d.platform.InputConstants;
import java.util.List;
import org.lwjgl.glfw.GLFW;

/**
 * Point d'entree client.
 *
 * <p>Deux touches seulement : Maj droite pour le menu, Ctrl droit pour
 * le HUD. La touche de discrétion du jeu reste la Maj gauche, on ne vole
 * rien au joueur.
 *
 * <p>Les touches sont relevees en fin de tick et non dans un ecran : c'est
 * la seule facon de pouvoir s'en servir quand le menu est ouvert, ce qui
 * est justement le moment utile.
 */
public class XrnHudClient implements ClientModInitializer {

    private static int annuaireTicks;
    private static KeyMapping toucheMenu;
    private static KeyMapping toucheHud;
    private static KeyMapping toucheEdition;
    private static KeyMapping toucheGardeRobe;
    /*  La garde-robe a-t-elle deja ete ouverte par le drapeau de mise
        au point ? On ne l'ouvre qu'une fois.                              */
    private static boolean gardeRobeOuverte = false;
    /*  Le drapeau du test de nuit : on ne passe le monde a la nuit
        qu une fois par session, au premier monde ouvert.               */
    private static boolean estDansLaNuit = false;

    @Override
    public void onInitializeClient() {
        Raccourcis.installer();FreeLook.install();MotionBlur.init();
        toucheMenu = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.xrnhud.menu",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                Raccourcis.CATEGORY));

        toucheHud = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.xrnhud.hud",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_CONTROL,
                Raccourcis.CATEGORY));

        /*  L'ordre est (cible, identifiant, element) : on place notre
            couche AVANT les infos natives du jeu, fps et position, pour
            ne pas passer devant.                                         */
        toucheEdition = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.xrnhud.edit",
                InputConstants.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_ALT,
                Raccourcis.CATEGORY));

        /*  La garde-robe : on la veut vite, pour voir un cosmetique
            change tout de suite sur le personnage.

            La touche U est libre dans le jeu, et elle reste libre
            meme avec beaucoup de mods : d autres touches, comme G,
            sont prises par les mods de debug.                             */


        /*  Le scoreboard du serveur est decale par la matrice de dessin,
            pas redessine : le joueur garde exactement celui de son
            serveur, avec ses couleurs et ses equipes.                   */
        HudElementRegistry.replaceElement(
                VanillaHudElements.SCOREBOARD,
                original -> (context, tick) -> {
                    if (!Elements.scoreboard) return;
                    ScoreboardPlace.appliquer(context,
                            Minecraft.getInstance(),
                            () -> original.extractRenderState(context, tick));
                });

        HudElementRegistry.attachElementBefore(VanillaHudElements.MISC_OVERLAYS,
                Identifier.fromNamespaceAndPath("xrnhud","cadres"),(context,tick)->Cadres.nettoyer());

        HudElementRegistry.attachElementBefore(
                VanillaHudElements.CHAT,
                Identifier.fromNamespaceAndPath("xrnhud", "hud"),
                (context, tick) -> Hud.dessiner(context, tick));

        /*  La musique en cours de lecture : un bloc a part, que le
            joueur deplace depuis l ecran d edition comme les autres. */
        HudElementRegistry.attachElementBefore(
                VanillaHudElements.CHAT,
                Identifier.fromNamespaceAndPath("xrnhud", "musique"),
                (context, tick) -> fr.xerion.xrnhud.Musique.dessiner(
                        context, Minecraft.getInstance().font));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            /*  Le mode Boost FPS attend le premier tick : c est le
                premier moment ou le jeu a ses options.                 */
            fr.xerion.xrnhud.Performance.appliquerAuDemarrage();
            /*  Mise au point : forcer la vue de troisieme personne,
                pour capturer l apparence du personnage en test.        */
            if (client.player != null && "1".equals(System.getProperty("XRNVue3", ""))
                    && client.options.getCameraType().isFirstPerson()) {
                client.options.setCameraType(net.minecraft.client.CameraType.THIRD_PERSON_BACK);
            }
            /*  Mise au point : passer le monde a la nuit, pour capturer
                le rendu dans le noir (ce drapeau ne sert qu aux tests). */
            if (client.player != null && "1".equals(System.getProperty("XRNNuit", ""))
                    && !this.estDansLaNuit && client.level != null) {
                this.estDansLaNuit = true;
                try {
                    client.player.connection.sendCommand("time set 18000");
                } catch (Throwable t) { }
            }
            while (toucheMenu.consumeClick()) {
                basculerMenu();
            }
            while (toucheHud.consumeClick()) {
                Hud.visible = !Hud.visible;
            }
            while (toucheEdition.consumeClick()) {
                if (client.screen instanceof fr.xerion.xrnhud.EcranEdition) {
                    fr.xerion.xrnhud.EcranEdition.fermer(client);
                } else if (client.screen == null && client.player != null) {
                    client.setScreen(new fr.xerion.xrnhud.EcranEdition());
                }
            }
            if(client.screen instanceof net.minecraft.client.gui.screens.TitleScreen&&!AccueilEcran.classique)client.setScreen(new AccueilEcran());
            Visuels.tick(client);Raccourcis.tick(client);
            FreeLook.tick(client);ModulesPlus.tick(client);
            ModulesUtiles.tick(client);
            if (++annuaireTicks % 40 == 0) {Connus.chargerAnnuaire();Droits.synchroniser();PrimeClient.rafraichir();PrimeClient.noterProches();}
            Hud.suivreSession(client);
            Hud.compterClics(client);
            Hud.mesurerVitesse(client);
            fr.xerion.xrnhud.Musique.suivre();
            Fonctions.maj(client);AmbianceCiel.tick(client);
        });

        /*  Bouton dans le menu de pause : le menu XRN doit etre
            accessible sans connaitre le raccourci. addDrawableChild
            est protected, on passe donc par la liste des enfants.    */
        ScreenEvents.AFTER_INIT.register((client, screen, scaledWidth, scaledHeight) -> {
            if(screen instanceof net.minecraft.client.gui.screens.TitleScreen){
                net.fabricmc.fabric.api.client.screen.v1.Screens.getWidgets(screen).add(Button.builder(Component.literal("Accueil XRN"),b->{AccueilEcran.classique=false;client.setScreen(new AccueilEcran());}).bounds(6,scaledHeight-42,104,20).build());return;
            }
            if (!(screen instanceof PauseScreen)) return;
            Button bouton = Button
                    .builder(Component.literal("XRN Client").withStyle(s->s.withColor(0xA78BFA)), b -> client.setScreen(new MenuEcran()))
                    .bounds(6, 6, 104, 20)
                    .build();
            @SuppressWarnings("unchecked")
            List<GuiEventListener> enfants = (List<GuiEventListener>) (List<?>) screen.children();
            net.fabricmc.fabric.api.client.screen.v1.Screens.getWidgets(screen).add(bouton);
        });

        /*  L ajout des rendus de cape et ailes, via l API Fabric.
            On passe directement le renderer comme contexte : son modele
            contient deja la cape, correctement configuree.               */


        Reticule.installer();
        Elements.installer();
        /*  Les droits de la boutique : ils sont lus avant les reglages,
            car le choix du cosmetique porte ne vaut que si on le
            possede reellement.                                            */

        fr.xerion.xrnhud.Droits.charger();fr.xerion.xrnhud.Placement.charger();fr.xerion.xrnhud.Droits.synchroniser();
        /*  L'annuaire de la communaute : la liste des pseudos qui
            utilisent le client, ecrite par le launcher. Elle est lue
            sur le disque, jamais sur le reseau : le jeu demarre meme
            sans connexion, et le mod n'a aucun besoin du net.         */
        fr.xerion.xrnhud.Connus.chargerAnnuaire();
        /*  Le mode Boost FPS, demande par le launcher au lancement.
            Il ne peut pas s'appliquer tout de suite : au moment de
            l'initialisation du mod, le jeu n'a pas encore cree ses
            options. On l'applique donc des le premier tick, quand tout
            existe.                                                       */
        fr.xerion.xrnhud.Performance.appliquerAuDemarrage();
        /*  Filet de securite : si le jeu se ferme sans que l on ait
            touche au menu, les reglages sont quand meme ecruits.    */
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> fr.xerion.xrnhud.Placement.sauver());
    }

    private static void basculerMenu() {
        Minecraft c = Minecraft.getInstance();
        if (c.screen instanceof MenuEcran menu) {
            /*  Une frappe pendant l'animation de fermeture rouvrait
                rien : fermer() ignorait les appels suivants et la
                touche paraissait morte. On coupe la fermeture au
                lieu d'attendre que le joueur devine.                 */
            if (menu.enFermeture()) menu.rouvrir();
            else menu.fermer();
        } else if (c.player != null) {
            c.setScreen(new MenuEcran());
        }
    }
}
