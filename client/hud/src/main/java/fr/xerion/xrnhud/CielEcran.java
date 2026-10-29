package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;import net.minecraft.client.gui.screen.Screen;import net.minecraft.client.gui.widget.ButtonWidget;import net.minecraft.client.gui.widget.SliderWidget;import net.minecraft.text.Text;import java.util.function.DoubleConsumer;import java.util.function.Supplier;
final class CielEcran extends Screen {
 private final Screen parent;CielEcran(Screen parent){super(Text.literal("Ciel XRN"));this.parent=parent;}
 private void button(String label,int x,int y,int w,Runnable action){addDrawableChild(ButtonWidget.builder(Text.literal(label),b->{action.run();Placement.sauver();if(client.currentScreen==this)clearAndInit();}).dimensions(x,y,w,20).build());}
 private void slider(String name,Supplier<String> label,double initial,int x,int y,int w,DoubleConsumer action){addDrawableChild(new SliderWidget(x,y,w,30,Text.literal(name),initial){protected void updateMessage(){setMessage(Text.literal(name+" : "+label.get()));}protected void applyValue(){action.accept(value);updateMessage();}public void renderWidget(DrawContext c,int mx,int my,float dt){Theme.texte(c,textRenderer,name,getX(),getY(),Theme.TEXTE_DOUX);String text=label.get();Theme.texte(c,textRenderer,text,getX()+getWidth()-textRenderer.getWidth(text),getY(),Theme.ACCENT);int track=getY()+21,knob=getX()+4+(int)Math.round(value*(getWidth()-8));Theme.arrondi(c,getX(),track-2,getWidth(),4,Theme.COMMUT,0);Theme.rect(c,getX(),track-2,knob-getX(),4,Theme.ACCENT);Theme.arrondi(c,knob-4,track-5,8,10,Theme.TEXTE,isFocused()?Theme.ACCENT:0);}});}
 protected void init(){int x=width/2-180,y=height/2-132;
  button("Ciel : "+(Ciel.actif?"actif":"Vanilla"),x,y+20,176,()->Ciel.actif=!Ciel.actif);button("Style : "+Ciel.nom(),x+184,y+20,176,()->Ciel.mode=1-Ciel.mode);
  button("Animation : "+(Ciel.anime?"oui":"non"),x,y+48,176,()->Ciel.anime=!Ciel.anime);button("Lueurs : "+(Ciel.effets?"oui":"non"),x+184,y+48,176,()->Ciel.effets=!Ciel.effets);
  slider("Vitesse du ciel",()->String.format(java.util.Locale.ROOT,"%.2f ×",Ciel.vitesse),(Ciel.vitesse-.25)/2.75,x,y+78,360,v->Ciel.vitesse=(float)(.25+v*2.75));
  button("Ambiance sonore : "+(Ciel.ambiance?"oui":"non"),x,y+118,176,()->Ciel.ambiance=!Ciel.ambiance);button("Soleil / lune : "+(Ciel.astres?"oui":"non"),x+184,y+118,176,()->Ciel.astres=!Ciel.astres);
  slider("Volume de l'ambiance",()->Math.round(Ciel.volume*100)+" %",Ciel.volume,x,y+148,360,v->Ciel.volume=(float)v);
  button("Teinte",x,y+188,176,()->client.setScreen(new CouleurEcran(this,Ciel.teinte,color->Ciel.teinte=color)));button("Luminosite : "+Ciel.luminosite,x+184,y+188,176,()->Ciel.luminosite=Ciel.luminosite>=3?.5f:Ciel.luminosite+.5f);
  button("Reinitialiser",x,y+240,130,()->{Ciel.luminosite=1;Ciel.teinte=0xFFFFFFFF;Ciel.astres=true;Ciel.anime=true;Ciel.effets=true;Ciel.vitesse=1;Ciel.ambiance=false;Ciel.volume=.2f;});button("Retour",x+260,y+240,100,this::close);
 }
 public void render(DrawContext c,int mx,int my,float dt){int x=width/2-180,y=height/2-132;Theme.arrondi(c,x-12,y-17,384,287,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,textRenderer,"CIELS ET AMBIANCES",x,y-5,Theme.TEXTE);Theme.texte(c,textRenderer,"Overworld · Priorite aux shaders actifs",x,y+216,Theme.TEXTE_DOUX);super.render(c,mx,my,dt);Theme.boutons(c,textRenderer,children(),mx,my);}
 public void close(){Placement.sauver();client.setScreen(parent);}public boolean shouldPause(){return false;}
}
