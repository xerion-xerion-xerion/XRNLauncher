package fr.xerion.xrnhud;

import net.minecraft.client.Minecraft;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.GameType;

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
        Minecraft c = Minecraft.getInstance();
        if (c.player == null || c.player.connection == null) return;
        c.player.connection.sendCommand(cmd);
    }

    static void modeDeJeu(GameType g) {
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
        Minecraft c = Minecraft.getInstance();
        if (c.gui != null && c.gui.getChat() != null) {
            /*  clear(true) vide aussi l'historique des messages : sans cela, un
        simple retour en haut du chat ferait revenir ce qu'on vient
        d'effacer. C'est le sens du booléen.                          */
            c.gui.getChat().clearMessages(true);
        }
    }

    static void pleinEcran() {
        Minecraft.getInstance().getWindow().toggleFullScreen();
    }

    static void quitter() {
        Minecraft.getInstance().stop();
    }

    /** Le nom exact de la commande, en minuscules, selon ce qu'attend le jeu. */
    static String nomDuMode(GameType g) {
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

    static GameType[] modes() {
        return new GameType[] {
            GameType.SURVIVAL, GameType.CREATIVE, GameType.ADVENTURE, GameType.SPECTATOR
        };
    }
}