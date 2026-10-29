package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.Minecraft;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.CameraType;
import com.mojang.blaze3d.platform.InputConstants;
import org.lwjgl.glfw.GLFW;

/** Hold a configurable key to orbit the camera without changing the player's aim. */
public final class FreeLook {
    public static boolean enabled;
    private static boolean active;
    private static KeyMapping key;
    private static CameraType previous;
    private static float yaw,pitch;
    private FreeLook() {}
    static void install() {
        key=KeyMappingHelper.registerKeyMapping(new KeyMapping("key.xrnhud.freelook",InputConstants.Type.KEYSYM,GLFW.GLFW_KEY_V,Raccourcis.CATEGORY));
    }
    static void tick(Minecraft mc) {
        boolean held=enabled&&mc.player!=null&&mc.level!=null&&mc.screen==null&&mc.isWindowActive()&&key.isDown();
        if(active&&mc.options.getCameraType()!=CameraType.THIRD_PERSON_BACK)held=false;
        if(held&&!active) {
            previous=mc.options.getCameraType();yaw=mc.player.getYRot();pitch=mc.player.getXRot();
            mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);active=true;
        } else if(!held&&active) {
            active=false;
            if(mc.options.getCameraType()==CameraType.THIRD_PERSON_BACK)mc.options.setCameraType(previous);
        }
    }
    public static boolean active(){return active;}
    public static void rotate(double dx,double dy) {
        yaw+=(float)(dx*.15);pitch=Math.max(-90,Math.min(90,pitch+(float)(dy*.15)));
    }
    public static float yaw(){return yaw;}
    public static float pitch(){return pitch;}
    static void load(JsonObject o){enabled=o.has("freeLook")&&o.get("freeLook").getAsBoolean();}
    static void save(JsonObject o){o.addProperty("freeLook",enabled);}
}
