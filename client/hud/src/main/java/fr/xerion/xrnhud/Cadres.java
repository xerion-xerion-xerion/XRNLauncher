package fr.xerion.xrnhud;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Les rectangles des elements deplacables, recalcules a chaque image.
 *
 * <p>Le HUD dessine ses elements et enregistre ou ils se trouvent ;
 * l ecran d edition s en sert ensuite pour savoir ce que le pointeur
 * touche, et pour afficher le cadre de selection.
 *
 * <p>On garde aussi la position par defaut de l element : le decalage
 * enregistre par le joueur s applique par rapport a elle, et non par
 * rapport a une position absolue. Ainsi, si la taille de l ecran change,
 * l element garde le meme ecart du bord.
 */
final class Cadres {

    /** Un rectangle en coordonnees de l ecran du jeu. */
    static final class Cadre {
        /** Position d origine, avant tout decalage. */
        int defautX, defautY;
        /** Position reellement dessinee. */
        int x, y, w, h, largeurBase, hauteurBase;

        boolean contient(double px, double py) {
            return px >= x && px <= x + w && py >= y && py <= y + h;
        }
    }

    private static final Map<String, Cadre> CADRES = new LinkedHashMap<>();

    private Cadres() {}
    static void nettoyer(){CADRES.clear();}
    static void debut(net.minecraft.client.gui.DrawContext c,Placement.Element e,int x,int y){
        c.getMatrices().pushMatrix();c.getMatrices().translate(x,y);c.getMatrices().scale(e.scale,e.scale);c.getMatrices().translate(-x,-y);
    }
    static void fin(net.minecraft.client.gui.DrawContext c){c.getMatrices().popMatrix();}
    static int limiterX(int x,int w,Placement.Element e){return Math.max(0,Math.min(net.minecraft.client.MinecraftClient.getInstance().getWindow().getScaledWidth()-(int)Math.ceil(w*e.scale),x));}
    static int limiterY(int y,int h,Placement.Element e){return Math.max(0,Math.min(net.minecraft.client.MinecraftClient.getInstance().getWindow().getScaledHeight()-(int)Math.ceil(h*e.scale),y));}


    static void placer(String id, int defautX, int defautY, int x, int y, int w, int h) {
        Cadre c = CADRES.get(id);
        if (c == null) {
            c = new Cadre();
            CADRES.put(id, c);
        }
        c.defautX = defautX;
        c.defautY = defautY;
        c.x = x;
        c.y = y;
        Placement.Element e=Placement.parId(id);
        float s=e==null?1:e.scale;
        c.largeurBase=w;c.hauteurBase=h;
        c.w = (int)Math.ceil(w*s);
        c.h = (int)Math.ceil(h*s);
    }

    static Cadre cadre(String id) {
        return CADRES.get(id);
    }

    static Iterable<Map.Entry<String, Cadre>> tous() {
        return CADRES.entrySet();
    }
}
