package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.network.chat.Component;
final class MotionBlurEcran extends Screen {
 private final Screen parent;
 MotionBlurEcran(Screen parent){super(Component.literal("Motion Blur"));this.parent=parent;}
 @Override protected void init(){int x=width/2-150,y=height/2-75;
  addRenderableWidget(Button.builder(Component.literal(MotionBlur.enabled?"Motion Blur : actif":"Motion Blur : inactif"),b->{MotionBlur.setEnabled(!MotionBlur.enabled);Placement.sauver();rebuildWidgets();}).bounds(x,y+18,300,20).build());
  addRenderableWidget(new AbstractSliderButton(x,y+53,300,32,Component.literal("Intensite : "+MotionBlur.intensity+" %"),MotionBlur.intensity/100.0){
   protected void updateMessage(){setMessage(Component.literal("Intensite : "+MotionBlur.intensity+" %"));}
   protected void applyValue(){MotionBlur.setIntensity((int)Math.round(value*100));updateMessage();}
   @Override public void extractWidgetRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){
    Theme.texte(c,font,"Intensite",getX(),getY(),Theme.TEXTE_DOUX);Theme.texte(c,font,MotionBlur.intensity+" %",getX()+getWidth()-30,getY(),Theme.ACCENT);
    int track=getY()+22,knob=getX()+4+(int)Math.round(value*(getWidth()-8));Theme.arrondi(c,getX(),track-2,getWidth(),4,0xFF393041,0);if(knob>getX())Theme.rect(c,getX(),track-2,knob-getX(),4,Theme.ACCENT);Theme.arrondi(c,knob-4,track-5,8,10,0xFFE8DAFF,isFocused()?Theme.ACCENT:0);
   }
  });
  addRenderableWidget(Button.builder(Component.literal("Reinitialiser"),b->{MotionBlur.setIntensity(35);rebuildWidgets();}).bounds(x,y+127,130,20).build());
  addRenderableWidget(Button.builder(Component.literal("Retour"),b->onClose()).bounds(x+210,y+127,90,20).build());
 }
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){int x=width/2-150,y=height/2-75;Theme.arrondi(c,x-16,y-18,332,182,0xFA18151F,0xFF655176);Theme.texte(c,font,"MOTION BLUR",x,y-5,Theme.TEXTE);Theme.texte(c,font,"0 % : net     100 % : trainee prononcee",x,y+94,Theme.TEXTE_DOUX);Theme.texte(c,font,MotionBlur.status()+" · HUD conserve net",x,y+110,Theme.TEXTE_FAIBLE);super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);}
 @Override public void onClose(){Placement.sauver();minecraft.setScreen(parent);}
 @Override public boolean isPauseScreen(){return false;}
}
