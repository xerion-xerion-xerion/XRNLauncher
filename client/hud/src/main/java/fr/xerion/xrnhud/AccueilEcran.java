package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.text.Text;
import java.util.*;
/** Minecraft controls stay centered; the cape picker owns its entire rectangle. */
public final class AccueilEcran extends Screen {
 static boolean classique;
 private record Hit(int x,int y,int w,int h,Runnable action){}
 private final java.util.List<Hit> hits=new ArrayList<>();
 private float scale=1,angle=165;private String cape=Droits.equipe();private boolean dragging,gallery;
 private int page,ox,oy,ax,ay,aw,ah;private double previousX;
 public AccueilEcran(){super(Text.literal("XRN Client"));}
 @Override protected void init(){scale=(float)Math.min(1,Math.min(width/960.0,height/560.0));ox=(Math.round(width/scale)-960)/2;oy=(Math.round(height/scale)-560)/2;}
 private void hit(int x,int y,int w,int h,Runnable action){hits.add(new Hit(x,y,w,h,action));}
 private void button(DrawContext c,String label,String icon,int x,int y,int w,int h,double mx,double my,Runnable action){
  AtelierUi.card(c,x,y,w,h,AtelierUi.over(mx,my,x,y,w,h),false);
  if(!icon.isEmpty()){if(icon.equals("Coins"))AtelierUi.coin(c,x+12,y+(h-20)/2,20);else AtelierUi.icon(c,icon,x+12,y+(h-20)/2,20);}
  AtelierUi.center(c,label,x+w/2,y+(h-10)/2,1.1f,Theme.TEXTE);hit(x,y,w,h,action);
 }
 @Override public void renderBackground(DrawContext c,int mx,int my,float delta){}
 @Override public void render(DrawContext c,int mx,int my,float delta){
  super.renderPanoramaBackground(c,delta);c.fill(0,0,width,height,0x850C0E15);
  double vx=mx/scale,vy=my/scale;c.getMatrices().pushMatrix();c.getMatrices().scale(scale,scale);hits.clear();
  // The combined logo + wordmark has a measured width of 204 units.
  Theme.marque(c,ox+378,oy+82,7);AtelierUi.wordmark(c,ox+450,oy+76,132);
  button(c,client.getGameProfile().name(),"",ox+720,oy+18,210,30,vx,vy,()->client.setScreen(new CompteEcran(this)));
  ApercuJoueur.tete(c,ox+729,oy+23,20);
  int x=ox+330;

   button(c,"Jouer en solo","Monde",x,oy+205,300,36,vx,vy,()->client.setScreen(new SelectWorldScreen(this)));
   button(c,"Multijoueur","Serveurs",x,oy+253,300,36,vx,vy,()->client.setScreen(new MultiplayerScreen(this)));
   button(c,"Cosmétiques","Cape",x,oy+301,300,36,vx,vy,()->client.setScreen(new EcranGardeRobe(this)));
   button(c,"Options","Reglages",x,oy+357,145,32,vx,vy,()->client.setScreen(new OptionsScreen(this,client.options)));
   button(c,"Quitter","",x+155,oy+357,145,32,vx,vy,()->client.scheduleStop());
   button(c,"Langue","",x,oy+428,98,26,vx,vy,()->client.setScreen(new LangueEcran(this)));
   button(c,"Accueil classique","",x+108,oy+428,192,26,vx,vy,()->{classique=true;client.setScreen(new TitleScreen());});

  ax=ox+710;ay=oy+170;aw=220;ah=325;
  String capeName=cape.isEmpty()?"Aucune cape":Droits.nom(cape);
  AtelierUi.center(c,capeName,ax+aw/2,ay+ah-22,1,Theme.TEXTE);
  boolean owned=Droits.possede(cape),equipped=!cape.isEmpty()&&Droits.equipe().equals(cape);
  String status=cape.isEmpty()?"":equipped?"Équipée":owned?"Équiper":"Aperçu · verrouillée";
  if(owned&&!equipped)button(c,status,"",ax+12,ay+ah-6,aw-24,26,vx,vy,()->Droits.equiper(cape));
  else AtelierUi.center(c,status,ax+aw/2,ay+ah+2,.85f,equipped?Theme.ACCENT:Theme.TEXTE_DOUX);
  c.getMatrices().popMatrix();ApercuJoueur.dessiner(c,Math.round(ax*scale),Math.round(ay*scale),Math.round(aw*scale),Math.round((ah-35)*scale),angle,cape);
 }
 @Override public boolean mouseClicked(Click e,boolean twice){if(e.button()!=0)return super.mouseClicked(e,twice);double x=e.x()/scale,y=e.y()/scale;for(Hit h:hits)if(AtelierUi.over(x,y,h.x,h.y,h.w,h.h)){h.action.run();return true;}if(AtelierUi.over(x,y,ax,ay,aw,ah-35)){dragging=true;previousX=x;return true;}return super.mouseClicked(e,twice);}
 @Override public boolean mouseDragged(Click e,double dx,double dy){if(dragging){double x=e.x()/scale;angle=(float)Math.clamp(angle+(x-previousX)*.8,-175,175);previousX=x;return true;}return super.mouseDragged(e,dx,dy);}
 @Override public boolean mouseReleased(Click e){dragging=false;return super.mouseReleased(e);}
 @Override public boolean shouldCloseOnEsc(){return false;}
}
