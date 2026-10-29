package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
/** Smooth, articulated cape bends. The game's cape root still follows walking/jumping. */
public final class CapeMouvement {
 public static boolean actif=true;public static float intensite=1.0f;
 public static int apercusWavey;
 public static boolean externe(){return net.fabricmc.loader.api.FabricLoader.getInstance().isModLoaded("waveycapes");}
 private CapeMouvement(){}
 public static float courbe(float age,int id,float profondeur,float mouvement){
  float force=Float.isFinite(intensite)?Math.clamp(intensite,.4f,1.6f):1;
  float motion=Math.clamp(Math.abs(mouvement),0,1),phase=age*.105f+(id%31)*.17f;
  // A travelling wave bends the bottom more than the pinned shoulders. Never folds through the body.
  return (float)(force*Math.pow(profondeur,1.35)*(.20+.14*motion+(.17+.20*motion)*Math.sin(phase-profondeur*2.8)));
 }
 public static float lateral(float age,int id,float profondeur,float mouvement){return (float)(Math.sin(age*.083+(id%23)*.21-profondeur*2.4)*profondeur*.12*intensite*(.5+Math.clamp(Math.abs(mouvement),0,1)));}
 static void charger(JsonObject o){if(o.has("capeFlottante"))actif=o.get("capeFlottante").getAsBoolean();if(o.has("capeIntensite")){float f=o.get("capeIntensite").getAsFloat();intensite=Float.isFinite(f)?Math.clamp(f,.4f,1.6f):1;}}
 static void ecrire(JsonObject o){o.addProperty("capeFlottante",actif);o.addProperty("capeIntensite",intensite);}
}
