package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;
final class OptimiseursEcran extends Screen {
 private Button animatedButton,rainbowButton;
 private final Screen parent;OptimiseursEcran(Screen parent){super(Component.literal("Mon name tag"));this.parent=parent;}
 private Button button(String text,int x,int y,int w,Runnable action){return addRenderableWidget(Button.builder(Component.literal(text),b->{action.run();Placement.sauver();if(minecraft.screen==this)rebuildWidgets();}).bounds(x,y,w,22).build());}
 @Override protected void init(){int x=width/2-170,y=Math.max(22,height/2-132);
  button("Optimiseurs : "+(Optimisations.actif?"actifs":"inactifs"),x,y+24,340,()->Optimisations.actif=!Optimisations.actif);
  button("Cristaux : "+(Optimisations.cristaux?"actif":"inactif"),x,y+54,164,()->Optimisations.cristaux=!Optimisations.cristaux);
  button("Perles : "+(Optimisations.perles?"actif":"inactif"),x+176,y+54,164,()->Optimisations.perles=!Optimisations.perles);
  button("Ancres : "+(Optimisations.ancres?"actif":"inactif"),x,y+84,164,()->Optimisations.ancres=!Optimisations.ancres);
  button("Nourriture : "+(Optimisations.nourriture?"actif":"inactif"),x+176,y+84,164,()->Optimisations.nourriture=!Optimisations.nourriture);
  button("Particules lointaines : "+(Optimisations.lointaines?"actif":"inactif"),x,y+114,340,()->Optimisations.lointaines=!Optimisations.lointaines);
  button("Profil FPS Plus : "+(Performance.actif?"actif":"inactif"),x,y+144,340,()->{Reglages.boostNote();Performance.basculer();});
  button("Retour",x+240,y+230,100,this::onClose);
 }
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){int x=width/2-170,y=Math.max(22,height/2-132);Theme.arrondi(c,x-12,y-16,364,280,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,font,"OPTIMISEURS",x,y-5,Theme.TEXTE);
Theme.texte(c,font,"Rendu local uniquement, sans modifier les delais.",x,y+182,Theme.TEXTE_DOUX);Theme.texte(c,font,"Particules evitees : "+Optimisations.epargnees,x,y+198,Theme.TEXTE_DOUX);
  super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);  
 }
 @Override public void onClose(){minecraft.setScreen(parent);}@Override public boolean isPauseScreen(){return false;}
}
