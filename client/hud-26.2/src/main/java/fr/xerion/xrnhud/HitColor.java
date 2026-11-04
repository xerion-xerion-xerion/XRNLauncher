package fr.xerion.xrnhud;
/** Visual hurt tint only: no combat timing, packets, reach or damage changes. */
public final class HitColor {
 public static boolean actif;public static int couleur=0xFFB78CF2;
 public static void actualiser(){var game=net.minecraft.client.Minecraft.getInstance();if(game.gameRenderer!=null)((HitColorTexture)(Object)game.gameRenderer.overlayTexture()).xrn$applyHurtColor();}
 public static int pixel(){return actif?0xB2000000|(couleur&0xFFFFFF):0xB2FF0000;}
 static void charger(com.google.gson.JsonObject o){if(o.has("hitColorEnabled"))actif=o.get("hitColorEnabled").getAsBoolean();if(o.has("hitColor"))couleur=o.get("hitColor").getAsInt()|0xFF000000;}
 static void sauver(com.google.gson.JsonObject o){o.addProperty("hitColorEnabled",actif);o.addProperty("hitColor",couleur);}
}
