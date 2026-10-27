package fr.xerion.xrnhud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.scoreboard.Scoreboard;
import net.minecraft.scoreboard.ScoreboardDisplaySlot;
import net.minecraft.scoreboard.ScoreboardEntry;
import net.minecraft.scoreboard.ScoreboardObjective;

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
    static void appliquer(DrawContext c,MinecraftClient cl,Runnable dessiner){
        Placement.Element e=Placement.SCOREBOARD;if(e.hidden)return;
        enregistrer(c,cl,e.dx,e.dy);Cadres.Cadre frame=Cadres.cadre(e.id);
        if(frame==null){dessiner.run();return;}
        int baseW=frame.largeurBase,baseH=frame.hauteurBase;
        int x=Cadres.limiterX(frame.x,baseW,e),y=Cadres.limiterY(frame.y,baseH,e);
        c.getMatrices().pushMatrix();c.getMatrices().translate(x,y);c.getMatrices().scale(e.scale,e.scale);c.getMatrices().translate(-frame.defautX,-frame.defautY);
        dessiner.run();c.getMatrices().popMatrix();frame.x=x;frame.y=y;
    }

    /** La zone a saisir, pour que le joueur puisse attraper le scoreboard. */
    private static void enregistrer(DrawContext c, MinecraftClient cl, int dx, int dy) {
        if (cl.world == null) return;
        Scoreboard tableau = cl.world.getScoreboard();
        if (tableau == null) return;
        ScoreboardObjective objectif = tableau.getObjectiveForSlot(ScoreboardDisplaySlot.SIDEBAR);
        if(cl.player!=null&&cl.player.getScoreboardTeam()!=null){var slot=ScoreboardDisplaySlot.fromFormatting(cl.player.getScoreboardTeam().getColor());if(slot!=null){var teamObjective=tableau.getObjectiveForSlot(slot);if(teamObjective!=null)objectif=teamObjective;}}

        if (objectif == null) return;

        TextRenderer t = cl.textRenderer;
        int largeurMax = t.getWidth(objectif.getDisplayName());
        int largeurColonne = t.getWidth(":");
        var numberFormat=objectif.getNumberFormatOr(net.minecraft.scoreboard.number.StyledNumberFormat.RED);
        int lignes = 0;
        for (ScoreboardEntry e : tableau.getScoreboardEntries(objectif).stream().filter(v->!v.hidden()).sorted(java.util.Comparator.comparingInt(ScoreboardEntry::value).reversed()).limit(15).toList()) {
            /*  Minecraft ne garde que les entrees visibles : le score
                n entre pas en compte.                                    */
            if (e.hidden()) continue;
            lignes++;
            var nom=net.minecraft.scoreboard.Team.decorateName(tableau.getScoreHolderTeam(e.owner()),e.name());
            int scoreWidth=t.getWidth(e.formatted(numberFormat));
            int largeur=t.getWidth(nom)+(scoreWidth>0?largeurColonne+scoreWidth:0);
            if (largeur > largeurMax) largeurMax = largeur;
        }
        if (lignes == 0) return;

        /*  Position du BAS du scoreboard, comme dans le code de Minecraft.
            Le cadre va de (bas - lignes * 9 - 1) a (bas + 1).        */
        int bas = c.getScaledWindowHeight() / 2 + (INTERLIGNE * lignes) / 3;
        int haut = bas - INTERLIGNE * (lignes+1) - 1;
        int gauche = c.getScaledWindowWidth() - largeurMax - 5;
        int largeur = largeurMax + 4;
        int hauteur = INTERLIGNE * (lignes+1) + 1;

        Cadres.placer(Placement.SCOREBOARD.id, gauche, haut,
                gauche + dx, haut + dy, largeur, hauteur);
    }
}
