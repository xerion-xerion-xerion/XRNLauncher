package fr.xerion.xrnhud;
import net.minecraft.client.gui.screen.Screen;import net.minecraft.client.gui.DrawContext;import net.minecraft.client.gui.widget.ButtonWidget;import net.minecraft.text.Text;
final class LangueEcran extends Screen {
 private final Screen parent;private static final String[] CODES={"fr","en","de"},NAMES={"Français","English","Deutsch"};
 LangueEcran(Screen parent){super(Text.literal("Language / Langue"));this.parent=parent;}
 @Override protected void init(){int w=Math.min(300,width-32),x=(width-w)/2,y=Math.max(24,(height-160)/2);
 for(int i=0;i<CODES.length;i++){final String code=CODES[i];addDrawableChild(ButtonWidget.builder(Text.literal((Langue.actuelle().equals(code)?"✓  ":"")+NAMES[i]),b->{Langue.choisir(code);client.setScreen(new LangueEcran(parent));}).dimensions(x,y+27+i*30,w,22).build());}
 addDrawableChild(ButtonWidget.builder(Text.literal(Langue.t("Retour")),b->close()).dimensions(x,y+124,w,22).build());}
 @Override public void render(DrawContext c,int mx,int my,float delta){int w=Math.min(300,width-32),x=(width-w)/2,y=Math.max(24,(height-160)/2);Theme.arrondi(c,x-10,y-12,w+20,170,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texteCentre(c,textRenderer,"Language / Langue",width/2,y,Theme.TEXTE);super.render(c,mx,my,delta);Theme.boutons(c,textRenderer,children(),mx,my);}
 @Override public void close(){client.setScreen(parent);}@Override public boolean shouldPause(){return false;}
}
