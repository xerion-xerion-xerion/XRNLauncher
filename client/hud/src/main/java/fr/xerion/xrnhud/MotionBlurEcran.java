package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;
final class MotionBlurEcran extends Screen {
 private final Screen parent;
 MotionBlurEcran(Screen parent){super(Text.literal("Motion Blur"));this.parent=parent;}
 @Override protected void init(){int x=width/2-150,y=height/2-75;
  addDrawableChild(ButtonWidget.builder(Text.literal(MotionBlur.enabled?"Motion Blur : actif":"Motion Blur : inactif"),b->{MotionBlur.setEnabled(!MotionBlur.enabled);Placement.sauver();clearAndInit();}).dimensions(x,y+18,300,20).build());
  addDrawableChild(new SliderWidget(x,y+53,300,32,Text.literal("Intensite : "+MotionBlur.intensity+" %"),MotionBlur.intensity/100.0){
   protected void updateMessage(){setMessage(Text.literal("Intensite : "+MotionBlur.intensity+" %"));}
   protected void applyValue(){MotionBlur.setIntensity((int)Math.round(value*100));updateMessage();}
   @Override public void renderWidget(DrawContext c,int mx,int my,float delta){
    Theme.texte(c,textRenderer,"Intensite",getX(),getY(),Theme.TEXTE_DOUX);Theme.texte(c,textRenderer,MotionBlur.intensity+" %",getX()+getWidth()-30,getY(),Theme.ACCENT);
    int track=getY()+22,knob=getX()+4+(int)Math.round(value*(getWidth()-8));Theme.arrondi(c,getX(),track-2,getWidth(),4,0xFF393041,0);if(knob>getX())Theme.rect(c,getX(),track-2,knob-getX(),4,Theme.ACCENT);Theme.arrondi(c,knob-4,track-5,8,10,0xFFE8DAFF,isFocused()?Theme.ACCENT:0);
   }
  });
  addDrawableChild(ButtonWidget.builder(Text.literal("Reinitialiser"),b->{MotionBlur.setIntensity(35);clearAndInit();}).dimensions(x,y+127,130,20).build());
  addDrawableChild(ButtonWidget.builder(Text.literal("Retour"),b->close()).dimensions(x+210,y+127,90,20).build());
 }
 @Override public void render(DrawContext c,int mx,int my,float delta){int x=width/2-150,y=height/2-75;Theme.arrondi(c,x-16,y-18,332,182,0xFA18151F,0xFF655176);Theme.texte(c,textRenderer,"MOTION BLUR",x,y-5,Theme.TEXTE);Theme.texte(c,textRenderer,"0 % : net     100 % : trainee prononcee",x,y+94,Theme.TEXTE_DOUX);Theme.texte(c,textRenderer,MotionBlur.status()+" · HUD conserve net",x,y+110,Theme.TEXTE_FAIBLE);super.render(c,mx,my,delta);Theme.boutons(c,textRenderer,children(),mx,my);}
 @Override public void close(){Placement.sauver();client.setScreen(parent);}
 @Override public boolean shouldPause(){return false;}
}
