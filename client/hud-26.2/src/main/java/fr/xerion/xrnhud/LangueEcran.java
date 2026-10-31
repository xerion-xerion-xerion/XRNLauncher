package fr.xerion.xrnhud;
import net.minecraft.client.gui.screens.Screen;import net.minecraft.client.gui.GuiGraphicsExtractor;import net.minecraft.client.gui.components.Button;import net.minecraft.network.chat.Component;
final class LangueEcran extends Screen {
 private final Screen parent;private static final String[] CODES={"fr","en","de"},NAMES={"Français","English","Deutsch"};
 LangueEcran(Screen parent){super(Component.literal("Language / Langue"));this.parent=parent;}
 @Override protected void init(){int w=Math.min(300,width-32),x=(width-w)/2,y=Math.max(24,(height-160)/2);
 for(int i=0;i<CODES.length;i++){final String code=CODES[i];addRenderableWidget(Button.builder(Component.literal((Langue.actuelle().equals(code)?"✓  ":"")+NAMES[i]),b->{Langue.choisir(code);minecraft.gui.setScreen(new LangueEcran(parent));}).bounds(x,y+27+i*30,w,22).build());}
 addRenderableWidget(Button.builder(Component.literal(Langue.t("Retour")),b->onClose()).bounds(x,y+124,w,22).build());}
 @Override public void extractRenderState(GuiGraphicsExtractor c,int mx,int my,float delta){int w=Math.min(300,width-32),x=(width-w)/2,y=Math.max(24,(height-160)/2);Theme.arrondi(c,x-10,y-12,w+20,170,Theme.nuance(0xFA18151F),Theme.ACCENT_FORT);Theme.texteCentre(c,font,"Language / Langue",width/2,y,Theme.TEXTE);super.extractRenderState(c,mx,my,delta);Theme.boutons(c,font,children(),mx,my);}
 @Override public void onClose(){minecraft.gui.setScreen(parent);}@Override public boolean isPauseScreen(){return false;}
}
