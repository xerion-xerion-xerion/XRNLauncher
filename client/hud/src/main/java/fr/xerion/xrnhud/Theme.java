package fr.xerion.xrnhud;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.font.TextRenderer;

/**
 * Palette et primitives de dessin.
 *
 * <p>Le menu reprend exactement les couleurs du launcher : violet sur noir,
 * avec un fond presque opaque. Aucun coin arrondi : Minecraft ne sait
 * dessiner que des rectangles, et bricoler des angles avec des pixels
 * Transparent donnerait des bords crénelés. On mise donc sur un trait de
 * recoloration net et une barre d'accent, ce qui rend mieux.
 */
final class Theme {

    private Theme() {}

    /* --- couleurs, au format ARGB 24 bits ---
        Meme palette que le launcher apres le rework 4.2.0 : des surfaces
        neutres et froides, et le violet reserve a l accent. Avant, chaque
        surface etait teintee violet, ce qui eclairait le menu dans le jeu
        et detonnait avec le reste.                                       */
    static final int VOILE = 0xB00E0C10;        /*  voile derriere le menu   */
    static final int PANNEAU = 0xFA1A181D;      /*  fond du menu            */
    static final int PANNEAU_BAS = 0xFF161419;  /*  pied du menu            */
    static final int CARTE = 0xFF26222B;        /*  carte d'option          */
    static final int CARTE_SURVOL = 0xFF322B3C; /*  survol                  */
    static final int CARTE_ACTIF = 0xFF342A41;  /*  option deja appliquee   */
    static final int SURVOL = 0xFF2B2533;       /*  survole discret d'une ligne */
    static final int COMMUT = 0xFF3A3442;       /*  interrupteur eteint     */
    static final int BORDURE = 0xFF3B3444;
    static int ACCENT = 0xFFC4AEFF;      /*  violet clair            */
    static int ACCENT_FORT = 0xFFA78BFA; /*  violet marque           */
    static final int TEXTE = 0xFFE9E5EF;
    static final int TEXTE_DOUX = 0xFFA59DB0;
    static final int TEXTE_FAIBLE = 0xFF776F83;
    static int VERT = 0xFFA078D7;
    static final int ROUGE = 0xFFE9A38E;

    static int couleur=0xFFA78BFA;
    static void appliquerCouleur(int c){couleur=0xFF000000|(c&0xFFFFFF);ACCENT_FORT=couleur;VERT=couleur;ACCENT=melange(couleur,0xFFFFFFFF,.3f);}
    static int nuance(int c){if(couleur==0xFFA78BFA)return c;float[] h=java.awt.Color.RGBtoHSB(c>>16&255,c>>8&255,c&255,null),a=java.awt.Color.RGBtoHSB(couleur>>16&255,couleur>>8&255,couleur&255,null);return (c&0xFF000000)|(java.awt.Color.HSBtoRGB(a[0],h[1],h[2])&0xFFFFFF);}
    static void engrenage(DrawContext c,int x,int y,int color){
        for(int a=0;a<8;a++){double t=a*Math.PI/4;rect(c,x+8+(int)Math.round(Math.cos(t)*7),y+8+(int)Math.round(Math.sin(t)*7),3,3,color);}
        arrondi(c,x+4,y+4,12,12,color,0);arrondi(c,x+7,y+7,6,6,nuance(0xFF282130),0);
    }
    /** Melange deux couleurs, t = 0 renvoie a, t = 1 renvoie b. */
    static int melange(int a, int b, float t) {
        t = Anime.borne(t);
        int aa = (a >>> 24) & 255, ar = (a >> 16) & 255, av = (a >> 8) & 255, ab = a & 255;
        int ba = (b >>> 24) & 255, br = (b >> 16) & 255, bv = (b >> 8) & 255, bb = b & 255;
        int o = (int) (aa + (ba - aa) * t) << 24
              | (int) (ar + (br - ar) * t) << 16
              | (int) (av + (bv - av) * t) << 8
              | (int) (ab + (bb - ab) * t);
        return o;
    }

    /** Change seulement l'opacite d'une couleur. */
    static int alpha(int couleur, double a) {
        int v = (int) (Anime.borne((float) a) * 255);
        return (couleur & 0x00FFFFFF) | (v << 24);
    }

    static void rect(DrawContext c, int x, int y, int w, int h, int couleur) {
        c.fill(x, y, x + w, y + h, couleur);
    }

    /** Rectangle avec un liseré d'un pixel. */
    static void cadre(DrawContext c, int x, int y, int w, int h, int fond, int bordure) {
        c.fill(x, y, x + w, y + h, fond);
        if (bordure != 0) {
            c.fill(x, y, x + w, y + 1, bordure);
            c.fill(x, y + h - 1, x + w, y + h, bordure);
            c.fill(x, y + 1, x + 1, y + h - 1, bordure);
            c.fill(x + w - 1, y + 1, x + w, y + h - 1, bordure);
        }
    }

    static void texte(DrawContext c, TextRenderer t, String s, int x, int y, int couleur) {
        c.drawText(t, Langue.t(s), x, y, couleur, true);
    }

    static void texteCentre(DrawContext c, TextRenderer t, String s, int x, int y, int couleur) {
        c.drawCenteredTextWithShadow(t, Langue.t(s), x, y, couleur);
    }

    /** Petit texte de section, en capitales, precede d'un trait. */
    static void section(DrawContext c, TextRenderer t, String titre, int x, int y, int largeur) {
        c.fill(x, y, x + 2, y + 9, ACCENT);
        texte(c, t, titre, x + 7, y, TEXTE_DOUX);
        int suite = x + 11 + t.getWidth(titre);
        if (suite < x + largeur) {
            c.fill(suite, y + 4, x + largeur, y + 5, Theme.alpha(BORDURE, 0.55));
        }
    }

    /** Touche du menu, avec son etat visuel. */
    static void carte(DrawContext c, TextRenderer t, String libelle,
                      int x, int y, int w, int h, int fond, String detail) {
        c.fill(x, y, x + w, y + h, fond);
        c.fill(x, y, x + 1, y + h, alpha(ACCENT, 0.35));
        int ty = detail == null ? y + (h - t.fontHeight) / 2 : y + 6;
        texte(c, t, libelle, x + 8, ty, TEXTE);
        if (detail != null) {
            texte(c, t, detail, x + 8, y + h - 6, TEXTE_FAIBLE);
        }
    }

    /** L'interrupteur d'un reglage a deux etats : une piste, un curseur
        qui glisse. Meme eteint, la piste reste visible : on voit que la
        ligne attend un clic, au lieu de lire un Oui plein de flou.    */
    static int curseurInterrupteur(float progress){return 2+Math.round(14*Math.clamp(progress,0f,1f));}
    static void interrupteur(DrawContext c,int x,int y,float progress,double a){
        float p=Math.clamp(progress,0f,1f);
        arrondi(c,x,y,26,12,alpha(melange(nuance(COMMUT),ACCENT_FORT,p),a),0);
        arrondi(c,x+curseurInterrupteur(p),y+2,8,8,alpha(melange(nuance(0xFFB2AABF),nuance(0xFF21182F),p),a),0);
    }
    static void interrupteur(DrawContext c,int x,int y,boolean marche,double a){interrupteur(c,x,y,marche?1f:0f,a);}

    /*  La marque du client, en pixel art : la meme etoile a quatre
        branches que dans l application et sur le site. Dessinee a
        l echelle entiere, elle reste nette a toute taille, contrairement
        a une image agrandie qui devient floue.

        0 = vide, 1 = violet, 2 = blanc.                                */
    private static final int[][] MARQUE = {
        {1,1,0,0,0,0,1,1},{0,1,1,0,0,1,1,0},
        {0,0,1,1,1,1,0,0},{0,0,0,2,2,0,0,0},
        {0,0,0,2,2,0,0,0},{0,0,1,1,1,1,0,0},
        {0,1,1,0,0,1,1,0},{1,1,0,0,0,0,1,1}
    };

    /** Dessine la marque du client a l echelle demandee. */
    static void marque(DrawContext c, int x, int y, int echelle) {
        marque(c, x, y, echelle, 1.0f);
    }

    /** Idem, avec une transparence pour les fondus. */
    static void marque(DrawContext c, int x, int y, int echelle, float alpha) {
        for (int ligne = 0; ligne < MARQUE.length; ligne++) {
            for (int col = 0; col < MARQUE[ligne].length; col++) {
                int v = MARQUE[ligne][col];
                if (v == 0) continue;
                c.fill(x + col * echelle, y + ligne * echelle,
                       x + (col + 1) * echelle, y + (ligne + 1) * echelle,
                       alpha(v == 1 ? ACCENT : 0xFFF2E9FF, alpha));
            }
        }
    }

    private static void forme(DrawContext c,int x,int y,int w,int h,int color){
        if(w<8||h<8){rect(c,x,y,w,h,color);return;}
        rect(c,x+3,y,w-6,1,color);rect(c,x+1,y+1,w-2,2,color);rect(c,x,y+3,w,h-6,color);rect(c,x+1,y+h-3,w-2,2,color);rect(c,x+3,y+h-1,w-6,1,color);
    }
    static void arrondi(DrawContext c,int x,int y,int w,int h,int fill,int border){
        if(border!=0&&(fill>>>24)==0){
            rect(c,x+3,y,w-6,1,border);rect(c,x+3,y+h-1,w-6,1,border);rect(c,x,y+3,1,h-6,border);rect(c,x+w-1,y+3,1,h-6,border);
            for(int sx:new int[]{0,1})for(int sy:new int[]{0,1}){int cx=sx==0?x+1:x+w-3,cy=sy==0?y+1:y+h-3;rect(c,cx,cy,2,2,border);}return;
        }
        if(border!=0){forme(c,x,y,w,h,border);forme(c,x+1,y+1,w-2,h-2,fill);}else forme(c,x,y,w,h,fill);
    }
    static void boutons(DrawContext c,TextRenderer font,java.util.List<? extends Object> children,int mx,int my){
        for(Object child:children)if(child instanceof net.minecraft.client.gui.widget.ButtonWidget b&&b.visible){
            boolean hover=b.active&&(mx>=b.getX()&&mx<b.getX()+b.getWidth()&&my>=b.getY()&&my<b.getY()+b.getHeight());
            arrondi(c,b.getX(),b.getY(),b.getWidth(),b.getHeight(),hover?nuance(0xFF3C2E50):nuance(0xFF26212F),hover||b.isFocused()?ACCENT:nuance(0xFF544661));
            texteCentre(c,font,b.getMessage().getString(),b.getX()+b.getWidth()/2,b.getY()+(b.getHeight()-font.fontHeight)/2+1,b.active?TEXTE:TEXTE_FAIBLE);
        }
    }
    static void champs(DrawContext c,java.util.List<? extends Object> children){for(Object child:children)if(child instanceof net.minecraft.client.gui.widget.TextFieldWidget f&&f.visible)arrondi(c,f.getX()-5,f.getY()-2,f.getWidth()+10,f.getHeight()+4,nuance(0xFF141119),f.isFocused()?ACCENT:nuance(0xFF55475E));}
}