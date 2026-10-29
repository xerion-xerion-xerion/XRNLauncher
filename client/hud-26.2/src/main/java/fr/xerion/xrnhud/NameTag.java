package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
import net.minecraft.network.chat.Component;
/** Local display styling; never changes a server rank or the authenticated name. */
public final class NameTag {
 public static boolean actif=false,badge=true,gradient=true,masquerDecorations=false,anime=false,arcenciel=false;
 public static int debut=0xFFA78BFA,fin=0xFFF4EEFF;
 private static net.minecraft.network.chat.MutableComponent segment(Component original,int start,int end){
  var out=Component.empty();int[] at={0};
  original.visit((style,value)->{int a=Math.max(start-at[0],0),b=Math.min(end-at[0],value.length());if(a<b)out.append(Component.literal(value.substring(a,b)).withStyle(style));at[0]+=value.length();return java.util.Optional.<Object>empty();},net.minecraft.network.chat.Style.EMPTY);return out;
 }
 public record Profil(boolean actif,boolean badge,boolean gradient,boolean nettoyer,int debut,int fin,boolean anime,boolean arcenciel){}
 public static Profil local(){return new Profil(actif,badge,gradient,masquerDecorations,debut,fin,anime&&PrimeClient.peutAnimer(),arcenciel&&PrimeClient.peutAnimer());}
 public static Component personnaliser(Component original,String username){return appliquer(original,username,local());}
 public static Component distant(Component original,String username,java.util.UUID uuid){return appliquer(original,username,Connus.style(uuid));}
 public static boolean badgeDistant(java.util.UUID uuid){var p=Connus.style(uuid);return p==null||p.badge();}
 private static Component appliquer(Component original,String username,Profil profil){
  if(profil==null||!profil.actif())return original;
  String flat=original.getString();int start=flat.indexOf(username);if(start<0)return original;
  var out=Component.empty();if(!profil.nettoyer()&&start>0)out.append(segment(original,0,start));
  int[] cps=username.codePoints().toArray();for(int i=0;i<cps.length;i++){float amount=profil.gradient()&&cps.length>1?i/(float)(cps.length-1):0;if(profil.anime()){float phase=(System.currentTimeMillis()%6000)/6000f;amount=(amount+phase*2)%2;amount=amount<=1?amount:2-amount;}int color=profil.arcenciel()?java.awt.Color.HSBtoRGB(((System.currentTimeMillis()%8000)/8000f+i*.045f)%1,.65f,1)&0xFFFFFF:Theme.melange(profil.debut(),profil.fin(),amount)&0xFFFFFF;out.append(Component.literal(new String(Character.toChars(cps[i]))).withStyle(style->style.withColor(color)));}
  if(!profil.nettoyer()&&start+username.length()<flat.length())out.append(segment(original,start+username.length(),flat.length()));return out;
 }
 static void charger(JsonObject o){if(o.has("nameAnimate"))anime=o.get("nameAnimate").getAsBoolean();if(o.has("nameRainbow"))arcenciel=o.get("nameRainbow").getAsBoolean();if(o.has("nameStyle"))actif=o.get("nameStyle").getAsBoolean();if(o.has("ownBadge"))badge=o.get("ownBadge").getAsBoolean();if(o.has("nameGradient"))gradient=o.get("nameGradient").getAsBoolean();if(o.has("nameClean"))masquerDecorations=o.get("nameClean").getAsBoolean();if(o.has("nameStart"))debut=o.get("nameStart").getAsInt();if(o.has("nameEnd"))fin=o.get("nameEnd").getAsInt();}
 static void sauver(JsonObject o){o.addProperty("nameAnimate",anime);o.addProperty("nameRainbow",arcenciel);o.addProperty("nameStyle",actif);o.addProperty("ownBadge",badge);o.addProperty("nameGradient",gradient);o.addProperty("nameClean",masquerDecorations);o.addProperty("nameStart",debut);o.addProperty("nameEnd",fin);}
}
