package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

final class VisuelsEcran extends Screen {
    private final Screen parent;
    VisuelsEcran(Screen parent){super(Text.literal("Contours et hitboxes"));this.parent=parent;}
    private void bouton(String label,int x,int y,int w,Runnable action){addDrawableChild(ButtonWidget.builder(Text.literal(label),b->{action.run();Placement.sauver();clearAndInit();}).dimensions(x,y,w,20).build());}
    @Override protected void init(){
        int x=width/2-160,y=height/2-78;
        bouton("Hitboxes : "+(Visuels.hitboxes?"actives":"inactives"),x,y+20,180,()->Visuels.hitboxes=!Visuels.hitboxes);
        bouton("Couleur",x+188,y+20,62,()->client.setScreen(new CouleurEcran(this,Visuels.hitColor,value->Visuels.hitColor=value)));
        bouton(Visuels.hitWidth+" px",x+258,y+20,62,()->Visuels.hitWidth=Visuels.hitWidth>=4?.5f:Visuels.hitWidth+.5f);
        bouton("Contours : "+(Visuels.contours?"actifs":"inactifs"),x,y+72,180,()->Visuels.contours=!Visuels.contours);
        bouton("Couleur",x+188,y+72,62,()->client.setScreen(new CouleurEcran(this,Visuels.blockColor,value->Visuels.blockColor=value)));
        bouton(Visuels.blockWidth+" px",x+258,y+72,62,()->Visuels.blockWidth=Visuels.blockWidth>=4?.5f:Visuels.blockWidth+.5f);
        bouton("Retour",x+230,y+128,90,this::close);
    }
    @Override public void render(DrawContext c,int mx,int my,float delta){int x=width/2-160,y=height/2-78;Theme.arrondi(c,x-10,y-12,340,176,0xF218151F,0xFF61506F);Theme.texte(c,textRenderer,"CONTOURS ET HITBOXES",x,y-4,Theme.TEXTE);Theme.rect(c,x+188,y+44,62,3,Visuels.hitColor);Theme.rect(c,x+188,y+96,62,3,Visuels.blockColor);Theme.texte(c,textRenderer,"Affichage uniquement · collisions du jeu conservees",x,y+112,Theme.TEXTE_FAIBLE);Theme.champs(c,children());super.render(c,mx,my,delta);Theme.boutons(c,textRenderer,children(),mx,my);}
    @Override public void close(){client.setScreen(parent);}
    @Override public boolean shouldPause(){return false;}
}
