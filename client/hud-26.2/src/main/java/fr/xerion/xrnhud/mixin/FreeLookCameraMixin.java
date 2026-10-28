package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.FreeLook;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Camera;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;
@Mixin(Camera.class)
public class FreeLookCameraMixin {
 @Redirect(method="alignWithEntity",at=@At(value="INVOKE",target="Lnet/minecraft/world/entity/Entity;getViewYRot(F)F"),require=1)
 private float xrn$yaw(Entity e,float delta){return FreeLook.active()&&e==Minecraft.getInstance().player?FreeLook.yaw():e.getViewYRot(delta);}
 @Redirect(method="alignWithEntity",at=@At(value="INVOKE",target="Lnet/minecraft/world/entity/Entity;getViewXRot(F)F"),require=1)
 private float xrn$pitch(Entity e,float delta){return FreeLook.active()&&e==Minecraft.getInstance().player?FreeLook.pitch():e.getViewXRot(delta);}
}
