package fr.xerion.xrnhud;
import net.minecraft.client.MinecraftClient;import net.minecraft.client.gui.DrawContext;import net.minecraft.text.Text;import java.nio.file.*;import com.google.gson.*;
/** Shared drawing language for the private interface. Geometry also supplies the hit boxes. */
final class AtelierUi {
 static final int BACK=0xF414151A,SURFACE=0xFF202128,SURFACE_HOVER=0xFF292B34,LINE=0xFF343640;
 private static final java.util.Map<Long,double[]> hoverStates=new java.util.HashMap<>();
 private static long lastWallet;private static String wallet="—";
 static String balance(){long now=System.currentTimeMillis();if(now-lastWallet<2500)return wallet;lastWallet=now;wallet="—";try{Path f=net.fabricmc.loader.api.FabricLoader.getInstance().getGameDir().resolve(".xrn-menu/wallet.json");if(Files.size(f)<16384){var o=JsonParser.parseString(Files.readString(f)).getAsJsonObject();if(o.get("uuid").getAsString().equals(MinecraftClient.getInstance().getGameProfile().id().toString().replace("-",""))&&now-o.get("at").getAsLong()<65000&&o.has("balance"))wallet=o.get("balance").getAsString();}}catch(Exception ignored){}return wallet;}
 static void text(DrawContext c,String s,int x,int y,float size,int color){c.getMatrices().pushMatrix();c.getMatrices().translate(x,y);c.getMatrices().scale(size,size);Theme.texte(c,MinecraftClient.getInstance().textRenderer,s,0,0,color);c.getMatrices().popMatrix();}
 static void center(DrawContext c,String s,int x,int y,float size,int color){int w=MinecraftClient.getInstance().textRenderer.getWidth(Langue.t(s));text(c,s,x-Math.round(w*size/2),y,size,color);}
 static void detail(DrawContext c,String s,int x,int y,int width){var font=MinecraftClient.getInstance().textRenderer;String line="";int row=0;for(String word:Langue.t(s).split(" ")){String next=line.isEmpty()?word:line+" "+word;if(font.getWidth(next)>width&& !line.isEmpty()){text(c,line,x,y+row*11,.88f,Theme.TEXTE_DOUX);if(++row>=2)return;line=word;}else line=next;}if(row<2)text(c,line,x,y+row*11,.88f,Theme.TEXTE_DOUX);}
 static boolean over(double mx,double my,int x,int y,int w,int h){return mx>=x&&mx<x+w&&my>=y&&my<y+h;}
 static void icon(DrawContext c,String id,int x,int y,int size){c.getMatrices().pushMatrix();c.getMatrices().translate(x,y);c.getMatrices().scale(size/24f,size/24f);Icones.draw(c,id,0,0,Theme.TEXTE);c.getMatrices().popMatrix();}
 static void coin(DrawContext c,int x,int y,int size){c.drawTexture(net.minecraft.client.gl.RenderPipelines.GUI_TEXTURED,net.minecraft.util.Identifier.of("xrnhud","textures/gui/xrn-coin.png"),x,y,0f,0f,size,size,128,128,128,128,0xFFFFFFFF);}

 static void card(DrawContext c,int x,int y,int w,int h,boolean hover,boolean active){long key=((long)x<<40)^((long)y<<24)^((long)w<<12)^h;double now=System.nanoTime();var state=hoverStates.computeIfAbsent(key,k->new double[]{0,now});state[0]+=((hover?1:0)-state[0])*(1-Math.exp(-16*Math.min(.1,(now-state[1])/1e9)));state[1]=now;if(hoverStates.size()>1024)hoverStates.clear();Theme.arrondi(c,x,y,w,h,Theme.melange(SURFACE,SURFACE_HOVER,(float)state[0]),active?Theme.alpha(Theme.ACCENT_FORT,.65f):Theme.melange(LINE,Theme.alpha(Theme.ACCENT,.65f),(float)state[0]));}
 static void action(DrawContext c,String title,String desc,String icon,int x,int y,int w,int h,boolean hover){card(c,x,y,w,h,hover,false);if(icon.equals("Coins"))coin(c,x+14,y+(h-30)/2,30);else icon(c,icon,x+14,y+(h-30)/2,30);text(c,title,x+57,y+12,1.5f,Theme.TEXTE);detail(c,desc,x+57,y+35,w-85);text(c,"›",x+w-24,y+h/2-5,1.4f,Theme.ACCENT);}
 static void capsule(DrawContext c,String label,int x,int y,int w,boolean hover){Theme.arrondi(c,x,y,w,28,hover?SURFACE_HOVER:SURFACE,hover?Theme.ACCENT:LINE);center(c,label,x+w/2,y+10,1,Theme.TEXTE);}
 static void wordmark(DrawContext c,int x,int y,int size){c.drawTexture(net.minecraft.client.gl.RenderPipelines.GUI_TEXTURED,net.minecraft.util.Identifier.of("xrnhud","textures/gui/wordmark.png"),x,y,0f,0f,size,Math.round(size*320/516f),516,320,516,320,Theme.TEXTE);}
}
