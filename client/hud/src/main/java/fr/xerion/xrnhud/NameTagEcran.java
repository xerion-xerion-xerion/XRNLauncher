package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
final class NameTagEcran extends Screen {
 private final Screen parent;NameTagEcran(Screen parent){super(Text.literal("Mon name tag"));this.parent=parent;}
 private void button(String text,int x,int y,int w,Runnable action){addDrawableChild(ButtonWidget.builder(Text.literal(text),b->{action.run();Placement.sauver();if(client.currentScreen==this)clearAndInit();}).dimensions(x,y,w,20).build());}
 @Override protected void init(){int x=width/2-165,y=Math.max(20,height/2-112);
  button("Couleur : "+(NameTag.actif?"active":"vanilla"),x,y+21,160,()->NameTag.actif=!NameTag.actif);
  button("Degrade : "+(NameTag.gradient?"oui":"non"),x+170,y+21,160,()->NameTag.gradient=!NameTag.gradient);
  button("Mon badge XRN : "+(NameTag.badge?"visible":"masque"),x,y+48,160,()->NameTag.badge=!NameTag.badge);
  button("Decorations : "+(NameTag.masquerDecorations?"masquees":"conservees"),x+170,y+48,160,()->NameTag.masquerDecorations=!NameTag.masquerDecorations);
  button("Couleur de depart",x,y+78,160,()->client.setScreen(new CouleurEcran(this,NameTag.debut,c->NameTag.debut=c)));
  button("Couleur de fin",x+170,y+78,160,()->client.setScreen(new CouleurEcran(this,NameTag.fin,c->NameTag.fin=c)));
  button("Espace",x,y+110,104,()->{NameTag.debut=0xFFA78BFA;NameTag.fin=0xFFF4EEFF;NameTag.gradient=true;});
  button("Aurore",x+112,y+110,104,()->{NameTag.debut=0xFF60CFFA;NameTag.fin=0xFFCB9CFF;NameTag.gradient=true;});
  button("Crepuscule",x+224,y+110,106,()->{NameTag.debut=0xFFFF87C4;NameTag.fin=0xFFFFD8B0;NameTag.gradient=true;});
  button("Retour",x+230,y+206,100,this::close);
 }
 @Override public void render(DrawContext c,int mx,int my,float delta){int x=width/2-165,y=Math.max(20,height/2-112);Theme.arrondi(c,x-12,y-16,354,250,0xFA18151F,0xFF655176);Theme.texte(c,textRenderer,"MON NAME TAG",x,y-5,Theme.TEXTE);
  c.drawText(textRenderer,NameTag.personnaliser(Text.literal("Xerion"),"Xerion"),width/2-20,y+151,Theme.TEXTE,true);
  Theme.texte(c,textRenderer,"Partage via le relais XRN si configure",x,y+178,Theme.TEXTE_DOUX);Theme.texte(c,textRenderer,"Les badges dessines par un autre mod peuvent rester visibles.",x,y+192,Theme.TEXTE_FAIBLE);
  super.render(c,mx,my,delta);Theme.boutons(c,textRenderer,children(),mx,my);
 }
 @Override public void close(){client.setScreen(parent);}@Override public boolean shouldPause(){return false;}
}
