package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;import net.minecraft.client.gui.Click;import net.minecraft.client.gui.screen.Screen;import net.minecraft.text.Text;
final class CompteEcran extends Screen {
 private final Screen parent;private int x,y,w;CompteEcran(Screen p){super(Text.literal("Compte Minecraft"));parent=p;}
 @Override public void renderBackground(DrawContext c,int mx,int my,float d){super.renderPanoramaBackground(c,d);c.fill(0,0,width,height,0x990B0D14);}
 @Override public void render(DrawContext c,int mx,int my,float d){w=Math.min(380,width-24);x=(width-w)/2;y=(height-200)/2;Theme.arrondi(c,x,y,w,200,AtelierUi.BACK,AtelierUi.LINE);ApercuJoueur.tete(c,x+20,y+23,48);AtelierUi.text(c,"Compte Minecraft",x+86,y+25,1.2f,Theme.TEXTE);AtelierUi.text(c,client.getGameProfile().name(),x+86,y+49,1.5f,Theme.ACCENT);AtelierUi.center(c,client.getGameProfile().id().toString(),x+w/2,y+100,.8f,Theme.TEXTE_DOUX);AtelierUi.capsule(c,"Gérer le compte",x+20,y+131,w-40,AtelierUi.over(mx,my,x+20,y+131,w-40,28));AtelierUi.capsule(c,"Retour",x+20,y+165,w-40,AtelierUi.over(mx,my,x+20,y+165,w-40,28));}
 @Override public boolean mouseClicked(Click e,boolean twice){if(e.button()==0){if(AtelierUi.over(e.x(),e.y(),x+20,y+131,w-40,28)){LauncherLien.ouvrir("account");return true;}if(AtelierUi.over(e.x(),e.y(),x+20,y+165,w-40,28)){close();return true;}}return super.mouseClicked(e,twice);}
 @Override public void close(){client.setScreen(parent);}@Override public boolean shouldPause(){return false;}
}
