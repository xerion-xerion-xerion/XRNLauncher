package fr.xerion.xrnhud;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

final class BalisesEcran extends Screen {
    private final Screen parent;
    private int page;
    private TextFieldWidget name;
    BalisesEcran(Screen parent){super(Text.literal("Balises"));this.parent=parent;}
    @Override protected void init(){
        int x=width/2-160,y=Math.max(30,height/2-108);
        name=new ChampTexte(textRenderer,x,y+27,210,20,Text.literal("Nom de la balise"));name.setPlaceholder(Text.literal("Nom de la balise"));name.setMaxLength(28);name.setDrawsBackground(false);addDrawableChild(name);
        addDrawableChild(ButtonWidget.builder(Text.literal("Ajouter ici"),b->{if(Balises.ajouter(client,name.getText()))clearAndInit();}).dimensions(x+218,y+27,102,20).build());
        var points=Balises.liste(client);int perPage=Math.max(1,Math.min(6,(height-y-99)/24));page=Math.max(0,Math.min(page,Math.max(0,(points.size()-1)/perPage)));
        for(int i=page*perPage;i<Math.min(points.size(),(page+1)*perPage);i++){
            var point=points.get(i);int row=y+58+(i-page*perPage)*24;
            String label=(point.enabled()?"✓ ":"— ")+point.name()+"  "+(int)point.x()+", "+(int)point.z();
            addDrawableChild(ButtonWidget.builder(Text.literal(label),b->{Balises.basculer(point.id());clearAndInit();}).dimensions(x,row,290,20).build());
            addDrawableChild(ButtonWidget.builder(Text.literal("×"),b->{Balises.supprimer(point.id());clearAndInit();}).dimensions(x+296,row,24,20).build());
        }
        int bottom=Math.min(height-27,y+62+perPage*24);
        addDrawableChild(ButtonWidget.builder(Text.literal("Haut. "+Balises.hauteur),b->{Balises.hauteur=Balises.hauteur>=1024?128:Balises.hauteur*2;Placement.sauver();clearAndInit();}).dimensions(x+68,bottom,86,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Couleur"),b->client.setScreen(new CouleurEcran(this,Balises.couleur,value->Balises.couleur=value))).dimensions(x+160,bottom,66,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("←"),b->{page--;clearAndInit();}).dimensions(x,bottom,26,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("→"),b->{page++;clearAndInit();}).dimensions(x+32,bottom,26,20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Retour"),b->close()).dimensions(x+232,bottom,88,20).build());
    }
    @Override public void render(DrawContext c,int mx,int my,float delta){
        int x=width/2-160,y=Math.max(30,height/2-108);
        Theme.arrondi(c,x-10,y-10,340,Math.min(height-y+2,246),0xF219151F,0xFF61506F);
        Theme.texte(c,textRenderer,"BALISES · ce monde / serveur",x,y,Theme.TEXTE);
        if(!Balises.erreur.isEmpty())Theme.texte(c,textRenderer,Balises.erreur,x,y+15,Theme.ROUGE);
        Theme.champs(c,children());super.render(c,mx,my,delta);Theme.boutons(c,textRenderer,children(),mx,my);
    }
    @Override public void close(){client.setScreen(parent);}
    @Override public boolean shouldPause(){return false;}
}
