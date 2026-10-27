package fr.xerion.xrnhud;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

final class BalisesEcran extends Screen {
    private final Screen parent;
    private int page;
    private EditBox name;
    BalisesEcran(Screen parent){super(Component.literal("Balises"));this.parent=parent;}
    @Override protected void init(){
        int x=width/2-160,y=Math.max(30,height/2-108);
        name=new ChampTexte(font,x,y+27,210,20,Component.literal("Nom de la balise"));name.setHint(Component.literal("Nom de la balise"));name.setMaxLength(28);name.setBordered(false);addRenderableWidget(name);
        addRenderableWidget(Button.builder(Component.literal("Ajouter ici"),b->{if(Balises.ajouter(minecraft,name.getValue()))rebuildWidgets();}).bounds(x+218,y+27,102,20).build());
        var points=Balises.liste(minecraft);int perPage=Math.max(1,Math.min(6,(height-y-99)/24));page=Math.max(0,Math.min(page,Math.max(0,(points.size()-1)/perPage)));
        for(int i=page*perPage;i<Math.min(points.size(),(page+1)*perPage);i++){
            var point=points.get(i);int row=y+58+(i-page*perPage)*24;
            String label=(point.enabled()?"✓ ":"— ")+point.name()+"  "+(int)point.x()+", "+(int)point.z();
            addRenderableWidget(Button.builder(Component.literal(label),b->{Balises.basculer(point.id());rebuildWidgets();}).bounds(x,row,290,20).build());
            addRenderableWidget(Button.builder(Component.literal("×"),b->{Balises.supprimer(point.id());rebuildWidgets();}).bounds(x+296,row,24,20).build());
        }
        int bottom=Math.min(height-27,y+62+perPage*24);
        addRenderableWidget(Button.builder(Component.literal("Haut. "+Balises.hauteur),b->{Balises.hauteur=Balises.hauteur>=1024?128:Balises.hauteur*2;Placement.sauver();rebuildWidgets();}).bounds(x+68,bottom,86,20).build());
        addRenderableWidget(Button.builder(Component.literal("Couleur"),b->minecraft.gui.setScreen(new CouleurEcran(this,Balises.couleur,value->Balises.couleur=value))).bounds(x+160,bottom,66,20).build());
        addRenderableWidget(Button.builder(Component.literal("←"),b->{page--;rebuildWidgets();}).bounds(x,bottom,26,20).build());
        addRenderableWidget(Button.builder(Component.literal("→"),b->{page++;rebuildWidgets();}).bounds(x+32,bottom,26,20).build());
        addRenderableWidget(Button.builder(Component.literal("Retour"),b->onClose()).bounds(x+232,bottom,88,20).build());
    }
    @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
        int x=width/2-160,y=Math.max(30,height/2-108);
        Theme.arrondi(c,x-10,y-10,340,Math.min(height-y+2,246),0xF219151F,0xFF61506F);
        Theme.texte(c,font,"BALISES · ce monde / serveur",x,y,Theme.TEXTE);
        if(!Balises.erreur.isEmpty())Theme.texte(c,font,Balises.erreur,x,y+15,Theme.ROUGE);
        Theme.champs(c,children());super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);
    }
    @Override public void onClose(){minecraft.gui.setScreen(parent);}
    @Override public boolean isPauseScreen(){return false;}
}
