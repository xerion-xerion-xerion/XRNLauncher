package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.FreeLook;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.Camera;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;
@Mixin(Camera.class)
public class FreeLookCameraMixin {
 @Redirect(method="update",at=@At(value="INVOKE",target="Lnet/minecraft/entity/Entity;getYaw(F)F"),require=1)
 private float xrn$yaw(Entity e,float delta){return FreeLook.active()&&e==MinecraftClient.getInstance().player?FreeLook.yaw():e.getYaw(delta);}
 @Redirect(method="update",at=@At(value="INVOKE",target="Lnet/minecraft/entity/Entity;getPitch(F)F"),require=1)
 private float xrn$pitch(Entity e,float delta){return FreeLook.active()&&e==MinecraftClient.getInstance().player?FreeLook.pitch():e.getPitch(delta);}
}
