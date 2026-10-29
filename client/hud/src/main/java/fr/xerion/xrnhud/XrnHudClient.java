package fr.xerion.xrnhud;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.Element;
import net.minecraft.text.Text;

import java.util.List;
import net.minecraft.util.Identifier;

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
    private static KeyBinding toucheMenu;
    private static KeyBinding toucheHud;
    private static KeyBinding toucheEdition;
    private static KeyBinding toucheGardeRobe;
    /*  La garde-robe a-t-elle deja ete ouverte par le drapeau de mise
        au point ? On ne l'ouvre qu'une fois.                              */
    private static boolean gardeRobeOuverte = false;
    /*  Le drapeau du test de nuit : on ne passe le monde a la nuit
        qu une fois par session, au premier monde ouvert.               */
    private static boolean estDansLaNuit = false;

    @Override
    public void onInitializeClient() {
        Raccourcis.installer();FreeLook.install();MotionBlur.init();
        toucheMenu = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.xrnhud.menu",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                Raccourcis.CATEGORY));

        toucheHud = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.xrnhud.hud",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_CONTROL,
                Raccourcis.CATEGORY));

        /*  L'ordre est (cible, identifiant, element) : on place notre
            couche AVANT les infos natives du jeu, fps et position, pour
            ne pas passer devant.                                         */
        toucheEdition = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.xrnhud.edit",
                InputUtil.Type.KEYSYM,
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
                            MinecraftClient.getInstance(),
                            () -> original.render(context, tick));
                });

        HudElementRegistry.attachElementBefore(VanillaHudElements.MISC_OVERLAYS,
                Identifier.of("xrnhud","cadres"),(context,tick)->Cadres.nettoyer());

        HudElementRegistry.attachElementBefore(
                VanillaHudElements.CHAT,
                Identifier.of("xrnhud", "hud"),
                (context, tick) -> Hud.dessiner(context, tick));

        /*  La musique en cours de lecture : un bloc a part, que le
            joueur deplace depuis l ecran d edition comme les autres. */
        HudElementRegistry.attachElementBefore(
                VanillaHudElements.CHAT,
                Identifier.of("xrnhud", "musique"),
                (context, tick) -> fr.xerion.xrnhud.Musique.dessiner(
                        context, MinecraftClient.getInstance().textRenderer));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            /*  Le mode Boost FPS attend le premier tick : c est le
                premier moment ou le jeu a ses options.                 */
            fr.xerion.xrnhud.Performance.appliquerAuDemarrage();
            /*  Mise au point : forcer la vue de troisieme personne,
                pour capturer l apparence du personnage en test.        */
            if (client.player != null && "1".equals(System.getProperty("XRNVue3", ""))
                    && client.options.getPerspective().isFirstPerson()) {
                client.options.setPerspective(net.minecraft.client.option.Perspective.THIRD_PERSON_BACK);
            }
            /*  Mise au point : passer le monde a la nuit, pour capturer
                le rendu dans le noir (ce drapeau ne sert qu aux tests). */
            if (client.player != null && "1".equals(System.getProperty("XRNNuit", ""))
                    && !this.estDansLaNuit && client.world != null) {
                this.estDansLaNuit = true;
                try {
                    client.player.networkHandler.sendChatCommand("time set 18000");
                } catch (Throwable t) { }
            }
            while (toucheMenu.wasPressed()) {
                basculerMenu();
            }
            while (toucheHud.wasPressed()) {
                Hud.visible = !Hud.visible;
            }
            while (toucheEdition.wasPressed()) {
                if (client.currentScreen instanceof fr.xerion.xrnhud.EcranEdition) {
                    fr.xerion.xrnhud.EcranEdition.fermer(client);
                } else if (client.currentScreen == null && client.player != null) {
                    client.setScreen(new fr.xerion.xrnhud.EcranEdition());
                }
            }
            if(client.currentScreen instanceof net.minecraft.client.gui.screen.TitleScreen&&!AccueilEcran.classique)client.setScreen(new AccueilEcran());
            Visuels.tick(client);Raccourcis.tick(client);
            FreeLook.tick(client);ModulesPlus.tick(client);
            ModulesUtiles.tick(client);
            if (++annuaireTicks % 40 == 0) {Connus.chargerAnnuaire();Droits.synchroniser();}
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
            if(screen instanceof net.minecraft.client.gui.screen.TitleScreen){
                net.fabricmc.fabric.api.client.screen.v1.Screens.getButtons(screen).add(ButtonWidget.builder(Text.literal("Accueil XRN"),b->{AccueilEcran.classique=false;client.setScreen(new AccueilEcran());}).dimensions(8,8,104,20).build());return;
            }
            if (!(screen instanceof GameMenuScreen)) return;
            ButtonWidget bouton = ButtonWidget
                    .builder(Text.literal("XRN Client").styled(s->s.withColor(0xA78BFA)), b -> client.setScreen(new MenuEcran()))
                    .dimensions(6, 6, 104, 20)
                    .build();
            @SuppressWarnings("unchecked")
            List<Element> enfants = (List<Element>) (List<?>) screen.children();
            net.fabricmc.fabric.api.client.screen.v1.Screens.getButtons(screen).add(bouton);
        });

        /*  L ajout des rendus de cape et ailes, via l API Fabric.
            On passe directement le renderer comme contexte : son modele
            contient deja la cape, correctement configuree.               */
        net.fabricmc.fabric.api.client.rendering.v1.LivingEntityFeatureRendererRegistrationCallback
                .EVENT.register((entityType, entityRenderer, registrationHelper, context) -> {
            /*  Rien a enregistrer ici : la cape se pose en remplaçant
                la texture de cape de l etat du joueur, dans le mixin.
                Le rappel reste en place pour les rendus a venir.         */
        });

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
        MinecraftClient c = MinecraftClient.getInstance();
        if (c.currentScreen instanceof MenuEcran menu) {
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