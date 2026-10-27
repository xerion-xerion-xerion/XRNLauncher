package fr.xerion.xrnhud;

import java.util.Map;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

/**
 * L editeur de HUD, a la facon des clients professionnels.
 *
 * <p>On ne regle pas une position dans un menu : on prend l element a
 * la souris et on le deplace. L editeur est un ecran transparent pose
 * par-dessus le jeu, ce qui a deux advantages : le joueur ne bouge pas
 * pendant qu il positionne, et la souris est libre.
 *
 * <p>Chaque element dessine par le HUD enregistre son rectangle ici, et
 * c est ce registre que l editeur utilise pour le selection et pour
 * afficher les cadres.
 */
public class EcranEdition extends Screen {

    private static final int TAILLE_CADRE = 1;

    /*  Element en cours de deplacement, et ecart entre le pointeur et
        le coin de l element, pour qu il ne saute pas sous le curseur. */
    private Placement.Element enCours = null;
    private int ecartX = 0;
    private int ecartY = 0;
    private boolean redimensionne;
    private float scaleDepart;
    private double sourisDepart;
    private int largeurDepart,hauteurDepart,xDepart,yDepart,bordX,bordY;
    private double sourisYDepart;
    private String survole="";
    private long debutSurvol;
    private Bouton supprimer;


    /*  Boutons du bandeau central. Ils sont calcules a chaque image et
        gardes ici, pour que le clic sache sur quoi il est tombe.    */
    private record Bouton(int x, int y, int w, int h, String libelle, Runnable action) {}
    private final java.util.List<Bouton> boutons = new java.util.ArrayList<>();

    /*  L editeur apparait et disparait en fondu : on voit d ou il vient
        et ou il va, au lieu d un ecran qui surgit d un coup.        */
    private static final long OUVERTURE_NS = 160_000_000L;
    private static final long FERMETURE_NS = 140_000_000L;
    private final long ouverture;
    private long fermeture = 0L;

    public EcranEdition() {
        super(Text.empty());
        ouverture = System.nanoTime();
    }

    private void fermer() {
        if (fermeture == 0L) fermeture = System.nanoTime();
    }

    @Override
    public void close() {
        fermer();
    }

    @Override public void blur() {}
    @Override protected void applyBlur(DrawContext c) {}
    @Override public void renderBackground(DrawContext c, int x, int y, float delta) {}

    @Override
    public boolean shouldPause() {
        return false;
    }

    @Override
    public void render(DrawContext c, int mouseX, int mouseY, float delta) {
        /*  Aucun voile : un fond assombri rendait flous les elements
            que l on est en train de deplacer. Les cadres suffisent. */

        /*  Fondu d ouverture et de fermeture : l editeur apparait et
            disparait en douceur, on voit d ou il vient et ou il va. */
        long maintenant = System.nanoTime();
        float fondu;
        if (fermeture != 0L) {
            long ecoule = maintenant - fermeture;
            if (ecoule >= FERMETURE_NS) {
                super.close();
                return;
            }
            fondu = 1f - Anime.sortie(ecoule / (float) FERMETURE_NS);
        } else {
            fondu = Anime.sortie((maintenant - ouverture) / (float) OUVERTURE_NS);
        }
        fondu = Anime.borne(fondu);
        /*  Tout ce qui suit est module par le fondu. */
        int ombre = Theme.alpha(0xC00A0B0F, fondu);

        /*  Pendant un deplacement, l element suit le pointeur. */
        if (enCours != null) {
            Cadres.Cadre cadre = Cadres.cadre(enCours.id);
            if (cadre != null) {
                if(redimensionne){
                    double fx=bordX==0?1:1+bordX*(mouseX-sourisDepart)/Math.max(1,largeurDepart);
                    double fy=bordY==0?1:1+bordY*(mouseY-sourisYDepart)/Math.max(1,hauteurDepart);
                    double factor=bordX==0?fy:bordY==0?fx:Math.abs(fx-1)>Math.abs(fy-1)?fx:fy;
                    int anchorX=bordX<0?xDepart+largeurDepart:xDepart,anchorY=bordY<0?yDepart+hauteurDepart:yDepart;
                    float limit=scaleDepart*Math.min((float)(bordX<0?anchorX:width-anchorX)/Math.max(1,largeurDepart),(float)(bordY<0?anchorY:height-anchorY)/Math.max(1,hauteurDepart));
                    enCours.scale=Math.max(.5f,Math.min(Math.min(3f,limit),(float)(scaleDepart*factor)));
                    int newWidth=Math.round(largeurDepart*enCours.scale/scaleDepart),newHeight=Math.round(hauteurDepart*enCours.scale/scaleDepart);
                    enCours.dx=(bordX<0?anchorX-newWidth:xDepart)-cadre.defautX;
                    enCours.dy=(bordY<0?anchorY-newHeight:yDepart)-cadre.defautY;
                }else{
                int nouvelleX = Math.max(0, Math.min(this.width - cadre.w, mouseX - ecartX));
                int nouvelleY = Math.max(0, Math.min(this.height - cadre.h, mouseY - ecartY));
                enCours.dx = nouvelleX - cadre.defautX;
                enCours.dy = nouvelleY - cadre.defautY;
                }
            }
        }

        supprimer=null;
        String cible="";
        for(Map.Entry<String,Cadres.Cadre> entry:Cadres.tous()){
            Cadres.Cadre q=entry.getValue();
            if(mouseX>=q.x-5&&mouseX<=q.x+q.w+9&&mouseY>=q.y-15&&mouseY<=q.y+q.h+5)cible=entry.getKey();
        }
        if(!cible.equals(survole)){survole=cible;debutSurvol=maintenant;}
        for (Map.Entry<String, Cadres.Cadre> e : Cadres.tous()) {
            Cadres.Cadre cadre = e.getValue();
            if (cadre == null || cadre.w <= 0 || cadre.h <= 0) continue;

            boolean pris = enCours != null && enCours.id.equals(e.getKey());
            int couleur = Theme.alpha(pris ? 0xFF8C6BBA : 0xFFBEA1E7, fondu);

            boolean hover=e.getKey().equals(survole);
            int pad=1;
            Theme.arrondi(c,cadre.x-pad,cadre.y-pad,cadre.w+2*pad,cadre.h+2*pad,0,Theme.alpha(pris||hover?Theme.ACCENT:0xA09B8AAE,fondu));
            if(pris||hover){
                int[][] coins={{cadre.x,cadre.y},{cadre.x+cadre.w,cadre.y},{cadre.x,cadre.y+cadre.h},{cadre.x+cadre.w,cadre.y+cadre.h},{cadre.x+cadre.w/2,cadre.y},{cadre.x+cadre.w/2,cadre.y+cadre.h},{cadre.x,cadre.y+cadre.h/2},{cadre.x+cadre.w,cadre.y+cadre.h/2}};
                for(int[] point:coins)Theme.arrondi(c,point[0]-2,point[1]-2,4,4,Theme.TEXTE,0);
            }
            if(e.getKey().equals(survole)&&maintenant-debutSurvol>500_000_000L&&enCours==null){
                int sx=Math.max(0,Math.min(width-12,cadre.x+cadre.w-10)),sy=Math.max(0,cadre.y-13);
                supprimer=new Bouton(sx,sy,12,12,"×",()->{Placement.Element item=Placement.parId(survole);if(item!=null){item.hidden=true;Placement.sauver();}});
                Theme.rect(c,sx,sy,12,12,0xE02C202F);Theme.texteCentre(c,textRenderer,"×",sx+6,sy+2,Theme.TEXTE);
            }
        }

        boutons.clear();
        int bw=Math.min(248,width-12),bx=(width-bw)/2,by=height/2-30;
        Theme.arrondi(c,bx,by,bw,60,0xDC18151F,0xFF4B3B60);
        Theme.marque(c,bx+12,by+10,2);
        Theme.texte(c,textRenderer,"XRN CLIENT",bx+38,by+9,Theme.TEXTE);
        Theme.texte(c,textRenderer,"Deplacer · tirer un bord pour agrandir",bx+38,by+21,Theme.TEXTE_FAIBLE);
        boutons.add(new Bouton(bx+8,by+37,70,16,"Modules",()->client.setScreen(new MenuEcran())));
        boutons.add(new Bouton(bx+84,by+37,76,16,"Reinitialiser",Placement::reinitialiser));
        boutons.add(new Bouton(bx+166,by+37,74,16,"Terminer",this::close));
        for(Bouton button:boutons) {
            Theme.rect(c,button.x(),button.y(),button.w(),button.h(),Theme.CARTE);
            Theme.texteCentre(c,this.textRenderer,button.libelle(),button.x()+button.w()/2,button.y()+4,Theme.TEXTE);
        }
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubleclic) {
        /*  Les boutons du bandeau passent devant tout le reste. */
        if(supprimer!=null&&click.x()>=supprimer.x()&&click.x()<supprimer.x()+supprimer.w()&&click.y()>=supprimer.y()&&click.y()<supprimer.y()+supprimer.h()){supprimer.action().run();return true;}
        for (Bouton b : boutons) {
            if (click.x() >= b.x() && click.x() < b.x() + b.w()
                    && click.y() >= b.y() && click.y() < b.y() + b.h()) {
                b.action().run();
                return true;
            }
        }
        for (Map.Entry<String, Cadres.Cadre> e : Cadres.tous()) {
            Cadres.Cadre cadre = e.getValue();
            if(cadre==null)continue;
            int edgeX=Math.abs(click.x()-cadre.x)<=4?-1:Math.abs(click.x()-(cadre.x+cadre.w))<=4?1:0;
            int edgeY=Math.abs(click.y()-cadre.y)<=4?-1:Math.abs(click.y()-(cadre.y+cadre.h))<=4?1:0;
            boolean inRange=click.x()>=cadre.x-4&&click.x()<=cadre.x+cadre.w+4&&click.y()>=cadre.y-4&&click.y()<=cadre.y+cadre.h+4;
            boolean coin=inRange&&(edgeX!=0||edgeY!=0);
            if(!coin&&!cadre.contient(click.x(),click.y()))continue;
            Placement.Element element = Placement.parId(e.getKey());
            if (element == null) continue;
            enCours = element;redimensionne=coin;scaleDepart=element.scale;sourisDepart=click.x();sourisYDepart=click.y();largeurDepart=cadre.w;hauteurDepart=cadre.h;xDepart=cadre.x;yDepart=cadre.y;bordX=edgeX;bordY=edgeY;
            ecartX = (int) click.x() - cadre.x;
            ecartY = (int) click.y() - cadre.y;
            return true;
        }
        return true;
    }

    @Override
    public boolean mouseReleased(Click click) {
        if (enCours != null) {
            enCours = null;
            Placement.sauver();
        }
        return true;
    }

    @Override
    public void removed() {
        Placement.sauver();
        if (enCours != null) {
            enCours = null;
            Placement.sauver();
        }
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return true;
    }

    /** Ferme l editeur en enregistrant la position. */
    static void fermer(MinecraftClient cl) {
        Placement.sauver();
        if (cl.currentScreen instanceof EcranEdition) {
            cl.setScreen(null);
        }
    }
}
