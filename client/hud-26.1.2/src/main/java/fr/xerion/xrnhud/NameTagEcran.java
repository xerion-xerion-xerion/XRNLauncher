package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;
final class NameTagEcran extends Screen {
 private Button animatedButton,rainbowButton;
 private final Screen parent;NameTagEcran(Screen parent){super(Component.literal("Mon name tag"));this.parent=parent;}
 private Button button(String text,int x,int y,int w,Runnable action){return addRenderableWidget(Button.builder(Component.literal(text),b->{action.run();Placement.sauver();if(minecraft.screen==this)rebuildWidgets();}).bounds(x,y,w,22).build());}
 @Override protected void init(){int x=width/2-170,y=Math.max(22,height/2-132);
  button("Couleur : "+(NameTag.actif?"active":"vanilla"),x,y+24,164,()->NameTag.actif=!NameTag.actif);
  button("Degrade : "+(NameTag.gradient?"oui":"non"),x+176,y+24,164,()->NameTag.gradient=!NameTag.gradient);
  button("Badge XRN : "+(NameTag.badge?"visible":"masque"),x,y+54,164,()->NameTag.badge=!NameTag.badge);
  button("Decorations : "+(NameTag.masquerDecorations?"masquees":"conservees"),x+176,y+54,164,()->NameTag.masquerDecorations=!NameTag.masquerDecorations);
  button("Couleur de depart",x,y+84,164,()->minecraft.setScreen(new CouleurEcran(this,NameTag.debut,c->NameTag.debut=c)));
  button("Couleur de fin",x+176,y+84,164,()->minecraft.setScreen(new CouleurEcran(this,NameTag.fin,c->NameTag.fin=c)));
  animatedButton=button("Degrade anime : "+(NameTag.anime?"oui":"non"),x,y+114,164,()->{NameTag.anime=!NameTag.anime;if(NameTag.anime){NameTag.actif=true;NameTag.gradient=true;NameTag.arcenciel=false;}});
  rainbowButton=button("Arc-en-ciel : "+(NameTag.arcenciel?"oui":"non"),x+176,y+114,164,()->{NameTag.arcenciel=!NameTag.arcenciel;if(NameTag.arcenciel){NameTag.actif=true;NameTag.anime=false;}});
  animatedButton.active=rainbowButton.active=true;
  button("Violet / blanc",x,y+146,108,()->{NameTag.debut=0xFFA78BFA;NameTag.fin=0xFFF4EEFF;NameTag.gradient=true;});
  button("Aurore",x+116,y+146,108,()->{NameTag.debut=0xFF60CFFA;NameTag.fin=0xFFCB9CFF;NameTag.gradient=true;});
  button("Crepuscule",x+232,y+146,108,()->{NameTag.debut=0xFFFF87C4;NameTag.fin=0xFFFFD8B0;NameTag.gradient=true;});
  button("Retour",x+240,y+230,100,this::onClose);
 }
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){int x=width/2-170,y=Math.max(22,height/2-132);Theme.arrondi(c,x-12,y-16,364,280,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,font,"MON NAME TAG",x,y-5,Theme.TEXTE);
  c.text(font,NameTag.personnaliser(Component.literal("Votre pseudo"),"Votre pseudo"),x+100,y+188,Theme.TEXTE,true);
  Theme.texte(c,font,"Cliquez sur les couleurs pour ouvrir la palette.",x,y+212,Theme.TEXTE_DOUX);
  super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);  Theme.rect(c,x+148,y+91,9,9,NameTag.debut);Theme.rect(c,x+324,y+91,9,9,NameTag.fin);
 }
 @Override public void onClose(){minecraft.setScreen(parent);}@Override public boolean isPauseScreen(){return false;}
}
