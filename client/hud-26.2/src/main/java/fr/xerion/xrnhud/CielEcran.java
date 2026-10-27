package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;import net.minecraft.client.gui.screens.Screen;import net.minecraft.client.gui.components.Button;import net.minecraft.network.chat.Component;
final class CielEcran extends Screen {
 private final Screen parent;CielEcran(Screen parent){super(Component.literal("Ciel XRN"));this.parent=parent;}
 private void button(String label,int x,int y,int w,Runnable action){addRenderableWidget(Button.builder(Component.literal(label),b->{action.run();Placement.sauver();if(minecraft.gui.screen()==this)rebuildWidgets();}).bounds(x,y,w,20).build());}
 @Override protected void init(){int x=width/2-160,y=height/2-87;
  button("Ciel : "+(Ciel.actif?"actif":"Vanilla"),x,y+25,156,()->Ciel.actif=!Ciel.actif);
  button("Style : "+Ciel.nom(),x+164,y+25,156,()->Ciel.mode=1-Ciel.mode);
  button("Luminosite : "+Ciel.luminosite,x,y+53,156,()->Ciel.luminosite=Ciel.luminosite>=3?.5f:Ciel.luminosite+.5f);
  button("Teinte",x+164,y+53,156,()->minecraft.gui.setScreen(new CouleurEcran(this,Ciel.teinte,color->Ciel.teinte=color)));
  button("Soleil / lune : "+(Ciel.astres?"visibles":"masques"),x,y+81,320,()->Ciel.astres=!Ciel.astres);
  button("Reinitialiser",x,y+141,130,()->{Ciel.luminosite=1;Ciel.teinte=0xFFFFFFFF;Ciel.astres=true;});button("Retour",x+220,y+141,100,this::onClose);
 }
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){int x=width/2-160,y=height/2-87;Theme.arrondi(c,x-12,y-16,344,192,0xFA18151F,0xFF655176);Theme.texte(c,font,"CIEL XRN",x,y-3,Theme.TEXTE);Theme.texte(c,font,"Overworld uniquement. Un shader reste prioritaire.",x,y+114,Theme.TEXTE_DOUX);super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);}
 @Override public void onClose(){minecraft.gui.setScreen(parent);}@Override public boolean isPauseScreen(){return false;}
}
