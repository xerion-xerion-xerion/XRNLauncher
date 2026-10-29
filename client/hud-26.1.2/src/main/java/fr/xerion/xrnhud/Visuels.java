package fr.xerion.xrnhud;

import com.google.gson.JsonObject;
import net.minecraft.client.Minecraft;

public final class Visuels {
    public static boolean hitboxes,contours;
    public static int hitColor=0xFFBA96F2,blockColor=0xFFBA96F2;
    public static float hitWidth=1.5f,blockWidth=2f;
    private static boolean previous;
    static final int[] PALETTE={0xFFBA96F2,0xFFEEEEF5,0xFF66DFD5,0xFFFFBB69,0xFFFF7793,0xFF8AC8FF};
    static void tick(Minecraft cl){if(previous!=hitboxes){previous=hitboxes;cl.levelRenderer.debugRenderer.refreshRendererList();}}
    static int suivant(int color){for(int i=0;i<PALETTE.length;i++)if(PALETTE[i]==color)return PALETTE[(i+1)%PALETTE.length];return PALETTE[0];}
    static void charger(JsonObject o){
        if(o.has("hitboxes"))hitboxes=o.get("hitboxes").getAsBoolean();if(o.has("contours"))contours=o.get("contours").getAsBoolean();
        if(o.has("hitColor"))hitColor=o.get("hitColor").getAsInt()|0xFF000000;if(o.has("blockColor"))blockColor=o.get("blockColor").getAsInt()|0xFF000000;
        if(o.has("hitWidth"))hitWidth=valeur(o.get("hitWidth").getAsFloat());if(o.has("blockWidth"))blockWidth=valeur(o.get("blockWidth").getAsFloat());
    }
    private static float valeur(float f){return Float.isFinite(f)?Math.max(.5f,Math.min(4,f)):1.5f;}
    static void sauver(JsonObject o){o.addProperty("hitboxes",hitboxes);o.addProperty("contours",contours);o.addProperty("hitColor",hitColor);o.addProperty("blockColor",blockColor);o.addProperty("hitWidth",hitWidth);o.addProperty("blockWidth",blockWidth);}
}
