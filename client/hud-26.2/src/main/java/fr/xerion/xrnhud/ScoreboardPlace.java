package fr.xerion.xrnhud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.PlayerScoreEntry;
import net.minecraft.world.scores.Scoreboard;

/**
 * La position du scoreboard du serveur.
 *
 * <p>On ne le redessine pas : on decale celui de Minecraft. Le joueur
 * garde exactement le scoreboard de son serveur, avec ses couleurs et
 * ses equipes, on le deplace seulement.
 *
 * <p>Le decalage passe par la matrice de dessin, qui accepte une
 * translation. Les coordonnees par defaut sont relevees dans le code de
 * Minecraft : x = largeur - largeurMax - 3, y = hauteur / 2 + (lignes * 9) / 3.
 */
final class ScoreboardPlace {

    private static final int INTERLIGNE = 9;
    private static final int MARGE = 3;

    private ScoreboardPlace() {}

    /** Deplace le scoreboard et enregistre ou il se trouve. */
    static void appliquer(GuiGraphicsExtractor c,Minecraft cl,Runnable dessiner){
        Placement.Element e=Placement.SCOREBOARD;if(e.hidden)return;
        enregistrer(c,cl,e.dx,e.dy);Cadres.Cadre frame=Cadres.cadre(e.id);
        if(frame==null){dessiner.run();return;}
        int baseW=frame.largeurBase,baseH=frame.hauteurBase;
        int x=Cadres.limiterX(frame.x,baseW,e),y=Cadres.limiterY(frame.y,baseH,e);
        c.pose().pushMatrix();c.pose().translate(x,y);c.pose().scale(e.scale,e.scale);c.pose().translate(-frame.defautX,-frame.defautY);
        dessiner.run();c.pose().popMatrix();frame.x=x;frame.y=y;
    }

    /** La zone a saisir, pour que le joueur puisse attraper le scoreboard. */
    private static void enregistrer(GuiGraphicsExtractor c, Minecraft cl, int dx, int dy) {
        if (cl.level == null) return;
        Scoreboard tableau = cl.level.getScoreboard();
        if (tableau == null) return;
        Objective objectif = tableau.getDisplayObjective(DisplaySlot.SIDEBAR);
        if(cl.player!=null&&cl.player.getTeam()!=null){var slot=cl.player.getTeam().getColor().map(net.minecraft.world.scores.TeamColor::displaySlot).orElse(null);if(slot!=null){var teamObjective=tableau.getDisplayObjective(slot);if(teamObjective!=null)objectif=teamObjective;}}

        if (objectif == null) return;

        Font t = cl.font;
        int largeurMax = t.width(objectif.getDisplayName());
        int largeurColonne = t.width(":");
        var numberFormat=objectif.numberFormatOrDefault(net.minecraft.network.chat.numbers.StyledFormat.SIDEBAR_DEFAULT);
        int lignes = 0;
        for (PlayerScoreEntry e : tableau.listPlayerScores(objectif).stream().filter(v->!v.isHidden()).sorted(java.util.Comparator.comparingInt(PlayerScoreEntry::value).reversed()).limit(15).toList()) {
            /*  Minecraft ne garde que les entrees visibles : le score
                n entre pas en compte.                                    */
            if (e.isHidden()) continue;
            lignes++;
            var nom=net.minecraft.world.scores.PlayerTeam.formatNameForTeam(tableau.getPlayersTeam(e.owner()),e.ownerName());
            int scoreWidth=t.width(e.formatValue(numberFormat));
            int largeur=t.width(nom)+(scoreWidth>0?largeurColonne+scoreWidth:0);
            if (largeur > largeurMax) largeurMax = largeur;
        }
        if (lignes == 0) return;

        /*  Position du BAS du scoreboard, comme dans le code de Minecraft.
            Le cadre va de (bas - lignes * 9 - 1) a (bas + 1).        */
        int bas = c.guiHeight() / 2 + (INTERLIGNE * lignes) / 3;
        int haut = bas - INTERLIGNE * (lignes+1) - 1;
        int gauche = c.guiWidth() - largeurMax - 5;
        int largeur = largeurMax + 4;
        int hauteur = INTERLIGNE * (lignes+1) + 1;

        Cadres.placer(Placement.SCOREBOARD.id, gauche, haut,
                gauche + dx, haut + dy, largeur, hauteur);
    }
}
