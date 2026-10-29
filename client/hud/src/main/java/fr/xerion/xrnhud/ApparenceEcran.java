package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
final class ApparenceEcran extends Screen {
 private final Screen parent;ApparenceEcran(Screen p){super(Text.literal("Apparence du menu"));parent=p;}
 private void button(String text,int x,int y,int w,Runnable action){addDrawableChild(ButtonWidget.builder(Text.literal(text),b->{action.run();Placement.sauver();if(client.currentScreen==this)clearAndInit();}).dimensions(x,y,w,22).build());}
 protected void init(){int x=width/2-150,y=height/2-86;
  button("Choisir la couleur du menu",x,y+20,300,()->client.setScreen(new CouleurEcran(this,Theme.couleur,Theme::appliquerCouleur)));
  int[] colors={0xFFA78BFA,0xFF56BFFF,0xFF70D5AE,0xFFFFA566};String[] names={"Violet XRN","Azur","Menthe","Ambre"};for(int i=0;i<4;i++){final int n=i;button(names[i],x+(i%2)*156,y+54+(i/2)*28,144,()->Theme.appliquerCouleur(colors[n]));}
  button("Langue : "+(Langue.actuelle().equals("fr")?"Français":"English"),x,y+116,144,()->Langue.choisir(Langue.actuelle().equals("fr")?"en":"fr"));button("Recentrer la fenetre XRN",x+156,y+116,144,MenuEcran::recentrer);button("Retour",x+200,y+150,100,this::close);
 }
 public void render(DrawContext c,int mx,int my,float d){int x=width/2-150,y=height/2-86;Theme.arrondi(c,x-12,y-20,324,206,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texte(c,textRenderer,"APPARENCE DU MENU",x,y-7,Theme.TEXTE);super.render(c,mx,my,d);Theme.boutons(c,textRenderer,children(),mx,my);}
 public void close(){client.setScreen(parent);}public boolean shouldPause(){return false;}
}
