package fr.xerion.xrnhud;
import net.minecraft.client.MinecraftClient;import net.minecraft.particle.*;import com.google.gson.JsonObject;
/** Rendering budgets only: no network packets, hit detection, cooldown or server-state changes. */
public final class Optimisations {
 public static boolean actif,cristaux=true,perles=true,ancres=true,nourriture=true,lointaines=true;
 private static long window;private static final int[] counts=new int[5];public static long epargnees;
 private Optimisations(){}
 public static boolean autorise(ParticleEffect effect,double x,double y,double z){if(!actif&&!Performance.actif)return true;var c=MinecraftClient.getInstance();if(c.world==null||c.player==null)return true;var type=effect.getType();int kind=-1,limit=0;
 if(cristaux&&(type==ParticleTypes.EXPLOSION||type==ParticleTypes.EXPLOSION_EMITTER||type==ParticleTypes.FLASH)){kind=0;limit=12;}
 else if(perles&&type==ParticleTypes.PORTAL){kind=1;limit=28;}
 else if(ancres&&type==ParticleTypes.REVERSE_PORTAL){kind=2;limit=28;}
 else if(nourriture&&type==ParticleTypes.ITEM&&c.player.isUsingItem()&&c.player.getActiveItem().contains(net.minecraft.component.DataComponentTypes.FOOD)){kind=3;limit=20;}
 if(lointaines&&c.player.squaredDistanceTo(x,y,z)>4096){epargnees++;return false;}
 if(kind<0)return true;long now=System.nanoTime()/100000000;if(now!=window){java.util.Arrays.fill(counts,0);window=now;}if(counts[kind]++>=limit){epargnees++;return false;}return true;
 }
 static void charger(JsonObject o){actif=false;if(o.has("optCrystals"))cristaux=o.get("optCrystals").getAsBoolean();if(o.has("optPearls"))perles=o.get("optPearls").getAsBoolean();if(o.has("optAnchors"))ancres=o.get("optAnchors").getAsBoolean();if(o.has("optFood"))nourriture=o.get("optFood").getAsBoolean();if(o.has("optDistant"))lointaines=o.get("optDistant").getAsBoolean();}
 static void sauver(JsonObject o){o.addProperty("optimizers",actif);o.addProperty("optCrystals",cristaux);o.addProperty("optPearls",perles);o.addProperty("optAnchors",ancres);o.addProperty("optFood",nourriture);o.addProperty("optDistant",lointaines);}
}
