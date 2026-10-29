package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(net.minecraft.client.renderer.GameRenderer.class)
public class MotionBlurMixin {
@Inject(method="render",at=@At(value="INVOKE",target="Lnet/minecraft/client/renderer/GameRenderer;renderLevel(Lnet/minecraft/client/DeltaTracker;)V",shift=At.Shift.AFTER),require=1) private void xrn$motion(CallbackInfo ci){fr.xerion.xrnhud.MotionBlur.render();}
@Inject(method="close",at=@At("HEAD")) private void xrn$close(CallbackInfo ci){fr.xerion.xrnhud.MotionBlur.reset();}
}
