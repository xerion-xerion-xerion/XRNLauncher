package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.option.Perspective;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/** Hold a configurable key to orbit the camera without changing the player's aim. */
public final class FreeLook {
    public static boolean enabled;
    private static boolean active;
    private static KeyBinding key;
    private static Perspective previous;
    private static float yaw,pitch;
    private FreeLook() {}
    static void install() {
        key=KeyBindingHelper.registerKeyBinding(new KeyBinding("key.xrnhud.freelook",InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_V,Raccourcis.CATEGORY));
    }
    static void tick(MinecraftClient mc) {
        boolean held=enabled&&mc.player!=null&&mc.world!=null&&mc.currentScreen==null&&mc.isWindowFocused()&&key.isPressed();
        if(active&&mc.options.getPerspective()!=Perspective.THIRD_PERSON_BACK)held=false;
        if(held&&!active) {
            previous=mc.options.getPerspective();yaw=mc.player.getYaw();pitch=mc.player.getPitch();
            mc.options.setPerspective(Perspective.THIRD_PERSON_BACK);active=true;
        } else if(!held&&active) {
            active=false;
            if(mc.options.getPerspective()==Perspective.THIRD_PERSON_BACK)mc.options.setPerspective(previous);
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
