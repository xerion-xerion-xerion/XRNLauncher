package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
@Mixin(value=net.minecraft.client.render.GameRenderer.class,priority=500)
public abstract class ProjectionBalisesMixin {
 @Inject(method="getFov",at=@At("RETURN")) private void xrn$fov(net.minecraft.client.render.Camera camera,float delta,boolean world,CallbackInfoReturnable<Float> cir){if(world)fr.xerion.xrnhud.ProjectionBalises.fov=cir.getReturnValue();}
}
