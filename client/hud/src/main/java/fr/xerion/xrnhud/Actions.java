package fr.xerion.xrnhud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.world.Difficulty;
import net.minecraft.world.GameMode;

/**
 * Les actions du menu.
 *
 * <p>Tout passe par les commandes du jeu : c'est la seule voie qui marche
 * a la fois en solo avec les commandes ouvertes et sur un serveur ou l'on
 * a les droits. Si la commande est refusee, Minecraft affiche lui-meme son
 * message d'erreur dans le chat, on n'a donc rien a deviner ici.
 */
final class Actions {

    private Actions() {}

    private static void commande(String cmd) {
        MinecraftClient c = MinecraftClient.getInstance();
        if (c.player == null || c.player.networkHandler == null) return;
        c.player.networkHandler.sendChatCommand(cmd);
    }

    static void modeDeJeu(GameMode g) {
        commande("gamemode " + nomDuMode(g));
    }

    static void difficulte(Difficulty d) {
        commande("difficulty " + nomDeDifficulte(d));
    }

    static void heure(String moment) {
        commande("time set " + moment);
    }

    static void meteo(String etat) {
        commande("weather " + etat);
    }

    static void effacerLeChat() {
        MinecraftClient c = MinecraftClient.getInstance();
        if (c.inGameHud != null && c.inGameHud.getChatHud() != null) {
            /*  clear(true) vide aussi l'historique des messages : sans cela, un
        simple retour en haut du chat ferait revenir ce qu'on vient
        d'effacer. C'est le sens du booléen.                          */
            c.inGameHud.getChatHud().clear(true);
        }
    }

    static void pleinEcran() {
        MinecraftClient.getInstance().getWindow().toggleFullscreen();
    }

    static void quitter() {
        MinecraftClient.getInstance().stop();
    }

    /** Le nom exact de la commande, en minuscules, selon ce qu'attend le jeu. */
    static String nomDuMode(GameMode g) {
        if (g == null) return "survival";
        return switch (g) {
            case CREATIVE -> "creative";
            case ADVENTURE -> "adventure";
            case SPECTATOR -> "spectator";
            default -> "survival";
        };
    }

    static String nomDeDifficulte(Difficulty d) {
        if (d == null) return "normal";
        return switch (d) {
            case PEACEFUL -> "peaceful";
            case EASY -> "easy";
            case HARD -> "hard";
            default -> "normal";
        };
    }

    /** Libelles francais, dans le meme ordre que l'enum, pour le menu. */
    static Difficulty[] difficultes() {
        return new Difficulty[] {
            Difficulty.PEACEFUL, Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD
        };
    }

    static GameMode[] modes() {
        return new GameMode[] {
            GameMode.SURVIVAL, GameMode.CREATIVE, GameMode.ADVENTURE, GameMode.SPECTATOR
        };
    }
}