package fr.xerion.xrnhud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;
final class ApparenceEcran extends Screen {
 private final Screen parent;ApparenceEcran(Screen p){super(Component.literal("Apparence du menu"));parent=p;}
 private void button(String text,int x,int y,int w,Runnable action){addRenderableWidget(Button.builder(Component.literal(text),b->{action.run();Placement.sauver();if(minecraft.gui.screen()==this)rebuildWidgets();}).bounds(x,y,w,22).build());}
 protected void init(){int x=width/2-150,y=height/2-86;
  button("Choisir la couleur du menu",x,y+20,300,()->minecraft.gui.setScreen(new CouleurEcran(this,Theme.couleur,Theme::appliquerCouleur)));
  int[] colors={0xFFA78BFA,0xFF56BFFF,0xFF70D5AE,0xFFFFA566};String[] names={"Violet XRN","Azur","Menthe","Ambre"};for(int i=0;i<4;i++){final int n=i;button(names[i],x+(i%2)*156,y+54+(i/2)*28,144,()->Theme.appliquerCouleur(colors[n]));}
  button("Langue : "+switch(Langue.actuelle()){case "de"->"Deutsch";case "en"->"English";default->"Français";},x,y+116,144,()->minecraft.gui.setScreen(new LangueEcran(this)));button("Recentrer la fenetre XRN",x+156,y+116,144,MenuEcran::recentrer);button("Retour",x+200,y+150,100,this::onClose);
 }
 public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float d){int x=width/2-150,y=height/2-86;Theme.arrondi(c,x-12,y-20,324,206,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,font,"APPARENCE DU MENU",x,y-7,Theme.TEXTE);super.extractRenderState(c,mx,my,d);Theme.boutons(c,font,children(),mx,my);}
 public void onClose(){minecraft.gui.setScreen(parent);}public boolean isPauseScreen(){return false;}
}
