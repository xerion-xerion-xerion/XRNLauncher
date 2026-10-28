package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(net.minecraft.client.render.GameRenderer.class)
public class MotionBlurMixin {
@Inject(method="render",at=@At(value="INVOKE",target="Lnet/minecraft/client/render/GameRenderer;renderWorld(Lnet/minecraft/client/render/RenderTickCounter;)V",shift=At.Shift.AFTER),require=1) private void xrn$motion(CallbackInfo ci){fr.xerion.xrnhud.MotionBlur.render();}
@Inject(method="close",at=@At("HEAD")) private void xrn$close(CallbackInfo ci){fr.xerion.xrnhud.MotionBlur.reset();}
}
